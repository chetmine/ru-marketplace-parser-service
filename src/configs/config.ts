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