import dotenv from "dotenv";
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
    SAVE_SCREENSHOTS: false,
    UA_OS: "windows",
    CONTEXT_DATA_TTL: 10 * 60 * 1000,
    MAX_REQUESTS_PER_SESSION: 3,
    FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS: 3
}