import winston from 'winston'
import {asClass, asValue, createContainer, InjectionMode} from 'awilix'
import App from "../App";
import WebServer from "../WebServer";
import {productCacheConfig, projectConfig, rabbitMQConfig, redisConfig, webServerConfig} from "../configs/config";
import ProductController from "../controllers/ProductController";
import ProductRoutes from "../routes/ProductRoutes";
import RedisClient from "../redis/RedisClient";
import BrowserService from "../services/BrowserService";
import OzonParser from "../services/parser/parsers/OzonParser";
import WildBerriesParser from "../services/parser/parsers/WildBerriesParser";
import ProductAggregatorService from "../services/ProductAggregatorService";
import ParserRegistry from "../services/parser/ParserRegistry";
import PrismaService from "../services/PrismaService";
import ProxyDataRepo from "../repo/proxy/ProxyDataRepo";
import ProxyRepo from "../repo/proxy/ProxyRepo";
import ProxyService from "../services/proxy/ProxyService";
import ProxyScheduler from "../jobs/ProxyScheduler";
import AuthMiddleware from "../middleware/AuthMiddleware";
import ProxyController from "../controllers/ProxyController";
import ProxyRoutes from "../routes/ProxyRoutes";
import { EventEmitter } from 'events'
import ProxyHandler from "../handlers/ProxyHandler";
import BrowserProxyService from "../services/proxy/BrowserProxyService";
import BrowserContextManager from "../services/BrowserContextManager";
import RabbitMQConnection from "../infrastructure/rabbitmq/RabbitMQConnection";
import RabbitMQPublisher from "../infrastructure/rabbitmq/RabbitMQPublisher";
import ParserPublisherService from "../services/parser/ParserPublisherService";
import SessionService from "../services/SessionService";
import BrowserRoutes from "../routes/BrowserRoutes";
import BrowserController from "../controllers/BrowserController";
import TaskConsumer from "../services/parser/consumer/TaskConsumer";
import TaskHandler from "../services/parser/consumer/TaskHandler";
import ProductCacheService from "../services/ProductCacheService";

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
        projectConfig: asValue(projectConfig),

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

        rabbitMQConnection: asClass(RabbitMQConnection).inject(() => ({
            config: rabbitMQConfig,
        })).singleton(),
        rabbitMQPublisher: asClass(RabbitMQPublisher).singleton(),

        proxyController: asClass(ProxyController).singleton(),
        proxyRoutes: asClass(ProxyRoutes).singleton(),

        proxyDataRepo: asClass(ProxyDataRepo).singleton(),
        proxyRepo: asClass(ProxyRepo).singleton(),

        browserProxyService: asClass(BrowserProxyService).singleton(),
        proxyService: asClass(ProxyService).singleton(),
        proxyScheduler: asClass(ProxyScheduler).singleton(),
        proxyHandler: asClass(ProxyHandler).singleton(),

        browserContextManager: asClass(BrowserContextManager).singleton(),
        browserService: asClass(BrowserService).singleton(),

        sessionService: asClass(SessionService).singleton(),

        parserRegistry: asClass(ParserRegistry).inject(() => ({
            config: projectConfig
        })).singleton(),
        productAggregatorService: asClass(ProductAggregatorService).singleton(),
        productCacheService: asClass(ProductCacheService).singleton().inject(() => ({
            config: productCacheConfig
        })),

        parserPublisherService: asClass(ParserPublisherService).singleton(),

        taskConsumer: asClass(TaskConsumer).singleton(),
        taskHandler: asClass(TaskHandler).singleton(),

        productController: asClass(ProductController).singleton(),
        productRoutes: asClass(ProductRoutes).singleton(),

        browserController: asClass(BrowserController).singleton(),
        browserRoutes: asClass(BrowserRoutes).singleton(),
    });
}



