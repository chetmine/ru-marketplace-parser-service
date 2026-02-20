import RabbitMQPublisher from "../../infrastructure/RabbitMQPublisher";
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
    ): Promise<void> {
        await this.publisher.publish<Product>(
            product,
            `marketplace`,
            `marketplace.parsed.detailed.${sessionId}`,
        );
    }

    public async publishProductsPreview(
        products: ProductPreview[],
        sessionId: string,
    ): Promise<void> {
        await this.publisher.publish<ProductPreview[]>(
            products,
            'marketplace',
            `marketplace.parsed.preview.${sessionId}`,
        );
    }
}