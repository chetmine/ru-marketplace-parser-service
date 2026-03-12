import { Redis } from 'ioredis';
import { Product, ProductPreview } from './parser/MarketPlaceParser';
import { Logger } from 'winston';
import { loggerFactory } from '../utils/logger';
import RedisClient from "../redis/RedisClient";

export interface ProductCacheConfig {
    previewTtlSeconds: number;
    detailedTtlSeconds: number;
}

export interface DetailedCacheEntry {
    product: Product | undefined | null;
    products: (Product | undefined)[];
}

export default class ProductCacheService {
    private readonly redis: RedisClient;
    private readonly config: ProductCacheConfig;
    private readonly logger: Logger;

    private readonly PREVIEW_PREFIX = 'product:preview:';
    private readonly DETAILED_PREFIX = 'product:detailed:';

    // @ts-ignore
    constructor({ redisClient, config }) {
        this.redis = redisClient;
        this.config = config;
        this.logger = loggerFactory(this);
    }

    private buildKey(prefix: string, query: string, marketplace?: string): string {
        const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
        const suffix = marketplace ? `:${marketplace}` : ':all';
        return `${prefix}${normalizedQuery}${suffix}`;
    }

    async getPreview(query: string, marketplace?: string): Promise<ProductPreview[][] | null> {
        const key = this.buildKey(this.PREVIEW_PREFIX, query, marketplace);
        return this.get<ProductPreview[][]>(key);
    }

    async setPreview(query: string, data: ProductPreview[][], marketplace?: string): Promise<void> {
        const key = this.buildKey(this.PREVIEW_PREFIX, query, marketplace);
        await this.set(key, data, this.config.previewTtlSeconds);
    }

    async getDetailed(query: string, marketplace?: string): Promise<DetailedCacheEntry | null> {
        const key = this.buildKey(this.DETAILED_PREFIX, query, marketplace);
        return this.get<DetailedCacheEntry>(key);
    }

    async setDetailed(query: string, data: {
        product: Product | null | undefined;
        products: (Product | null)[]
    }, marketplace?: string | undefined): Promise<void> {
        const key = this.buildKey(this.DETAILED_PREFIX, query, marketplace);
        await this.set(key, data, this.config.detailedTtlSeconds);
    }

    private async get<T>(key: string): Promise<T | null> {
        try {
            const instance = this.redis.getInstance();

            const raw = await instance.get(key);
            if (!raw) return null;

            return JSON.parse(raw) as T;
        } catch (e: any) {
            this.logger.warn(`Cache GET failed for key "${key}": ${e.message}`);
            return null;
        }
    }

    private async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        try {
            const instance = this.redis.getInstance();

            await instance.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (e: any) {
            this.logger.warn(`Cache SET failed for key "${key}": ${e.message}`);
        }
    }
}