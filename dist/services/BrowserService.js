"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const playwright_extra_1 = require("playwright-extra");
const logger_1 = require("../utils/logger");
const ChromiumUserAgentGenerator_1 = require("../utils/ChromiumUserAgentGenerator");
class BrowserService {
    // @ts-ignore
    constructor({ redisClient, proxyService, projectConfig }) {
        this.contexts = new Map();
        this.logger = (0, logger_1.loggerFactory)(this);
        this.contextTTL = proxyService.CONTEXT_DATA_TTL;
        this.redisClient = redisClient;
        this.proxyService = proxyService;
    }
    async init() {
        this.redis = this.redisClient.getInstance();
        this.browser = await playwright_extra_1.chromium.launch({
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--headless=new'
            ],
        });
        node_cron_1.default.schedule('* * * * *', this.cleanup.bind(this));
        this.logger.info(`Successfully ran ${this.browser.browserType().name()} browser.`);
    }
    /**
     * Gets or creates context for provided id string.
     * @param {string} id
     */
    async getContextData(id) {
        const savedState = await this.loadFromRedis(id);
        if (savedState) {
            const context = await this.restoreContext(savedState);
            savedState.lastAccessedAt = new Date();
            return {
                ...savedState,
                context,
            };
        }
        const proxyData = await this.proxyService.attachProxy(id);
        const fingerprint = this.generateFingerprint();
        const context = await this.createContext(fingerprint, proxyData?.id);
        const contextData = {
            context,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            fingerprint,
            attachedProxyId: proxyData?.id,
        };
        //this.contexts.set(id, contextData);
        await this.saveToRedis(id, contextData);
        return contextData;
    }
    async isContextExists(id) {
        const data = await this.redis.get(`browser_context:${id}`);
        return !!data;
    }
    async createContext(fingerprint, proxyDataId) {
        let proxyData;
        if (proxyDataId) {
            proxyData = await this.proxyService.getProxyData(proxyDataId);
        }
        return await this.configureContext(await this.browser.newContext({
            userAgent: fingerprint.userAgent,
            geolocation: fingerprint.geolocation,
            viewport: fingerprint.viewport,
            locale: fingerprint.locale,
            timezoneId: fingerprint.timezoneId,
            permissions: ['geolocation', 'notifications'],
            extraHTTPHeaders: {
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            javaScriptEnabled: true,
            ignoreHTTPSErrors: true,
            proxy: proxyData
                ?
                    {
                        server: proxyData.host,
                        ...(proxyData.username && { username: proxyData.username }),
                        ...(proxyData.password && { password: proxyData.password }),
                    }
                : undefined,
        }));
    }
    async configureContext(context) {
        // await context.addInitScript(() => {
        //     Object.defineProperty(navigator, 'webdriver', {
        //         get: () => '[native code]',
        //     })
        // })
        // await context.addInitScript(() => {
        //     Object.defineProperty(navigator, 'webdriver', {
        //         get: () => undefined,
        //     });
        //
        //     Object.defineProperty(navigator, 'languages', {
        //         get: () => ['ru-RU', 'ru', 'en-US', 'en'],
        //     });
        //
        //     Object.defineProperty(navigator, 'plugins', {
        //         get: () => [1, 2, 3, 4, 5],
        //     });
        //
        //     (window as any).chrome = {
        //         runtime: {},
        //     };
        //
        //     const originalQuery = window.navigator.permissions.query;
        //     window.navigator.permissions.query = (parameters: any) =>
        //         parameters.name === 'notifications'
        //             ? Promise.resolve({ state: 'prompt' } as PermissionStatus)
        //             : originalQuery(parameters);
        // });
        context.setDefaultTimeout(20000);
        return context;
    }
    async restoreContext(savedState) {
        const proxyData = {
            server: savedState?.attachedProxyData?.host,
            ...(savedState?.attachedProxyData?.username && { username: savedState.attachedProxyData.username }),
            ...(savedState?.attachedProxyData?.password && { password: savedState.attachedProxyData.password }),
        };
        return await this.configureContext(await this.browser.newContext({
            userAgent: savedState.fingerprint.userAgent,
            geolocation: savedState.fingerprint.geolocation,
            viewport: savedState.fingerprint.viewport,
            locale: savedState.fingerprint.locale,
            timezoneId: savedState.fingerprint.timezoneId,
            storageState: savedState.storageState,
            permissions: ['geolocation', 'notifications'],
            extraHTTPHeaders: {
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            javaScriptEnabled: true,
            ignoreHTTPSErrors: true,
            proxy: savedState.attachedProxyData ? proxyData : undefined,
        }));
    }
    generateFingerprint() {
        const geolocations = [
            { latitude: 59.9311, longitude: 30.3609 },
            { latitude: 55.7558, longitude: 37.6173 },
        ];
        const timezones = ['Europe/Moscow'];
        return {
            userAgent: ChromiumUserAgentGenerator_1.ChromiumUserAgentGenerator.generate({ os: 'windows', mobile: false }),
            geolocation: geolocations[Math.floor(Math.random() * geolocations.length)],
            viewport: { width: 1920, height: 1080 },
            locale: 'ru-RU',
            timezoneId: timezones[Math.floor(Math.random() * timezones.length)],
        };
    }
    async save(userId, contextData) {
        const oldContext = await this.loadFromRedis(userId);
        if (!oldContext)
            throw new Error("Context must be defined in Redis.");
        await this.saveToRedis(userId, contextData);
    }
    async saveToRedis(id, data) {
        try {
            const storageState = await data.context.storageState();
            const redisData = {
                fingerprint: data.fingerprint,
                storageState,
                createdAt: data.createdAt?.toISOString(),
                lastAccessedAt: data.lastAccessedAt?.toISOString(),
                attachedProxyId: data.attachedProxyId,
            };
            await this.redis.setex(`browser_context:${id}`, Math.floor(this.contextTTL / 1000), JSON.stringify(redisData));
        }
        catch (error) {
            this.logger.error(`Failed to save context to Redis: ${error.message}`);
        }
    }
    async loadFromRedis(userId) {
        try {
            const data = await this.redis.get(`browser_context:${userId}`);
            const rawContextData = data ? JSON.parse(data) : null;
            if (!rawContextData)
                return null;
            return {
                ...rawContextData,
                lastAccessedAt: new Date(rawContextData.lastAccessedAt),
                createdAt: new Date(rawContextData.createdAt)
            };
        }
        catch (error) {
            this.logger.error(`Failed to load context from Redis: ${error.message}`);
            return null;
        }
    }
    async updateRedisAccess(userId) {
        try {
            await this.redis.expire(`browser_context:${userId}`, Math.floor(this.contextTTL / 1000));
        }
        catch (error) {
            this.logger.error(`Failed to update Redis TTL: ${error.message}`);
        }
    }
    async cleanup() {
        const now = Date.now();
        const cleanupTasks = [];
        for (const [userId, data] of this.contexts.entries()) {
            if (now - data.lastAccessedAt.getTime() > this.contextTTL) {
                cleanupTasks.push((async () => {
                    await this.proxyService.unattachProxy(userId);
                    await this.closeContext(userId);
                })());
            }
        }
        await Promise.all(cleanupTasks);
    }
    async closeContext(id) {
        const contextData = await this.getContextData(id);
        const context = contextData.context;
        if (context) {
            await this.save(id, contextData);
            await context.close();
        }
    }
    async closeAll() {
        await Promise.all(Array.from(this.contexts.entries()).map(async ([userId, data]) => {
            await this.saveToRedis(userId, data);
            await data.context.close();
        }));
        this.contexts.clear();
    }
}
exports.default = BrowserService;
