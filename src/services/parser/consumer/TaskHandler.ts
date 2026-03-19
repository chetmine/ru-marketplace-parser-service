import ProductAggregatorService from "../../ProductAggregatorService";
import {ParseTask} from "./TaskConsumer";

export default class TaskHandler {

    private readonly productAggregatorService: ProductAggregatorService;

    // @ts-ignore
    constructor({productAggregatorService}) {
        this.productAggregatorService = productAggregatorService;
    }

    async handle(task: ParseTask): Promise<void> {
        if (task.type === "preview") {
            // Product Aggregator Service automatically publishes tasks to the queue.
            await this.productAggregatorService.searchProducts(
                task.sessionId,
                task.query,
                task.params
            );
        }

        if (task.type === "detailed") {
            // Product Aggregator Service automatically publishes tasks to the queue.
            await this.productAggregatorService.searchProductDetailed(
                task.sessionId,
                task.query,
                task.params
            );
        }
    }
}