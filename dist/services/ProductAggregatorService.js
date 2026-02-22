"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const SessionService_1 = require("./SessionService");
class ProductAggregatorService {
    // @ts-ignore
    constructor({ parserRegistry, browserContextManager, parserPublisherService, sessionService, projectConfig }) {
        this.parserRegistry = parserRegistry;
        this.browserContextManager = browserContextManager;
        this.parserPublisherService = parserPublisherService;
        this.sessionService = sessionService;
        this.logger = (0, logger_1.loggerFactory)(this);
        this.MAX_RETRY_ATTEMPTS = projectConfig.FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS;
    }
    async searchProducts(id, query, options) {
        const productsPreview = await this.executeWithRetry(id, async (context) => {
            return await this.executeSearch(id, context, query, options, (parser) => parser.fetchProducts.bind(parser));
        });
        return productsPreview.flat();
    }
    async searchProductDetailed(id, query, options) {
        const products = await this.executeWithRetry(id, async (context) => {
            return await this.executeSearch(id, context, query, options, (parser) => parser.findProduct.bind(parser));
        });
        const objectWithMostFeatures = products.length > 0
            ? products.reduce((max, current) =>
            // @ts-ignore
            (current?.features?.length || 0) > (max?.features?.length || 0) ? current : max)
            : undefined;
        const prices = products
            .filter((result) => !!result)
            .map((product) => {
            return {
                // @ts-ignore
                [product.marketplace]: {
                    name: product?.name,
                    price: product?.price,
                    link: product?.link,
                },
            };
        });
        return {
            product: objectWithMostFeatures,
            prices: prices,
        };
    }
    async executeWithRetry(id, executor) {
        if (!await this.sessionService.isAvailable(id))
            throw new SessionService_1.SessionIsBusyError("Session is already in use");
        const maxAttempts = this.MAX_RETRY_ATTEMPTS;
        for (let i = 0; i < maxAttempts; i++) {
            await this.sessionService.setAsBusy(id);
            const contextData = await this.browserContextManager.getContextData(id);
            try {
                const data = await executor(contextData.context);
                await this.browserContextManager.saveContext(id, contextData);
                await this.sessionService.setAsFree(id);
                return data;
            }
            catch (error) {
                if (this.isProxyError(error)) {
                    this.logger.debug(`Proxy failed in context ${id}. Reason: ${error.message}. Retrying...`);
                    await this.browserContextManager.replaceProxy(id);
                    continue;
                }
                throw error;
            }
            finally {
                await this.sessionService.setAsFree(id);
            }
        }
        this.logger.error(`Proxy failed in context ${id}. Too many attempts!`);
        throw new Error(`Failed after ${maxAttempts} attempts due to proxy issues.`);
    }
    async executeSearch(sessionId, context, query, options, getParserMethod) {
        const parsers = options?.marketplace
            ? [this.parserRegistry.getParser(options.marketplace)]
            : this.parserRegistry.getAllParsers();
        const pages = await Promise.all(parsers.map(() => context.newPage()));
        try {
            const results = await Promise.allSettled(parsers.map(async (parser, index) => {
                const method = getParserMethod(parser);
                const result = await method(pages[index], query);
                if (!result)
                    return result;
                if (Array.isArray(result)) {
                    await this.parserPublisherService.publishProductsPreview(result, sessionId).catch((e) => {
                        this.logger.warn(`Failed to publish result: ${e.message}`);
                    });
                }
                if (typeof result === 'object') {
                    await this.parserPublisherService.publishProductDetailed(result, sessionId).catch((e) => {
                        this.logger.warn(`Failed to publish result: ${e.message}`);
                    });
                }
                return result;
            }));
            const failedResults = results.filter(r => r.status === 'rejected');
            if (failedResults.length > 0 && this.hasProxyErrors(failedResults)) {
                throw new ProxyError('Proxy connection failed');
            }
            // if (failedResults.length === results.length) {
            //     throw new AllProxyFailedError('All Proxy failed.');
            // }
            return results
                .filter((result) => result.status === 'fulfilled')
                .map(result => result.value);
        }
        finally {
            await Promise.all(pages.map(page => page.close()));
        }
    }
    formatResponse(detailedProducts) {
        const objectWithMostFeatures = detailedProducts.reduce((max, current) =>
        // @ts-ignore
        current?.features?.length > max?.features?.length ? current : max);
        const prices = detailedProducts
            .filter((result) => !!result)
            .map((product) => ({
            [product.marketplace]: {
                name: product?.name,
                price: product?.price,
                link: product?.link,
            }
        }));
        return {
            product: objectWithMostFeatures,
            prices: prices,
        };
    }
    isProxyError(error) {
        return error instanceof ProxyError ||
            error instanceof AllProxyFailedError ||
            error?.message?.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
            error?.message?.includes('ERR_PROXY_CONNECTION_FAILED');
    }
    hasProxyErrors(failedResults) {
        const networkErrors = [
            "ERR_TUNNEL_CONNECTION_FAILED",
            "ERR_PROXY_CONNECTION_FAILED"
        ];
        return failedResults.some(result => result.status === 'rejected' && networkErrors.some(value => result.reason?.message?.includes(value)));
    }
    async fetchWithRetry(parser, page, query, retries = 2) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await parser.fetchProducts(page, query);
            }
            catch (error) {
                lastError = error;
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }
        throw lastError;
    }
}
exports.default = ProductAggregatorService;
class ProxyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProxyError';
    }
}
class AllProxyFailedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AllProxyFailedError';
    }
}
