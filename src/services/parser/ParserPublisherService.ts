import RabbitMQPublisher from "../../infrastructure/rabbitmq/RabbitMQPublisher";
import {Product, ProductPreview} from "./MarketPlaceParser";

export default class ParserPublisherService {

    private readonly publisher: RabbitMQPublisher;

    // @ts-ignore
    constructor({rabbitMQPublisher}) {
        this.publisher = rabbitMQPublisher;
    }

    public async publishProductDetailed(
        product: Product,
        sessionId: string,
        isDone: boolean = false
    ): Promise<void> {
        await this.publisher.publish(
            {
                data: product,
                isDone
            },
            `marketplace.parser`,
            `marketplace.parsed.detailed.${sessionId}`,
        );
    }

    public async publishProductsPreview(
        products: ProductPreview[],
        sessionId: string,
        isDone: boolean = false
    ): Promise<void> {
        await this.publisher.publish(
            {
                data: products,
                isDone
            },
            'marketplace.parser',
            `marketplace.parsed.preview.${sessionId}`,
        );
    }
}