import {faker} from '@faker-js/faker'
import {Logger} from "winston";
import {Browser, BrowserContext, chromium} from "playwright";
import cron from 'node-cron'

import {loggerFactory} from "../utils/logger";
import RedisClient from "../redis/RedisClient";
import Redis from "ioredis";
import {ChromiumUserAgentGenerator} from "../utils/ChromiumUserAgentGenerator";


interface ContextData {
    context: BrowserContext;
    createdAt: Date;
    lastAccessedAt: Date;
    fingerprint: ContextFingerprint;
}

interface ContextFingerprint {
    userAgent: string;
    geolocation: { latitude: number; longitude: number };
    viewport: { width: number; height: number };
    locale: string;
    timezoneId: string;
}

export default class BrowserService {

    declare private browser: Browser;

    private contexts: Map<string, ContextData> = new Map();

    private readonly logger: Logger;
    private readonly redisClient: RedisClient;

    declare private redis: Redis;
    private contextTTL: number = 30 * 60 * 1000

    // @ts-ignore
    constructor({redisClient}) {
        this.logger = loggerFactory(this);

        this.redisClient = redisClient;
    }

    public async init(): Promise<void> {

        this.redis = this.redisClient.getInstance();

        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
            ],
            proxy: {
                server: "31.59.20.176:6754",
                username: "ocvelwkp",
                password: "n7uheig7i838",
            }
        });

        cron.schedule('* * * * *', this.cleanup.bind(this));

        this.logger.info(`Successfully ran ${this.browser.browserType().name()} browser.`);
    }


    /**
     * Gets or creates context for provided id string.
     * @param {string} id
     */

    async getContext(id: string): Promise<BrowserContext> {
        let existing = this.contexts.get(id);

        if (existing) {
            existing.lastAccessedAt = new Date();
            await this.updateRedisAccess(id);
            return existing.context;
        }

        const savedState = await this.loadFromRedis(id);

        if (savedState) {
            const context = await this.restoreContext(savedState);
            this.contexts.set(id, {
                context,
                createdAt: new Date(savedState.createdAt),
                lastAccessedAt: new Date(),
                fingerprint: savedState.fingerprint
            });
            return context;
        }

        const fingerprint = this.generateFingerprint();
        const context = await this.createContext(fingerprint);

        const contextData: ContextData = {
            context,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            fingerprint
        };

        this.contexts.set(id, contextData);
        await this.saveToRedis(id, contextData);

        return context;
    }

    private async createContext(fingerprint: ContextFingerprint): Promise<BrowserContext> {
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
        }));
    }

    private async configureContext(context: BrowserContext): Promise<BrowserContext> {
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

        context.setDefaultTimeout(20_000);

        return context;
    }

    private async restoreContext(savedState: any): Promise<BrowserContext> {
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
        }));
    }

    private generateFingerprint(): ContextFingerprint {
        const geolocations = [
            { latitude: 59.9311, longitude: 30.3609 },
            { latitude: 55.7558, longitude: 37.6173 },
        ];

        const timezones = ['Europe/Moscow'];

        return {
            userAgent: ChromiumUserAgentGenerator.generate({ os: 'windows', mobile: false }),
            //userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0",
            geolocation: geolocations[Math.floor(Math.random() * geolocations.length)],
            viewport: { width: 1920, height: 1080 },
            locale: 'ru-RU',
            timezoneId: timezones[Math.floor(Math.random() * timezones.length)],
        };
    }


    public async save(userId: string, context: BrowserContext): Promise<void> {
        const oldContext: ContextData = await this.loadFromRedis(userId);
        if (!oldContext) throw new Error("Context must be defined in Redis.");

        const contextData: ContextData = {
            context: context,
            createdAt: new Date(oldContext.createdAt),
            lastAccessedAt: new Date(),
            fingerprint: oldContext.fingerprint
        }

        await this.saveToRedis(userId, contextData);
    }

    private async saveToRedis(userId: string, data: ContextData) {
        try {
            const storageState = await data.context.storageState();

            const redisData = {
                fingerprint: data.fingerprint,
                storageState,
                createdAt: data.createdAt.toISOString(),
                lastAccessedAt: data.lastAccessedAt.toISOString()
            };

            await this.redis.setex(
                `browser_context:${userId}`,
                Math.floor(this.contextTTL / 1000),
                JSON.stringify(redisData)
            );
        } catch (error: any) {
            this.logger.error(`Failed to save context to Redis: ${error.message}`);
        }
    }

    private async loadFromRedis(userId: string): Promise<any | null> {
        try {
            const data = await this.redis.get(`browser_context:${userId}`);
            return data ? JSON.parse(data) : null;
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

        for (const [userId, data] of this.contexts.entries()) {
            if (now - data.lastAccessedAt.getTime() > this.contextTTL) {
                await this.closeContext(userId);
            }
        }
    }

    async closeContext(userId: string) {
        const data = this.contexts.get(userId);
        if (data) {
            await this.saveToRedis(userId, data);
            await data.context.close();
            this.contexts.delete(userId);
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