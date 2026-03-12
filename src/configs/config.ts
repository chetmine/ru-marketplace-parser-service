import dotenv from "dotenv";
import {detectOS} from "../utils/detect-os";
import {ProductCacheConfig} from "../services/ProductCacheService";
dotenv.config();

export const webServerConfig = {
    port: process.env.SERVER_PORT,
}


export const redisConfig = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,

    keyPrefix: 'marketplace-parser:',
}

export const rabbitMQConfig = {
    url: process.env.RABBITMQ_CONNECTION_URL,
}

export const projectConfig = {
    DEBUG_PARSER_ERRORS: true,
    SAVE_SCREENSHOTS: true,
    UA_OS: detectOS(),
    CONTEXT_DATA_TTL: 10 * 60 * 1000,
    MAX_REQUESTS_PER_SESSION: 3,
    FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS: 3,
    PLAYWRIGHT_TIMEOUT: 40 * 1000 // in ms
}

export const productCacheConfig: ProductCacheConfig = {
    detailedTtlSeconds: 5 * 60,
    previewTtlSeconds: 5 * 60
}