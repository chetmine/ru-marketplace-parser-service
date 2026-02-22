import ParserRegistry from "./parser/ParserRegistry";
import {MarketPlaceParser, Product, ProductPreview} from "./parser/MarketPlaceParser";
import {BrowserContext, Page} from "playwright";
import BrowserContextManager from "./BrowserContextManager";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import ParserPublisherService from "./parser/ParserPublisherService";
import SessionService, {SessionIsBusyError} from "./SessionService";


export interface SearchProductOptions {
    marketplace?: string
}

type ParserMethod<T> = (page: Page, query: string) => Promise<T>;

export default class ProductAggregatorService {

    private readonly MAX_RETRY_ATTEMPTS: number;

    private readonly parserRegistry: ParserRegistry;
    private readonly browserContextManager: BrowserContextManager;

    private readonly parserPublisherService: ParserPublisherService;
    private readonly sessionService: SessionService;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({parserRegistry, browserContextManager, parserPublisherService, sessionService, projectConfig}) {
        this.parserRegistry = parserRegistry;

        this.browserContextManager = browserContextManager;

        this.parserPublisherService = parserPublisherService;
        this.sessionService = sessionService;

        this.logger = loggerFactory(this);

        this.MAX_RETRY_ATTEMPTS = projectConfig.FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS;
    }

    public async searchProducts(
        id: string,
        query: string,
        options?: SearchProductOptions,
    ): Promise<ProductPreview[]> {
        const productsPreview = await this.executeWithRetry(
            id,
            async (context: BrowserContext) => {
                return await this.executeSearch(
                    id,
                    context,
                    query,
                    options,
                    (parser: MarketPlaceParser) => parser.fetchProducts.bind(parser),
                );
            }
        );


        return productsPreview.flat();
    }

    public async searchProductDetailed(
        id: string,
        query: string,
        options?: SearchProductOptions,
    ) {
        const products = await this.executeWithRetry(
            id,
            async (context: BrowserContext) => {
                return await this.executeSearch(
                    id,
                    context,
                    query,
                    options,
                    (parser: MarketPlaceParser) => parser.findProduct.bind(parser),
                );
            }
        );

        const objectWithMostFeatures = products.length > 0
            ? products.reduce((max, current) =>
                // @ts-ignore
                (current?.features?.length || 0) > (max?.features?.length || 0) ? current : max
            )
            : undefined;

        const prices = products
            .filter((result) => !!result)
            .map(
            (product) => {
                return {
                    // @ts-ignore
                    [product.marketplace]: {
                        name: product?.name,
                        price: product?.price,

                        link: product?.link,
                    },
                }
            }
        );

        return {
            product: objectWithMostFeatures,
            prices: prices,
        };
    }

    private async executeWithRetry<T>(
        id: string,
        executor: (context: BrowserContext) => Promise<T>,
    ): Promise<T> {

        if (!await this.sessionService.isAvailable(id)) throw new SessionIsBusyError("Session is already in use");

        const maxAttempts = this.MAX_RETRY_ATTEMPTS;

        for (let i = 0; i < maxAttempts; i++) {
            await this.sessionService.setAsBusy(id);
            const contextData = await this.browserContextManager.getContextData(id);

            try {
                const data = await executor(contextData.context);

                await this.browserContextManager.saveContext(id, contextData);
                await this.sessionService.setAsFree(id);
                return data;
            } catch (error: any) {
                if (this.isProxyError(error)) {

                    this.logger.debug(`Proxy failed in context ${id}. Reason: ${error.message}. Retrying...`)

                    await this.browserContextManager.replaceProxy(id);
                    continue;
                }
                throw error;
            } finally {
                await this.sessionService.setAsFree(id);
            }
        }

        this.logger.error(`Proxy failed in context ${id}. Too many attempts!`)
        throw new Error(`Failed after ${maxAttempts} attempts due to proxy issues.`);
    }

    private async executeSearch<T>(
        sessionId: string,
        context: BrowserContext,
        query: string,
        options: SearchProductOptions | undefined,
        getParserMethod: (parser: MarketPlaceParser) => ParserMethod<T>,
    ): Promise<T[]> {
        const parsers = options?.marketplace
            ? [this.parserRegistry.getParser(options.marketplace)]
            : this.parserRegistry.getAllParsers()
        ;

        const pages = await Promise.all(parsers.map(() => context.newPage()));

        try {
            const results = await Promise.allSettled(
                parsers.map(async (parser, index) => {
                    const method = getParserMethod(parser);
                    const result = await method(pages[index], query);

                    if (!result) return result;

                    if (Array.isArray(result)) {
                        await this.parserPublisherService.publishProductsPreview(
                            <ProductPreview[]><unknown>result,
                            sessionId
                        ).catch((e: any) => {
                            this.logger.warn(`Failed to publish result: ${e.message}`);
                        })
                    }

                    if (typeof result === 'object') {
                        await this.parserPublisherService.publishProductDetailed(
                            <Product><unknown>result,
                            sessionId
                        ).catch((e: any) => {
                            this.logger.warn(`Failed to publish result: ${e.message}`);
                        })
                    }

                    return result;
                })
            );

            const failedResults = results.filter(r => r.status === 'rejected');
            if (failedResults.length > 0 && this.hasProxyErrors(failedResults)) {
                throw new ProxyError('Proxy connection failed');
            }

            return results
                .filter((result)  => result.status === 'fulfilled')
                .map(result => result.value)
                ;
        } finally {
            await Promise.all(pages.map(page => page.close()));
        }
    }

    private formatResponse(detailedProducts: Product[]) {
        const objectWithMostFeatures = detailedProducts.reduce((max, current) =>
            // @ts-ignore
            current?.features?.length > max?.features?.length ? current : max
        );

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

    private isProxyError(error: any): boolean {
        return error instanceof ProxyError ||
            error instanceof AllProxyFailedError ||
            error?.message?.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
            error?.message?.includes('ERR_PROXY_CONNECTION_FAILED');
    }

    private hasProxyErrors(failedResults: PromiseSettledResult<any>[]) {
        const networkErrors = [
            "ERR_TUNNEL_CONNECTION_FAILED",
            "ERR_PROXY_CONNECTION_FAILED"
        ];

        return failedResults.some(
            result => result.status === 'rejected' && networkErrors.some(
                value => result.reason?.message?.includes(value)
            )
        );
    }
}

export class ProxyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProxyError';
    }
}

export class AllProxyFailedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AllProxyFailedError';
    }
}