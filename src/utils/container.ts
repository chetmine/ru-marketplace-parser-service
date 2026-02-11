import winston, {createLogger, level, Logger} from 'winston'
import {asClass, asValue, createContainer, InjectionMode} from 'awilix'
import App from "../App";
import WebServer from "../WebServer";
import {redisConfig, webServerConfig} from "../configs/config";
import ProductController from "../controllers/ProductController";
import ProductRoutes from "../routes/ProductRoutes";
import RedisClient from "../redis/RedisClient";
import BrowserService from "../services/BrowserService";
import OzonParser from "../services/parser/parsers/OzonParser";
import WildBerriesParser from "../services/parser/parsers/WildBerriesParser";
import ProductAggregatorService from "../services/ProductAggregatorService";
import ParserRegistry from "../services/parser/ParserRegistry";
import ProductSearchService from "../services/ProductSearchService";
import PrismaService from "../services/PrismaService";
import ProxyDataRepo from "../repo/proxy/ProxyDataRepo";
import ProxyRepo from "../repo/proxy/ProxyRepo";
import ProxyService from "../services/ProxyService";
import ProxyScheduler from "../jobs/ProxyScheduler";
import AuthMiddleware from "../middleware/AuthMiddleware";
import ProxyController from "../controllers/ProxyController";
import ProxyRoutes from "../routes/ProxyRoutes";
import { EventEmitter } from 'events'
import ProxyHandler from "../handlers/ProxyHandler";

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.printf(({ timestamp, level, message, className, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        }),
    ),
    transports: [new winston.transports.Console()]
});


export const container = createContainer({
    injectionMode: InjectionMode.PROXY,
});

export function registerContainer() {
    container.register({
        logger: asValue(logger),

        eventBus: asValue(new EventEmitter()),

        app: asClass(App).singleton(),

        webServer: asClass(WebServer).inject(() => ({
            config: webServerConfig,
        })).singleton(),

        redisClient: asClass(RedisClient).inject(() => ({
            config: redisConfig,
        })).singleton(),

        authMiddleware: asClass(AuthMiddleware).singleton(),

        prismaService: asClass(PrismaService).singleton(),

        proxyController: asClass(ProxyController).singleton(),
        proxyRoutes: asClass(ProxyRoutes).singleton(),

        proxyDataRepo: asClass(ProxyDataRepo).singleton(),
        proxyRepo: asClass(ProxyRepo).singleton(),

        proxyService: asClass(ProxyService).singleton(),
        proxyScheduler: asClass(ProxyScheduler).singleton(),
        proxyHandler: asClass(ProxyHandler).singleton(),

        browserService: asClass(BrowserService).singleton(),

        parserRegistry: asClass(ParserRegistry).singleton(),
        productAggregatorService: asClass(ProductAggregatorService).singleton(),

        //productSearchService: asClass(ProductSearchService).singleton(),

        ozonParser: asClass(OzonParser).singleton(),
        wildBerriesParser: asClass(WildBerriesParser).singleton(),

        productController: asClass(ProductController).singleton(),
        productRoutes: asClass(ProductRoutes).singleton(),
    });
}



