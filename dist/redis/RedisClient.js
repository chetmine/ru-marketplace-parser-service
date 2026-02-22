"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const ioredis_1 = __importDefault(require("ioredis"));
class RedisClient {
    // @ts-ignore
    constructor({ config }) {
        this.logger = (0, logger_1.loggerFactory)(this);
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
    async init() {
        this.instance = new ioredis_1.default(this.REDIS_CONFIG);
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
        this.instance.on('reconnecting', (delay) => {
            this.logger.info(`Redis: Reconnecting in ${delay}ms`);
        });
        return new Promise(async (resolve, reject) => {
            const id = setTimeout(() => {
                reject(new Error("Redis connection timeout."));
            }, 10000);
            this.instance.once('ready', () => {
                clearTimeout(id);
                resolve(true);
            });
        });
    }
    getInstance() {
        return this.instance;
    }
    async disconnect() {
        await this.instance.quit();
    }
}
exports.default = RedisClient;
