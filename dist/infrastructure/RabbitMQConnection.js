"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = __importDefault(require("amqplib"));
const logger_1 = require("../utils/logger");
class RabbitMQConnection {
    // @ts-ignore
    constructor({ config }) {
        this.connectionUrl = config.url;
        this.logger = (0, logger_1.loggerFactory)(this);
    }
    async connect() {
        this.connection = await amqplib_1.default.connect(this.connectionUrl);
        this.channel = await this.connection.createChannel();
        this.connection.on('close', () => {
            this.logger.info('Connection closed.');
        });
        this.connection.on('error', (err) => {
            this.logger.error(`Connection Error. Reason: ${err.message}`);
        });
        this.logger.info(`Connected.`);
    }
    async setup() {
        await this.channel.assertExchange('marketplace', 'topic', { durable: true });
        await this.channel.assertQueue(`marketplace.parser.detailed`, {
            durable: true,
            messageTtl: 60 * 1000
        });
        await this.channel.assertQueue(`marketplace.parser.preview`, {
            durable: true,
            messageTtl: 60 * 1000
        });
        await this.channel.bindQueue('marketplace.parser.detailed', 'marketplace', 'marketplace.parsed.detailed.*');
        await this.channel.bindQueue('marketplace.parser.preview', 'marketplace', 'marketplace.parsed.preview.*');
    }
    getChannel() {
        return this.channel;
    }
}
exports.default = RabbitMQConnection;
