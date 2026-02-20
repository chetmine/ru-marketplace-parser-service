import amqplib, {Connection, Channel, ChannelModel} from "amqplib";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";


export interface RabbitMQConfig {
    url: string;
}

export default class RabbitMQConnection {
    declare private connection: ChannelModel;
    declare private channel: Channel;

    private readonly connectionUrl: string;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({config}) {
        this.connectionUrl = config.url;

        this.logger = loggerFactory(this);
    }

    public async connect() {
        this.connection = await amqplib.connect(this.connectionUrl);
        this.channel = await this.connection.createChannel();

        this.connection.on('close', () => {
            this.logger.info('Connection closed.');
        });

        this.connection.on('error', (err) => {
            this.logger.error(`Connection Error. Reason: ${err.message}`);
        });

        this.logger.info(`Connected.`);
    }

    public async setup() {
        await this.channel.assertExchange('marketplace', 'topic', { durable: true });

        await this.channel.assertQueue(`marketplace.parser.detailed`, {
            durable: true,
            messageTtl: 60 * 1000
        });

        await this.channel.assertQueue(`marketplace.parser.preview`, {
            durable: true,
            messageTtl: 60 * 1000
        });

        await this.channel.bindQueue(
            'marketplace.parser.detailed',
            'marketplace',
            'marketplace.parsed.detailed.*'
        );

        await this.channel.bindQueue(
            'marketplace.parser.preview',
            'marketplace',
            'marketplace.parsed.preview.*',
        );
    }

    getChannel() {
        return this.channel;
    }
}