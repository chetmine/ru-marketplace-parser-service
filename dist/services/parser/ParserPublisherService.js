"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ParserPublisherService {
    // @ts-ignore
    constructor({ rabbitMQPublisher }) {
        this.publisher = rabbitMQPublisher;
    }
    async publishProductDetailed(product, sessionId) {
        await this.publisher.publish(product, `marketplace`, `marketplace.parsed.detailed.${sessionId}`);
    }
    async publishProductsPreview(products, sessionId) {
        await this.publisher.publish(products, 'marketplace', `marketplace.parsed.preview.${sessionId}`);
    }
}
exports.default = ParserPublisherService;
