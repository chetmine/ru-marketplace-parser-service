import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import Redis from "ioredis";


interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    maxRetriesPerRequest?: number;
    retryStrategy?: (times: number) => number | void;
}

export default class RedisClient {

    private readonly logger: Logger;
    private readonly REDIS_CONFIG: RedisConfig;

    declare private instance: Redis;

    // @ts-ignore
    constructor({config}) {
        this.logger = loggerFactory(this);

        this.REDIS_CONFIG = {
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db,
            keyPrefix: config.keyPrefix,
            maxRetriesPerRequest: config.maxRetriesPerRequest,
            retryStrategy: config.retryStrategy,
        };
    }

    public async init() {

        this.instance = new Redis(this.REDIS_CONFIG);

        this.instance.on('connect', () => {
            this.logger.info('Redis: Connected');
        });

        this.instance.on('ready', () => {
            this.logger.info('Redis: Ready to accept commands');
        });

        this.instance.on('error', (err) => {
            this.logger.error(`Redis Error: ${err.message}`);
        });

        this.instance.on('close', () => {
            this.logger.info('Redis: Connection closed');
        });

        this.instance.on('reconnecting', (delay: number) => {
            this.logger.info(`Redis: Reconnecting in ${delay}ms`);
        });

        return new Promise(async (resolve, reject) => {
            const id = setTimeout(() => {
                reject(new Error("Redis connection timeout."));
            }, 10_000);

            this.instance.once('ready', () => {
                clearTimeout(id);
                resolve(true);
            });
        })
    }

    public getInstance() {
        return this.instance;
    }

    public async disconnect() {
        await this.instance.quit();
    }
}