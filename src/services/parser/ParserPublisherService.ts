import RabbitMQPublisher from "../../infrastructure/rabbitmq/RabbitMQPublisher";
import {Product, ProductPreview} from "./MarketPlaceParser";
import {loggerFactory} from "../../utils/logger";
import {Logger} from "winston";

export default class ParserPublisherService {

    private readonly publisher: RabbitMQPublisher;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({rabbitMQPublisher}) {
        this.publisher = rabbitMQPublisher;

        this.logger = loggerFactory(this);
    }

    public async publishProductDetailed(
        product: Product,
        sessionId: string,
        searchId: string,
        error?: string
    ): Promise<void> {
        await this.publisher.publish(
            {
                product,
                //error: error ? error : null,
            },
            `marketplace.parser`,
            `${sessionId}:${searchId}`,
        );

        this.logger.debug(`Successfully published products detailed to ${sessionId}:${searchId}`);
    }

    public async publishProductsPreview(
        products: ProductPreview[],
        sessionId: string,
        searchId: string,
        error?: string
    ): Promise<void> {
        await this.publisher.publish(
            {
                products,
                //error: error ? error : null
            },
            'marketplace.parser',
            `${sessionId}:${searchId}`,
        );

        this.logger.debug(`Successfully published products preview to ${sessionId}:${searchId}`);
    }

    public async publishParsingFinished(
        sessionId: string,
        searchId: string,
        error?: string
    ) {
        await this.publisher.publish(
            {
                isDone: true,
                error: error ? error : null
            },
            'marketplace.parser',
            `${sessionId}:${searchId}`,
        );
    }
}