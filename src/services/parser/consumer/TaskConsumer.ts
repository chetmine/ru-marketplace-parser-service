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
        await channel.prefetch(1);

        try {
            await channel.consume(`${Exchanges.TASKS}.*`, async (msg) => {
                if (msg) {

                    const taskType = msg.fields.routingKey as 'preview' | 'detailed';
                    const task = <ParseTask> {
                        type: taskType,
                        ...JSON.parse(msg.content.toString())
                    }

                    await this.taskHandler.handle(task);

                    channel.ack(msg);
                }
            });
        } catch (error: any) {
            this.logger.error(`Failed to consume task. Reason: ${error.message}`);
        }
    }
}