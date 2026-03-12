import RabbitMQConnection from "../../../infrastructure/rabbitmq/RabbitMQConnection";
import TaskHandler from "./TaskHandler";
import {Logger} from "winston";
import {Exchanges} from "../../../infrastructure/rabbitmq/topology";

export type ParseTask = {
    sessionId: string
    type: 'preview' | 'detailed'
    query: string
    params: TaskParams
}

export type TaskParams = {
    marketplace?: string
    retryOnParserExposed?: boolean
}

export default class TaskConsumer {
    private readonly rabbitMQConnection: RabbitMQConnection;

    private readonly taskHandler: TaskHandler;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({rabbitMQConnection, taskHandler, logger}) {
        this.rabbitMQConnection = rabbitMQConnection;

        this.taskHandler = taskHandler;

        this.logger = logger;
    }

    async startConsuming() {
        const channel = this.rabbitMQConnection.getChannel();
        await channel.prefetch(10);

        try {
            await channel.consume(`${Exchanges.TASKS}.preview`, async (msg) => {
                if (msg) {
                    this.logger.debug(`Received new preview task message: ${msg.content.toString()}`);
                    const taskType = 'preview';
                    const task = <ParseTask> {
                        type: taskType,
                        ...JSON.parse(msg.content.toString())
                    }

                    try {
                        await this.taskHandler.handle(task);

                        channel.ack(msg);
                    } catch (e: any) {
                        this.logger.error(`Failed to handle task ${msg.fields.routingKey.toString()}: ${e.message}`);
                        await this.taskHandler.sendError(task, e);
                        channel.nack(msg, false, false);
                    }
                }
            });

            await channel.consume(`${Exchanges.TASKS}.detailed`, async (msg) => {
                if (msg) {

                    this.logger.debug(`Received new detailed task message: ${msg.content.toString()}`);

                    const taskType = 'detailed';
                    const task = <ParseTask> {
                        type: taskType,
                        ...JSON.parse(msg.content.toString())
                    }

                    try {
                        await this.taskHandler.handle(task);

                        channel.ack(msg);
                    } catch (e: any) {
                        this.logger.error(`Failed to handle task ${msg.fields.routingKey.toString()}: ${e.message}`);
                        await this.taskHandler.sendError(task, e);
                        channel.nack(msg, false, false);
                    }
                }
            });
        } catch (error: any) {
            this.logger.error(`Failed to consume task. Reason: ${error.message}`);
        }
    }
}