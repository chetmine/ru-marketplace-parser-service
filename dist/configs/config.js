"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectConfig = exports.rabbitMQConfig = exports.redisConfig = exports.webServerConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.webServerConfig = {
    port: process.env.SERVER_PORT,
};
exports.redisConfig = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'marketplace-parser:',
};
exports.rabbitMQConfig = {
    url: process.env.RABBITMQ_CONNECTION_URL,
};
exports.projectConfig = {
    SAVE_SCREENSHOTS: false,
    CONTEXT_DATA_TTL: 10 * 60 * 1000,
    MAX_REQUESTS_PER_SESSION: 3,
    FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS: 3
};
