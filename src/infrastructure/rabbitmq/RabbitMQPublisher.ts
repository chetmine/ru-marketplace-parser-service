import RabbitMQConnection from "./RabbitMQConnection";
import {Channel} from "amqplib";

export default class RabbitMQPublisher {

    //private readonly connection: RabbitMQConnection;
    private readonly rabbitMQConnection: RabbitMQConnection;

    // @ts-ignore
    constructor({rabbitMQConnection}) {
        this.rabbitMQConnection = rabbitMQConnection
    }

    async publish<T>(
        payload: T,
        exchange: string,
        routingKey: string,
    ): Promise<void> {
        const channel = this.rabbitMQConnection.getChannel();

        const content = Buffer.from(JSON.stringify(payload));


        channel.publish(
            exchange,
            routingKey,
            content,
        );
    }
}