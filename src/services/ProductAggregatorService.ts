import ParserRegistry from "./parser/ParserRegistry";
import {MarketPlaceParser, Product, ProductPreview} from "./parser/MarketPlaceParser";
import {BrowserContext, Page} from "playwright";
import ProxyService from "./proxy/ProxyService";
import BrowserService from "./BrowserService";
import BrowserContextManager from "./BrowserContextManager";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";


export interface SearchProductOptions {
    marketplace?: string
}

type ParserMethod<T> = (page: Page, query: string) => Promise<T>;

export default class ProductAggregatorService {

    private readonly parserRegistry: ParserRegistry;
    private readonly browserContextManager: BrowserContextManager;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({parserRegistry, browserContextManager}) {
        this.parserRegistry = parserRegistry;

        this.browserContextManager = browserContextManager;

        this.logger = loggerFactory(this);
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
                    context,
                    query,
                    options,
                    (parser: MarketPlaceParser) => parser.findProduct.bind(parser),
                );
            }
        );

        const objectWithMostFeatures = products.reduce((max, current) =>
            // @ts-ignore
            current?.features?.length > max?.features?.length ? current : max
        );

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

        const maxAttempts = 3;

        for (let i = 0; i < maxAttempts; i++) {
            const context = await this.browserContextManager.getContext(id);

            try {
                const data = await executor(context);

                await this.browserContextManager.saveContext(id, context);
                return data;
            } catch (error: any) {
                if (this.isProxyError(error)) {

                    this.logger.debug(`Proxy failed in context ${id}. Reason: ${error.message}. Retrying...`)

                    await this.browserContextManager.replaceProxy(id);
                    continue;
                }
                throw error;
            }
        }

        this.logger.error(`Proxy failed in context ${id}. Too many attempts!`)
        throw new Error(`Failed after ${maxAttempts} attempts due to proxy issues.`);
    }

    private async executeSearch<T>(
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
                parsers.map((parser, index) => {
                    const method = getParserMethod(parser);
                    return method(pages[index], query);
                })
            );

            const failedResults = results.filter(r => r.status === 'rejected');
            if (failedResults.length > 0 && this.hasProxyErrors(failedResults)) {
                throw new ProxyError('Proxy connection failed');
            }
            if (failedResults.length === results.length) {
                throw new AllProxyFailedError('All Proxy failed.');
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

    private async fetchWithRetry(
        parser: MarketPlaceParser,
        page: Page,
        query: string,
        retries: number = 2
    ): Promise<ProductPreview[]> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await parser.fetchProducts(page, query);
            } catch (error: any) {
                lastError = error as Error;
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }

        throw lastError;
    }
}

class ProxyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProxyError';
    }
}

class AllProxyFailedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AllProxyFailedError';
    }
}