"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RabbitMQPublisher {
    // @ts-ignore
    constructor({ rabbitMQConnection }) {
        this.rabbitMQConnection = rabbitMQConnection;
    }
    async publish(payload, exchange, routingKey) {
        const channel = this.rabbitMQConnection.getChannel();
        const content = Buffer.from(JSON.stringify(payload));
        channel.publish(exchange, routingKey, content);
    }
}
exports.default = RabbitMQPublisher;
