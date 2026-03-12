import ParserRegistry from "./parser/ParserRegistry";
import {CaptchaError, MarketPlaceParser, Product, ProductPreview} from "./parser/MarketPlaceParser";
import {BrowserContext, Page} from "playwright";
import BrowserContextManager from "./BrowserContextManager";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import ParserPublisherService from "./parser/ParserPublisherService";
import SessionService, {SessionIsBusyError} from "./SessionService";
import ProductCacheService from "./ProductCacheService";


export interface SearchProductOptions {
    marketplace?: string
    retryOnParserExposed?: boolean
    denyMessagePublishing?: boolean
}

// interface ExcludedParsersData {
//     sessionId: string,
//     parsers: string[]
// }

type ParserMethod<T> = (page: Page, query: string) => Promise<T>;

export default class ProductAggregatorService {
    private readonly MAX_RETRY_ATTEMPTS: number;

    private readonly parserRegistry: ParserRegistry;
    private readonly browserContextManager: BrowserContextManager;

    private readonly parserPublisherService: ParserPublisherService;
    protected readonly productCacheService: ProductCacheService;
    private readonly sessionService: SessionService;

    private readonly logger: Logger;

    private excludedParsersData = new Map<string, string[]>();

    // @ts-ignore
    constructor({parserRegistry, browserContextManager, parserPublisherService, sessionService, projectConfig, productCacheService}) {
        this.parserRegistry = parserRegistry;

        this.browserContextManager = browserContextManager;

        this.parserPublisherService = parserPublisherService;
        this.productCacheService = productCacheService;
        this.sessionService = sessionService;

        this.logger = loggerFactory(this);

        this.MAX_RETRY_ATTEMPTS = projectConfig.FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS;
    }

    public async searchProducts(
        id: string,
        query: string,
        options?: SearchProductOptions,
    ): Promise<ProductPreview[][]> {

        const cached = await this.productCacheService.getPreview(query, options?.marketplace);
        if (cached) {

            if (!options?.denyMessagePublishing) {
                for (const marketplacePreviews of cached) {
                    await this.parserPublisherService.publishProductsPreview(
                        <ProductPreview[]><unknown>marketplacePreviews,
                        id,
                    ).catch((e: any) => {
                        this.logger.warn(`Failed to publish result: ${e.message}`);
                    })
                }

                await this.parserPublisherService.publishParsingFinished(id);
            }

            this.logger.debug(`Cache HIT for searchProducts: "${query}"`);
            return cached;
        }

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
            },
            options
        );

        if (this.hasAllMarketplaces(productsPreview.flat())) {
            await this.productCacheService.setPreview(query, productsPreview, options?.marketplace);
        }
        return productsPreview;
    }

    public async searchProductDetailed(
        id: string,
        query: string,
        options?: SearchProductOptions,
    ) {

        const cached = await this.productCacheService.getDetailed(query, options?.marketplace);
        if (cached) {

            const allItems = [cached.product, ...cached.products];

            if (!options?.denyMessagePublishing) {
                for (const item of allItems) {
                    await this.parserPublisherService.publishProductDetailed(
                        <Product><unknown>item,
                        id,
                    ).catch((e: any) => {
                        this.logger.warn(`Failed to publish result: ${e.message}`);
                    })
                }
                await this.parserPublisherService.publishParsingFinished(id);
            }

            this.logger.debug(`Cache HIT for searchProductDetailed: "${query}"`);
            return cached;
        }

        const cachedPreviews = await this.productCacheService.getPreview(query, options?.marketplace)
            || await this.searchProducts(id, query, { ...options, denyMessagePublishing: true })
        ;

        const products = await this.executeWithRetry(
            id,
            async (context: BrowserContext) => {
                return await this.executeSearch(
                    id,
                    context,
                    query,
                    options,
                    (parser: MarketPlaceParser) =>
                        (page: Page, q: string) => parser.findProduct(page, q, cachedPreviews
                            .filter(pp => pp[0].marketplace === parser.getName())
                            .flat()
                        ),
                );
            },
            options
        );

        const objectWithMostFeatures = products.length > 0
            ? products.reduce((max, current) =>
                // @ts-ignore
                (current?.features?.length || 0) > (max?.features?.length || 0) ? current : max
            )
            : undefined;

        // const prices = products
        //     .filter((result) => !!result)
        //     .map(
        //     (product) => {
        //         return {
        //             // @ts-ignore
        //             [product.marketplace]: {
        //                 name: product?.name,
        //                 price: product?.price,
        //
        //                 link: product?.link,
        //             },
        //         }
        //     }
        // );

        const filteredProducts = products.filter(product => product?.marketplace !== objectWithMostFeatures?.marketplace);



        const result = { product: objectWithMostFeatures, products: filteredProducts };

        if (this.hasAllMarketplaces(products.filter(p => !!p))) {
            await this.productCacheService.setDetailed(query, result);
        }

        return {
            product: objectWithMostFeatures,
            products: filteredProducts,
        };
    }

    private async executeWithRetry<T>(
        id: string,
        executor: (context: BrowserContext) => Promise<T>,
        options?: SearchProductOptions,
    ): Promise<T> {

        if (!await this.sessionService.isAvailable(id)) throw new SessionIsBusyError("Session is already in use");

        this.excludedParsersData.delete(id);
        const maxAttempts = this.MAX_RETRY_ATTEMPTS;

        for (let i = 0; i < maxAttempts; i++) {
            await this.sessionService.setAsBusy(id);
            const contextData = await this.browserContextManager.getContextData(id);

            try {
                const data = await executor(contextData.context);

                await this.browserContextManager.saveContext(id, contextData);
                await this.sessionService.setAsFree(id);

                this.excludedParsersData.delete(id);
                if (!options?.denyMessagePublishing) await this.parserPublisherService.publishParsingFinished(id);

                return data;
            } catch (error: any) {
                if (this.isProxyError(error)) {
                    this.logger.debug(`Proxy failed in context ${id}. Reason: ${error.message}. Retrying...`)

                    await this.browserContextManager.replaceProxy(id);
                    continue;
                }

                if (options?.retryOnParserExposed && error instanceof ParserExposedError) {
                    this.logger.debug(`Parser exposed in context ${id}. Reason: ${error.message}. Retrying...`)

                    await this.browserContextManager.replaceContext(id);
                    continue;
                }

                this.excludedParsersData.delete(id);
                throw error;
            } finally {
                await this.sessionService.setAsFree(id);
            }
        }

        this.excludedParsersData.delete(id);
        this.logger.error(`Parsing failed in context ${id}. Too many attempts!`)
        throw new Error(`Failed after ${maxAttempts} attempts due to parsing issues.`);
    }

    private async executeSearch<T>(
        sessionId: string,
        context: BrowserContext,
        query: string,
        options: SearchProductOptions | undefined,
        getParserMethod: (parser: MarketPlaceParser) => ParserMethod<T>,
    ): Promise<T[]> {
        let parsers = options?.marketplace
            ? [this.parserRegistry.getParser(options.marketplace)]
            : this.parserRegistry.getAllParsers()
        ;

        const excludedParsers = this.excludedParsersData.get(sessionId);

        if (excludedParsers?.length) {
            parsers = parsers.filter(parser => !excludedParsers.includes(parser.getName()))
        }

        const pages = await Promise.all(parsers.map(() => context.newPage()));

        try {

            const succeededMarketplaceNames: string[] = [];

            const results = await Promise.allSettled(
                parsers.map(async (parser, index) => {
                    try {
                        const method = getParserMethod(parser);
                        const result = await method(pages[index], query);

                        if (!succeededMarketplaceNames.find(name => name === parser.getName())) succeededMarketplaceNames.push(parser.getName());

                        if (Array.isArray(result) && !options?.denyMessagePublishing) {
                            this.logger.debug(`Published parser products ${result.length} to message-broker`);

                            await this.parserPublisherService.publishProductsPreview(
                                <ProductPreview[]><unknown>result,
                                sessionId,
                            ).catch((e: any) => {
                                this.logger.warn(`Failed to publish result: ${e.message}`);
                            })

                            return result;
                        }

                        if (typeof result === 'object' && !options?.denyMessagePublishing) {

                            this.logger.debug(`Published parser result to message-broker`);

                            await this.parserPublisherService.publishProductDetailed(
                                <Product><unknown>result,
                                sessionId,
                            ).catch((e: any) => {
                                this.logger.warn(`Failed to publish result: ${e.message}`);
                            })

                            return result;
                        }

                        return result;

                    } catch (e: any) {
                        this.logger.warn(`Parser failed: ${e.message}`);
                        throw e;
                    }
                })
            );

            this.logger.debug(`Succeeded parser results: ${succeededMarketplaceNames}`);

            // this.logger.debug(`excludedParsersData Data before: ${this.excludedParsersData.get(sessionId)}`);
            this.excludedParsersData.set(sessionId, [...new Set([...this.excludedParsersData.get(sessionId) || [], ...succeededMarketplaceNames])])
            // this.logger.debug(`excludedParsersData Data after: ${this.excludedParsersData.get(sessionId)}`);

            const failedResults = results.filter(r => r.status === 'rejected');
            if (failedResults.length > 0 && this.hasProxyErrors(failedResults)) {
                throw new ProxyError('Proxy connection failed');
            }
            if (options?.retryOnParserExposed && failedResults.length > 0 && this.hasCaptchaErrors(failedResults)) {
                throw new ParserExposedError('Captcha detected or Parser exposed.');
            }

            return results
                .filter((result)  => result.status === 'fulfilled')
                .map(result => result.value)
                ;
        } finally {
            await Promise.all(pages.map(page => page.close()));
        }
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

    private hasCaptchaErrors(failedResults: PromiseSettledResult<any>[]) {
        return failedResults.some(
            result => result.status === 'rejected' && result.reason instanceof CaptchaError
        );
    }

    private hasAllMarketplaces(products: Product[] | ProductPreview[]) {
        const marketplaces = this.parserRegistry.getParserNames();

        const existingMarketplaces = new Set(products.map(p => p.marketplace));
        return marketplaces.every(m => existingMarketplaces.has(m));
    }
}

export class ProxyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProxyError';
    }
}

export class ParserExposedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ParserExposedError';
    }
}

export class AllProxyFailedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AllProxyFailedError';
    }
}