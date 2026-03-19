import amqplib, {Connection, Channel, ChannelModel} from "amqplib";
import {Logger} from "winston";
import {loggerFactory} from "../../utils/logger";
import {assertTopology} from "./topology";
import {EventEmitter} from "events";


export interface RabbitMQConfig {
    url: string;
}

export default class RabbitMQConnection {
    declare private connection: ChannelModel;
    declare private channel: Channel;

    private readonly connectionUrl: string;
    private readonly logger: Logger;

    private readonly eventBus: EventEmitter;

    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;

    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private readonly RECONNECT_DELAY_MS = 5000;

    // @ts-ignore
    constructor({config, eventBus}) {
        this.connectionUrl = config.url;

        this.logger = loggerFactory(this);

        this.eventBus = eventBus;
    }

    public async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            this.connection = await amqplib.connect(this.connectionUrl);
            this.channel = await this.connection.createChannel();

            this.reconnectAttempts = 0;
            this.isConnecting = false;

            this.connection.on('close', () => {
                this.logger.warn('Connection closed. Reconnecting...');
                this.scheduleReconnect();
            });

            this.connection.on('error', (err) => {
                this.logger.error(`Connection error: ${err.message}`);
            });

            this.eventBus.emit('rabbitmq.connected');

            this.logger.info('Connected.');
        } catch (err: any) {
            this.isConnecting = false;
            this.logger.error(`Failed to connect: ${err.message}`);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            this.logger.error('Max reconnect attempts reached. Giving up.');
            throw new Error("Failed to reconnect RabbitMQ. Max reconnect attempts reached.");
        }

        this.reconnectAttempts++;

        const delay = this.RECONNECT_DELAY_MS * this.reconnectAttempts;
        this.logger.info(`Reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);

        setTimeout(() => this.connect(), delay);
    }

    getChannel() {
        return this.channel;
    }
}