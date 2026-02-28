import {Logger} from "winston";
import {Browser, BrowserContext, chromium} from "playwright";
import cron from 'node-cron'
import {loggerFactory} from "../utils/logger";
import RedisClient from "../redis/RedisClient";
import Redis from "ioredis";
import {ChromiumUserAgentGenerator} from "../utils/ChromiumUserAgentGenerator";
import ProxyService from "./proxy/ProxyService";


export interface ContextData {
    context: BrowserContext;
    createdAt: Date;
    lastAccessedAt: Date;
    fingerprint: ContextFingerprint;

    attachedProxyId?: number | null;
}

interface ContextFingerprint {
    userAgent: string;
    geolocation: { latitude: number; longitude: number };
    viewport: { width: number; height: number };
    locale: string;
    timezoneId: string;
}

export default class BrowserService {

    private readonly proxyService: ProxyService;

    declare private browser: Browser;

    private contexts: Map<string, ContextData> = new Map();

    private readonly logger: Logger;
    private readonly redisClient: RedisClient;

    declare private redis: Redis;
    private readonly contextTTL: number;
    private readonly uaOs: 'windows' | 'macos' | 'linux';

    // @ts-ignore
    constructor({redisClient, proxyService, projectConfig}) {
        this.logger = loggerFactory(this);

        this.contextTTL = projectConfig.CONTEXT_DATA_TTL;
        this.uaOs = projectConfig.UA_OS;

        this.redisClient = redisClient;
        this.proxyService = proxyService;
    }

    public async init(): Promise<void> {

        this.redis = this.redisClient.getInstance();

        //chromium.use(StealthMode());

        this.browser = await chromium.launch({
            headless: false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                // '--disable-web-security',
                // '--disable-features=IsolateOrigins,site-per-process',
                // '--start-maximized',
                // '--disable-extensions',
                // '--disable-infobars',
                // '--enable-automation',
                // '--no-first-run',
                // '--enable-webgl',
                // "--disable-dev-mode",
                // "--disable-debug-mode",
                // "--profile-directory=ceddys",
                '--headless=new'
            ],
        });



        cron.schedule('* * * * *', this.cleanup.bind(this));

        this.logger.info(`Successfully ran ${this.browser.browserType().name()} browser.`);
    }


    /**
     * Gets or creates context for provided id string.
     * @param {string} id
     */

    async getContextData(id: string): Promise<ContextData> {
        const savedState = await this.loadFromRedis(id);

        if (savedState) {
            const context = await this.restoreContext(savedState);
            savedState.lastAccessedAt = new Date();

            return {
                ...savedState,
                context,
            }
        }

        const proxyData = await this.proxyService.attachProxy(id);

        const fingerprint = this.generateFingerprint();
        const context = await this.createContext(fingerprint, proxyData?.id);

        const contextData: ContextData = {
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

    async isContextExists(id: string): Promise<boolean> {
        const data = await this.redis.get(`browser_context:${id}`);
        return !!data;
    }

    public async createContext(fingerprint: ContextFingerprint, proxyDataId?: number): Promise<BrowserContext> {
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
            colorScheme: "dark",

            permissions: ['geolocation', 'notifications'],
            extraHTTPHeaders: {
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                // 'Sec-CH-UA': 'Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145'
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

    private async configureContext(context: BrowserContext): Promise<BrowserContext> {
        await context.addInitScript(() => {
            (window as any).chrome = {
                runtime: {},
            };

            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Google Inc. (NVIDIA)';  // UNMASKED_VENDOR_WEBGL
                if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';  // UNMASKED_RENDERER_WEBGL
                return getParameter.call(this, parameter);
            };
        });


        context.setDefaultTimeout(20_000);
        return context;
    }

    private async restoreContext(savedState: any): Promise<BrowserContext> {

        const proxyData = {
            server: savedState?.attachedProxyData?.host,
            ...(savedState?.attachedProxyData?.username && { username: savedState.attachedProxyData.username }),
            ...(savedState?.attachedProxyData?.password && { password: savedState.attachedProxyData.password }),
        }

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

    public generateFingerprint(): ContextFingerprint {
        const geolocations = [
            { latitude: 59.9311, longitude: 30.3609 },
            { latitude: 55.7558, longitude: 37.6173 },
        ];

        const timezones = ['Europe/Moscow'];

        return {
            userAgent: ChromiumUserAgentGenerator.generate({ os: this.uaOs, mobile: false }),
            geolocation: geolocations[Math.floor(Math.random() * geolocations.length)],
            viewport: { width: 1920, height: 1080 },
            locale: 'ru-RU',
            timezoneId: timezones[Math.floor(Math.random() * timezones.length)],
        };
    }


    public async save(id: string, contextData: ContextData): Promise<void> {
        const oldContext = await this.loadFromRedis(id);
        if (!oldContext) throw new Error("Context must be defined in Redis.");

        await this.saveToRedis(id, contextData);
    }

    public async removeContext(id: string): Promise<void> {
        //const contextData = await this.getContextData(id);
        await this.closeContext(id);
        await this.proxyService.unattachProxy(id);
        await this.removeFromRedis(id);
    }

    private async removeFromRedis(id: string): Promise<void> {
        try {
            await this.redis.del(`browser_context:${id}`);
        } catch (e: any) {
            this.logger.error(`Failed to delete context in Redis: ${e.message}`);
        }
    }

    private async saveToRedis(id: string, data: ContextData) {
        try {
            const storageState = await data.context.storageState();

            const redisData = {
                fingerprint: data.fingerprint,
                storageState,
                createdAt: data.createdAt?.toISOString(),
                lastAccessedAt: data.lastAccessedAt?.toISOString(),
                attachedProxyId: data.attachedProxyId,
            };

            await this.redis.setex(
                `browser_context:${id}`,
                Math.floor(this.contextTTL / 1000),
                JSON.stringify(redisData)
            );
        } catch (error: any) {
            this.logger.error(`Failed to save context to Redis: ${error.message}`);
        }
    }

    public async fingerprintTest() {
        const fingerprint = this.generateFingerprint();
        const context = await this.createContext(fingerprint);

        const page = await context.newPage();
        await page.goto(`https://bot.sannysoft.com/`);

        const fpTestElement = page.locator(`pre[id="fp"]`);
        const data = await fpTestElement.textContent();

        await context.close();
        return data;
    }

    public async webGLTest() {
        const fingerprintForContext = this.generateFingerprint();
        const context = await this.createContext(fingerprintForContext);
        const page = await context.newPage();
        await page.goto('about:blank');

        const fingerprint = await page.evaluate(() => ({
            canvas: (() => {
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                ctx!.fillText('test', 10, 10);
                return c.toDataURL();
            })(),
            webgl: (() => {
                const c = document.createElement('canvas');
                const gl = c.getContext('webgl') as WebGLRenderingContext;
                return gl?.getParameter(gl.RENDERER);
            })(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: (navigator as any).deviceMemory,
        }));

        await context.close();

        return fingerprint;
    }

    private async loadFromRedis(userId: string): Promise<ContextData | null> {
        try {
            const data = await this.redis.get(`browser_context:${userId}`);
            const rawContextData = data ? JSON.parse(data) : null;

            if (!rawContextData) return null;

            return {
                ...rawContextData,
                lastAccessedAt: new Date(rawContextData.lastAccessedAt),
                createdAt: new Date(rawContextData.createdAt)
            };

        } catch (error: any) {
            this.logger.error(`Failed to load context from Redis: ${error.message}`);
            return null;
        }
    }

    private async updateRedisAccess(userId: string) {
        try {
            await this.redis.expire(
                `browser_context:${userId}`,
                Math.floor(this.contextTTL / 1000)
            );
        } catch (error: any) {
            this.logger.error(`Failed to update Redis TTL: ${error.message}`);
        }
    }

    private async cleanup() {
        const now = Date.now();
        const cleanupTasks: Promise<void>[] = [];

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

    async closeContext(id: string) {
        const contextData = await this.getContextData(id);
        const context = contextData.context;

        if (context) {
            await this.save(id, contextData);
            await context.close();
        }
    }

    async closeAll() {
        await Promise.all(
            Array.from(this.contexts.entries()).map(async ([userId, data]) => {
                await this.saveToRedis(userId, data);
                await data.context.close();
            })
        );

        this.contexts.clear();
    }
}