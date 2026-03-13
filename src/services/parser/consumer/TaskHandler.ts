import ProductAggregatorService from "../../ProductAggregatorService";
import {ParseTask} from "./TaskConsumer";
import ParserPublisherService from "../ParserPublisherService";

export default class TaskHandler {

    private readonly productAggregatorService: ProductAggregatorService;
    private readonly parserPublisherService: ParserPublisherService;

    // @ts-ignore
    constructor({productAggregatorService, parserPublisherService}) {
        this.productAggregatorService = productAggregatorService;
        this.parserPublisherService = parserPublisherService;
    }

    async handle(task: ParseTask): Promise<void> {

        return new Promise(async (resolve, reject) => {
            try {
                const intervalId = setInterval(() => {
                    reject(new Error("Timeout error."));
                }, 5 * 60 * 1000); // 5 minutes

                if (task.type === "preview") {
                    // Product Aggregator Service automatically publishes tasks to the queue.
                    await this.productAggregatorService.searchProducts(
                        task.sessionId,
                        task.query,
                        task.params
                    );
                    clearInterval(intervalId);
                    resolve();
                    return;
                }

                if (task.type === "detailed") {
                    // Product Aggregator Service automatically publishes tasks to the queue.
                    await this.productAggregatorService.searchProductDetailed(
                        task.sessionId,
                        task.query,
                        task.params
                    );
                    clearInterval(intervalId);
                    resolve();
                    return;
                }

                clearInterval(intervalId);
                reject(new Error("Unexpected task type"));
            } catch (e) {
                reject(e);
            }
        });
    }

    async sendError(task: ParseTask, error: Error): Promise<void> {
        await this.parserPublisherService.publishParsingFinished(task.sessionId, error.message);
    }
}