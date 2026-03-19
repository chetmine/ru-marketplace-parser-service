

// ─── Helpers ─────────────────────────────────────────────────────────────────

import {Product, ProductPreview} from "../../../src/services/parser/MarketPlaceParser";
import {BrowserContext, Page} from "playwright";
import ProductAggregatorService, {
    ProxyError
} from "../../../src/services/ProductAggregatorService";
import {SessionIsBusyError} from "../../../src/services/SessionService";

function makeProductPreview(marketplace: string): ProductPreview {
    return {
        name: `Test Product ${marketplace}`,
        price: 1000,
        link: `https://${marketplace}.ru/product/1`,
        isAvailable: true,
        marketplace,
    };
}

function makeProduct(marketplace: string, featuresCount = 0): Product {
    return {
        name: `Test Product ${marketplace}`,
        price: 1000,
        link: `https://${marketplace}.ru/product/1`,
        isAvailable: true,
        marketplace,
        features: Array.from({ length: featuresCount }, (_, i) => ({
            name: `feature_${i}`,
            value: `value_${i}`,
        })),
    };
}

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeSessionService(isAvailable = true) {
    return {
        isAvailable: jest.fn().mockResolvedValue(isAvailable),
        setAsBusy: jest.fn().mockResolvedValue(undefined),
        setAsFree: jest.fn().mockResolvedValue(undefined),
    };
}

function makeBrowserContextManager(mockPage: Partial<Page> = {}) {
    const mockContext = {
        newPage: jest.fn().mockResolvedValue({
            ...mockPage,
            close: jest.fn(),
        }),
    } as unknown as BrowserContext;

    return {
        getContextData: jest.fn().mockResolvedValue({ context: mockContext }),
        saveContext: jest.fn().mockResolvedValue(undefined),
        replaceProxy: jest.fn().mockResolvedValue(mockContext),
    };
}

function makeParserRegistry(parsers: Record<string, any>) {
    return {
        getParser: jest.fn((name: string) => parsers[name]),
        getAllParsers: jest.fn(() => Object.values(parsers)),
    };
}

function makeParserPublisherService() {
    return {
        publishProductsPreview: jest.fn().mockResolvedValue(undefined),
        publishProductDetailed: jest.fn().mockResolvedValue(undefined),
    };
}

function makeService(overrides: {
    parserRegistry?: any;
    browserContextManager?: any;
    parserPublisherService?: any;
    sessionService?: any;
    maxRetryAttempts?: number;
}) {
    return new ProductAggregatorService({
        parserRegistry: overrides.parserRegistry ?? makeParserRegistry({}),
        browserContextManager: overrides.browserContextManager ?? makeBrowserContextManager(),
        parserPublisherService: overrides.parserPublisherService ?? makeParserPublisherService(),
        sessionService: overrides.sessionService ?? makeSessionService(),
        projectConfig: {
            FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS: overrides.maxRetryAttempts ?? 3,
        },
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProductAggregatorService — unit', () => {

    // ── SessionIsBusyError ───────────────────────────────────────────────────

    describe('executeWithRetry — сессия занята', () => {
        it('должен выбросить SessionIsBusyError если сессия недоступна', async () => {
            const service = makeService({
                sessionService: makeSessionService(false),
            });

            await expect(
                service.searchProducts('session-1', 'iPhone 15')
            ).rejects.toThrow(SessionIsBusyError);
        });
    });

    describe('executeWithRetry — retry при proxy-ошибках', () => {
        it('должен сделать retry при ERR_TUNNEL_CONNECTION_FAILED и в итоге вернуть данные', async () => {
            const mockPage = {} as Page;
            const browserContextManager = makeBrowserContextManager(mockPage);

            const preview = makeProductPreview('ozon');

            const fetchProducts = jest.fn()
                .mockRejectedValueOnce(new Error('ERR_TUNNEL_CONNECTION_FAILED'))
                .mockResolvedValueOnce([preview]);

            const parserRegistry = makeParserRegistry({
                ozon: { fetchProducts, findProduct: jest.fn() },
            });

            const service = makeService({ parserRegistry, browserContextManager });

            const results = await service.searchProducts('session-1', 'iPhone 15', { marketplace: 'ozon' });

            expect(fetchProducts).toHaveBeenCalledTimes(2);
            expect(browserContextManager.replaceProxy).toHaveBeenCalledTimes(1);
            expect(results).toEqual([preview]);
        });

        it('должен сделать retry при ERR_PROXY_CONNECTION_FAILED', async () => {
            const mockPage = {} as Page;
            const browserContextManager = makeBrowserContextManager(mockPage);

            const preview = makeProductPreview('wildberries');

            const fetchProducts = jest.fn()
                .mockRejectedValueOnce(new Error('ERR_PROXY_CONNECTION_FAILED'))
                .mockResolvedValueOnce([preview]);

            const parserRegistry = makeParserRegistry({
                wildberries: { fetchProducts, findProduct: jest.fn() },
            });

            const service = makeService({ parserRegistry, browserContextManager });

            const results = await service.searchProducts('session-1', 'iPhone 15', { marketplace: 'wildberries' });

            expect(fetchProducts).toHaveBeenCalledTimes(2);
            expect(results).toEqual([preview]);
        });

        it('должен выбросить ошибку после исчерпания всех попыток', async () => {
            const proxyError = new Error('ERR_TUNNEL_CONNECTION_FAILED');

            const fetchProducts = jest.fn().mockRejectedValue(proxyError);

            const parserRegistry = makeParserRegistry({
                ozon: { fetchProducts, findProduct: jest.fn() },
            });

            const service = makeService({
                parserRegistry,
                maxRetryAttempts: 3,
            });

            await expect(
                service.searchProducts('session-1', 'iPhone 15', { marketplace: 'ozon' })
            ).rejects.toThrow('Failed after 3 attempts due to proxy issues.');

            expect(fetchProducts).toHaveBeenCalledTimes(3);
        });
    });

    // ── searchProducts ───────────────────────────────────────────────────────

    describe('searchProducts()', () => {
        it('должен вернуть объединённый массив из всех парсеров', async () => {
            const mockPage = {} as Page;

            const previews = {
                ozon: [makeProductPreview('ozon')],
                wildberries: [makeProductPreview('wildberries'), makeProductPreview('wildberries')],
            };

            const parserRegistry = makeParserRegistry({
                ozon: { fetchProducts: jest.fn().mockResolvedValue(previews.ozon) },
                wildberries: { fetchProducts: jest.fn().mockResolvedValue(previews.wildberries) },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const results = await service.searchProducts('session-1', 'iPhone 15');

            expect(results).toHaveLength(3);
            expect(results).toEqual(expect.arrayContaining([
                ...previews.ozon,
                ...previews.wildberries,
            ]));
        });

        it('должен вернуть только результаты указанного маркетплейса при options.marketplace', async () => {
            const mockPage = {} as Page;
            const preview = makeProductPreview('ozon');

            const ozonFetch = jest.fn().mockResolvedValue([preview]);
            const wbFetch = jest.fn().mockResolvedValue([makeProductPreview('wildberries')]);

            const parserRegistry = makeParserRegistry({
                ozon: { fetchProducts: ozonFetch },
                wildberries: { fetchProducts: wbFetch },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const results = await service.searchProducts('session-1', 'iPhone 15', { marketplace: 'ozon' });

            expect(ozonFetch).toHaveBeenCalledTimes(1);
            expect(wbFetch).not.toHaveBeenCalled();
            expect(results).toEqual([preview]);
        });

        it('должен игнорировать rejected результаты без proxy-ошибок и вернуть успешные', async () => {
            const mockPage = {} as Page;
            const preview = makeProductPreview('ozon');

            const parserRegistry = makeParserRegistry({
                ozon: { fetchProducts: jest.fn().mockResolvedValue([preview]) },
                wildberries: { fetchProducts: jest.fn().mockRejectedValue(new Error('Parser timeout')) },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const results = await service.searchProducts('session-1', 'iPhone 15');

            expect(results).toEqual([preview]);
        });
    });

    // ── searchProductDetailed ────────────────────────────────────────────────

    describe('searchProductDetailed()', () => {
        it('должен выбрать продукт с наибольшим количеством features', async () => {
            const mockPage = {} as Page;

            const poorProduct = makeProduct('wildberries', 1);
            const richProduct = makeProduct('ozon', 5);

            const parserRegistry = makeParserRegistry({
                wildberries: { findProduct: jest.fn().mockResolvedValue(poorProduct) },
                ozon: { findProduct: jest.fn().mockResolvedValue(richProduct) },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const result = await service.searchProductDetailed('session-1', 'iPhone 15');

            expect(result.product).toEqual(richProduct);
            expect(result.product?.features).toHaveLength(5);
        });

        it('должен собрать prices из всех маркетплейсов', async () => {
            const mockPage = {} as Page;

            const wbProduct = makeProduct('wildberries', 1);
            const ozonProduct = makeProduct('ozon', 2);

            wbProduct.price = 900;
            ozonProduct.price = 1100;

            const parserRegistry = makeParserRegistry({
                wildberries: { findProduct: jest.fn().mockResolvedValue(wbProduct) },
                ozon: { findProduct: jest.fn().mockResolvedValue(ozonProduct) },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const result = await service.searchProductDetailed('session-1', 'iPhone 15');

            expect(result.prices).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ wildberries: expect.objectContaining({ price: 900 }) }),
                    expect.objectContaining({ ozon: expect.objectContaining({ price: 1100 }) }),
                ])
            );
        });

        it('должен вернуть product = null если все парсеры вернули null', async () => {
            const mockPage = {} as Page;

            const parserRegistry = makeParserRegistry({
                ozon: { findProduct: jest.fn().mockResolvedValue(null) },
                wildberries: { findProduct: jest.fn().mockResolvedValue(null) },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const result = await service.searchProductDetailed('session-1', 'nonexistent product');

            expect(result.product).toBeNull();
            expect(result.prices).toEqual([]);
        });

        it('должен включить в prices только ненулевые результаты', async () => {
            const mockPage = {} as Page;

            const ozonProduct = makeProduct('ozon', 3);

            const parserRegistry = makeParserRegistry({
                ozon: { findProduct: jest.fn().mockResolvedValue(ozonProduct) },
                wildberries: { findProduct: jest.fn().mockResolvedValue(null) },
            });

            const service = makeService({
                parserRegistry,
                browserContextManager: makeBrowserContextManager(mockPage),
            });

            const result = await service.searchProductDetailed('session-1', 'iPhone 15');

            expect(result.prices).toHaveLength(1);
            expect(result.prices[0]).toHaveProperty('ozon');
        });
    });

    // ── isProxyError ─────────────────────────────────────────────────────────

    describe('isProxyError()', () => {
        let isProxyError: (error: any) => boolean;

        beforeAll(() => {
            const service = makeService({}) as any;
            isProxyError = service.isProxyError.bind(service);
        });

        it('должен вернуть true для экземпляра ProxyError', () => {
            expect(isProxyError(new ProxyError('proxy failed'))).toBe(true);
        });

        it('должен вернуть true для Error с ERR_TUNNEL_CONNECTION_FAILED', () => {
            expect(isProxyError(new Error('ERR_TUNNEL_CONNECTION_FAILED'))).toBe(true);
        });

        it('должен вернуть true для Error с ERR_PROXY_CONNECTION_FAILED', () => {
            expect(isProxyError(new Error('ERR_PROXY_CONNECTION_FAILED'))).toBe(true);
        });

        it('должен вернуть false для обычной ошибки', () => {
            expect(isProxyError(new Error('Parser timeout'))).toBe(false);
        });

        it('должен вернуть false для null', () => {
            expect(isProxyError(null)).toBeFalsy()
        });
    });

    // ── hasProxyErrors ───────────────────────────────────────────────────────

    describe('hasProxyErrors()', () => {
        let hasProxyErrors: (results: PromiseSettledResult<any>[]) => boolean;

        beforeAll(() => {
            const service = makeService({}) as any;
            hasProxyErrors = service.hasProxyErrors.bind(service);
        });

        function rejected(message: string): PromiseRejectedResult {
            return { status: 'rejected', reason: new Error(message) };
        }

        function fulfilled(value: any = null): PromiseFulfilledResult<any> {
            return { status: 'fulfilled', value };
        }

        it('должен вернуть true если хотя бы один rejected содержит ERR_TUNNEL_CONNECTION_FAILED', () => {
            expect(hasProxyErrors([
                fulfilled(),
                rejected('ERR_TUNNEL_CONNECTION_FAILED'),
            ])).toBe(true);
        });

        it('должен вернуть true если хотя бы один rejected содержит ERR_PROXY_CONNECTION_FAILED', () => {
            expect(hasProxyErrors([
                rejected('ERR_PROXY_CONNECTION_FAILED'),
            ])).toBe(true);
        });

        it('должен вернуть false если все rejected содержат обычные ошибки', () => {
            expect(hasProxyErrors([
                rejected('Parser timeout'),
                rejected('Element not found'),
            ])).toBe(false);
        });

        it('должен вернуть false если массив пустой', () => {
            expect(hasProxyErrors([])).toBe(false);
        });

        it('должен вернуть false если все результаты fulfilled', () => {
            expect(hasProxyErrors([fulfilled('data'), fulfilled('more data')])).toBe(false);
        });
    });
});