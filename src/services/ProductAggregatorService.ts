import ParserRegistry from "./parser/ParserRegistry";
import {MarketPlaceParser, Product, ProductPreview} from "./parser/MarketPlaceParser";
import {BrowserContext, Page} from "playwright";
import ProxyService from "./ProxyService";
import BrowserService from "./BrowserService";



export interface SearchProductOptions {
    marketplace?: string
}

export default class ProductAggregatorService {

    private readonly parserRegistry: ParserRegistry;
    private readonly proxyService: ProxyService;
    private readonly browserService: BrowserService;

    // @ts-ignore
    constructor({parserRegistry, proxyService, browserService}) {
        this.parserRegistry = parserRegistry;
        this.proxyService = proxyService
        this.browserService = browserService;
    }

    public async searchProducts(
        context: BrowserContext,
        id: string,
        query: string,
        options?: SearchProductOptions,
    ): Promise<ProductPreview[]> {
        const parsers = options?.marketplace
            ? [this.parserRegistry.getParser(options.marketplace)]
            : this.parserRegistry.getAllParsers()
        ;

        const pages = await Promise.all(parsers.map(() => context.newPage()))

        const results = await Promise.allSettled(
            parsers.map((parser, index) => {
                return this.fetchWithRetry(parser, pages[index], query)
            })
        );

        await this.checkForProxyErrors(id, results.filter(result => result.status === 'rejected'));

        pages.forEach(page => {page.close()})

        return results
            .filter((result) => result.status === 'fulfilled')
            .flatMap(result => result.value)
        ;
    }

    public async searchProductDetailed(
        id: string,
        context: BrowserContext,
        query: string,
        options?: SearchProductOptions,
    ) {
        const parsers = options?.marketplace
            ? [this.parserRegistry.getParser(options.marketplace)]
            : this.parserRegistry.getAllParsers()
        ;
        const pages = await Promise.all(parsers.map(() => context.newPage()))

        const results = await Promise.allSettled(
            parsers.map((parser, index) => {
                return parser.findProduct(pages[index], query)
            })
        );

        await this.checkForProxyErrors(id, results.filter(result => result.status === 'rejected'));

        const detailedProducts = results
            .filter((result) => result.status === 'fulfilled')
            .flatMap(result => result.value)
        ;


        const objectWithMostFeatures = detailedProducts.reduce((max, current) =>
            // @ts-ignore
            current?.features?.length > max?.features?.length ? current : max
        );

        pages.forEach(page => {page.close()})

        const prices = detailedProducts
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

    private async checkForProxyErrors(id: string, failedResults: PromiseSettledResult<any>[]) {
        const networkErrors = [
            "ERR_TUNNEL_CONNECTION_FAILED",
            'ERR_TIMED_OUT'
        ];

        const isNetworkError = failedResults.find(
            result => result.status === 'rejected' && networkErrors.some(
                value => result.reason?.message?.includes(value)
            )
        );

        if (!isNetworkError) return;

        await this.proxyService.replaceProxyById(id);
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