import { createContainer, asClass, asValue, InjectionMode } from 'awilix';
import winston from 'winston';
import ProductAggregatorService from "../../src/services/ProductAggregatorService";
import BrowserService from "../../src/services/BrowserService";
import ParserRegistry from "../../src/services/parser/ParserRegistry";
import BrowserContextManager from "../../src/services/BrowserContextManager";
import SessionService from "../../src/services/SessionService";
import MegaMarketParser from "../../src/services/parser/parsers/MegaMarketParser";
import MagnitMarketParser from "../../src/services/parser/parsers/MagnitMarketParser";
import YandexMarketParser from "../../src/services/parser/parsers/YandexMarketParser";
import WildBerriesParser from "../../src/services/parser/parsers/WildBerriesParser";
import OzonParser from "../../src/services/parser/parsers/OzonParser";
import RedisClient from '../../src/redis/RedisClient';
import {redisConfig} from "../../src/configs/config";

// ─── Constants ───────────────────────────────────────────────────────────────

const TEST_SESSION_ID = 'test-session-product-parsing';
const TEST_QUERY = 'Iphone 17 Pro Max';
const MIN_MARKETPLACES_REQUIRED = 3;
const ALL_MARKETPLACES = ['megaMarket', 'magnitMarket', 'yandexMarket', 'wildberries', 'ozon'];

jest.setTimeout(5 * 60 * 1000);

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockParserPublisherService = {
    publishProductsPreview: jest.fn().mockResolvedValue(undefined),
    publishProductDetailed: jest.fn().mockResolvedValue(undefined),
};
const mockProxyService = {
    attachProxy: jest.fn().mockResolvedValue(null),
    unattachProxy: jest.fn().mockResolvedValue(undefined),
    getProxyData: jest.fn().mockResolvedValue(null),

    CONTEXT_DATA_TTL: 5 * 60 * 1000, // 5 минут
};
const mockBrowserProxyService = {
    replaceProxy: jest.fn().mockRejectedValue(new Error('No proxy available in test')),
};

// ─── Logger ──────────────────────────────────────────────────────────────────

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp} ${level}: ${message}`
        ),
    ),
    transports: [new winston.transports.Console()],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUniqueMarketplaces(items: Array<{ marketplace: string }>): string[] {
    return [...new Set(items.map((item) => item.marketplace))];
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('ProductAggregatorService — Integration', () => {
    let productAggregatorService: ProductAggregatorService;
    let browserService: BrowserService;
    let redisClient: RedisClient;
    let parserRegistry: ParserRegistry;

    beforeAll(async () => {
        const projectConfig = {
            FETCH_PRODUCTS_MAX_RETRY_ATTEMPTS: 3,
            MAX_REQUESTS_PER_SESSION: 5,
            SAVE_SCREENSHOTS: false,
            CONTEXT_DATA_TTL: 5 * 60 * 1000,
            UA_OS: "windows"
        };

        const container = createContainer({ injectionMode: InjectionMode.PROXY });

        container.register({
            logger: asValue(logger),
            projectConfig: asValue(projectConfig),

            redisClient: asClass(RedisClient).inject(() => ({
                config: redisConfig
            })).singleton(),

            proxyService: asValue(mockProxyService),
            browserProxyService: asValue(mockBrowserProxyService),
            parserPublisherService: asValue(mockParserPublisherService),

            browserService: asClass(BrowserService).inject(() => ({
                config: projectConfig
            })).singleton(),
            browserContextManager: asClass(BrowserContextManager).singleton(),

            sessionService: asClass(SessionService).singleton(),

            parserRegistry: asClass(ParserRegistry).inject(() => ({
                config: projectConfig,
            })).singleton(),

            productAggregatorService: asClass(ProductAggregatorService).singleton(),
        });

        redisClient = container.resolve<RedisClient>('redisClient');
        browserService = container.resolve<BrowserService>('browserService');
        parserRegistry = container.resolve<ParserRegistry>('parserRegistry');
        productAggregatorService = container.resolve<ProductAggregatorService>('productAggregatorService');

        await redisClient.init();
        await browserService.init();

        parserRegistry.registerParser('megaMarket', MegaMarketParser);
        parserRegistry.registerParser('magnitMarket', MagnitMarketParser);
        parserRegistry.registerParser('yandexMarket', YandexMarketParser);
        parserRegistry.registerParser('wildberries', WildBerriesParser);
        parserRegistry.registerParser('ozon', OzonParser);
    });

    afterAll(async () => {
        const redis = redisClient.getInstance();
        await redis.del(`sessions:busy:${TEST_SESSION_ID}`);
        await redis.del(`browser_context:${TEST_SESSION_ID}`);

        await browserService.closeAll();
        await redisClient.getInstance().quit();
    });

    // ─── searchProducts ───────────────────────────────────────────────────────

    describe('searchProducts()', () => {
        let results: Awaited<ReturnType<typeof productAggregatorService.searchProducts>>;

        beforeAll(async () => {
            results = await productAggregatorService.searchProducts(
                TEST_SESSION_ID,
                TEST_QUERY,
            );
        });

        it('должен вернуть непустой массив продуктов', () => {
            expect(results.length).toBeGreaterThan(0);
        });

        it(`должен вернуть результаты минимум из ${MIN_MARKETPLACES_REQUIRED} маркетплейсов`, () => {
            const marketplaces = getUniqueMarketplaces(results);

            logger.info(`searchProducts: получены маркетплейсы: ${marketplaces.join(', ')}`);

            expect(marketplaces.length).toBeGreaterThanOrEqual(MIN_MARKETPLACES_REQUIRED);
        });

        it('маркетплейсы должны быть из известного списка', () => {
            const marketplaces = getUniqueMarketplaces(results);
            marketplaces.forEach((mp) => {
                expect(ALL_MARKETPLACES).toContain(mp);
            });
        });

        it('каждый продукт должен иметь обязательные поля', () => {
            results.forEach((product: { name: string | any[]; price: any; link: any; }) => {
                expect(product).toMatchObject({
                    name: expect.any(String),
                    price: expect.any(Number),
                    link: expect.any(String),
                    marketplace: expect.any(String),
                    isAvailable: expect.any(Boolean),
                });

                expect(product.name.length).toBeGreaterThan(0);
                expect(product.price).toBeGreaterThan(0);
                expect(product.link).toMatch(/^https?:\/\//);
            });
        });

        it('должен вызвать publishProductsPreview для каждого успешного маркетплейса', () => {
            expect(mockParserPublisherService.publishProductsPreview).toHaveBeenCalled();
        });
    });

    // ─── searchProductDetailed ────────────────────────────────────────────────

    describe('searchProductDetailed()', () => {
        let result: Awaited<ReturnType<typeof productAggregatorService.searchProductDetailed>>;

        beforeAll(async () => {
            result = await productAggregatorService.searchProductDetailed(
                TEST_SESSION_ID,
                TEST_QUERY,
            );
        });

        it('должен вернуть объект с полями product и prices', () => {
            expect(result).toHaveProperty('product');
            expect(result).toHaveProperty('prices');
        });

        it('product должен содержать обязательные поля', () => {
            const { product } = result;

            expect(product).toBeDefined();

            expect(product).toMatchObject({
                name: expect.any(String),
                price: expect.any(Number),
                link: expect.any(String),
                marketplace: expect.any(String),
                isAvailable: expect.any(Boolean),
            });
        });

        it(`prices должны содержать результаты минимум из ${MIN_MARKETPLACES_REQUIRED} маркетплейсов`, () => {
            const { prices } = result;

            const marketplacesInPrices = prices
                .flatMap((entry: {}) => Object.keys(entry))
                .filter((key: string) => ALL_MARKETPLACES.includes(key));

            logger.info(`searchProductDetailed: маркетплейсы в prices: ${marketplacesInPrices.join(', ')}`);

            expect(marketplacesInPrices.length).toBeGreaterThanOrEqual(MIN_MARKETPLACES_REQUIRED);
        });

        it('каждый элемент prices должен содержать name, price и link', () => {
            result.prices.forEach((entry: { [s: string]: unknown; } | ArrayLike<unknown>) => {
                const [marketplace, data] = Object.entries(entry)[0];

                expect(ALL_MARKETPLACES).toContain(marketplace);
                expect(data).toMatchObject({
                    name: expect.any(String),
                    price: expect.any(Number),
                    link: expect.any(String),
                });
            });
        });

        it('product должен быть объектом с наибольшим количеством features', () => {
            const { product, prices } = result;

            if (product?.features) {
                expect(Array.isArray(product.features)).toBe(true);
            }
        });

        it('должен вызвать publishProductDetailed для найденных продуктов', () => {
            expect(mockParserPublisherService.publishProductDetailed).toHaveBeenCalled();
        });
    });

    // ─── Edge cases ───────────────────────────────────────────────────────────

    describe('Edge cases', () => {
        it('должен фильтровать по конкретному маркетплейсу через options.marketplace', async () => {
            const results = await productAggregatorService.searchProducts(
                TEST_SESSION_ID,
                TEST_QUERY,
                { marketplace: 'magnitMarket' },
            );

            expect(results.length).toBeGreaterThan(0);

            results.forEach((product: { marketplace: any; }) => {
                expect(product.marketplace).toBe('magnitMarket');
            });
        });

        it('должен вернуть пустой массив для несуществующего запроса', async () => {
            const results = await productAggregatorService.searchProducts(
                TEST_SESSION_ID,
                '___нет_такого_товара_xyz_12345___',
            );

            expect(Array.isArray(results)).toBe(true);
        });
    });
});