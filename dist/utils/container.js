"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
exports.registerContainer = registerContainer;
const winston_1 = __importDefault(require("winston"));
const awilix_1 = require("awilix");
const App_1 = __importDefault(require("../App"));
const WebServer_1 = __importDefault(require("../WebServer"));
const config_1 = require("../configs/config");
const ProductController_1 = __importDefault(require("../controllers/ProductController"));
const ProductRoutes_1 = __importDefault(require("../routes/ProductRoutes"));
const RedisClient_1 = __importDefault(require("../redis/RedisClient"));
const BrowserService_1 = __importDefault(require("../services/BrowserService"));
const OzonParser_1 = __importDefault(require("../services/parser/parsers/OzonParser"));
const WildBerriesParser_1 = __importDefault(require("../services/parser/parsers/WildBerriesParser"));
const ProductAggregatorService_1 = __importDefault(require("../services/ProductAggregatorService"));
const ParserRegistry_1 = __importDefault(require("../services/parser/ParserRegistry"));
const PrismaService_1 = __importDefault(require("../services/PrismaService"));
const ProxyDataRepo_1 = __importDefault(require("../repo/proxy/ProxyDataRepo"));
const ProxyRepo_1 = __importDefault(require("../repo/proxy/ProxyRepo"));
const ProxyService_1 = __importDefault(require("../services/proxy/ProxyService"));
const ProxyScheduler_1 = __importDefault(require("../jobs/ProxyScheduler"));
const AuthMiddleware_1 = __importDefault(require("../middleware/AuthMiddleware"));
const ProxyController_1 = __importDefault(require("../controllers/ProxyController"));
const ProxyRoutes_1 = __importDefault(require("../routes/ProxyRoutes"));
const events_1 = require("events");
const ProxyHandler_1 = __importDefault(require("../handlers/ProxyHandler"));
const BrowserProxyService_1 = __importDefault(require("../services/proxy/BrowserProxyService"));
const BrowserContextManager_1 = __importDefault(require("../services/BrowserContextManager"));
const RabbitMQConnection_1 = __importDefault(require("../infrastructure/RabbitMQConnection"));
const RabbitMQPublisher_1 = __importDefault(require("../infrastructure/RabbitMQPublisher"));
const ParserPublisherService_1 = __importDefault(require("../services/parser/ParserPublisherService"));
const SessionService_1 = __importDefault(require("../services/SessionService"));
const logger = winston_1.default.createLogger({
    level: 'debug',
    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, className, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })),
    transports: [new winston_1.default.transports.Console()]
});
exports.container = (0, awilix_1.createContainer)({
    injectionMode: awilix_1.InjectionMode.PROXY,
});
function registerContainer() {
    exports.container.register({
        logger: (0, awilix_1.asValue)(logger),
        projectConfig: (0, awilix_1.asValue)(config_1.projectConfig),
        eventBus: (0, awilix_1.asValue)(new events_1.EventEmitter()),
        app: (0, awilix_1.asClass)(App_1.default).singleton(),
        webServer: (0, awilix_1.asClass)(WebServer_1.default).inject(() => ({
            config: config_1.webServerConfig,
        })).singleton(),
        redisClient: (0, awilix_1.asClass)(RedisClient_1.default).inject(() => ({
            config: config_1.redisConfig,
        })).singleton(),
        authMiddleware: (0, awilix_1.asClass)(AuthMiddleware_1.default).singleton(),
        prismaService: (0, awilix_1.asClass)(PrismaService_1.default).singleton(),
        rabbitMQConnection: (0, awilix_1.asClass)(RabbitMQConnection_1.default).inject(() => ({
            config: config_1.rabbitMQConfig,
        })).singleton(),
        rabbitMQPublisher: (0, awilix_1.asClass)(RabbitMQPublisher_1.default).singleton(),
        proxyController: (0, awilix_1.asClass)(ProxyController_1.default).singleton(),
        proxyRoutes: (0, awilix_1.asClass)(ProxyRoutes_1.default).singleton(),
        proxyDataRepo: (0, awilix_1.asClass)(ProxyDataRepo_1.default).singleton(),
        proxyRepo: (0, awilix_1.asClass)(ProxyRepo_1.default).singleton(),
        browserProxyService: (0, awilix_1.asClass)(BrowserProxyService_1.default).singleton(),
        proxyService: (0, awilix_1.asClass)(ProxyService_1.default).singleton(),
        proxyScheduler: (0, awilix_1.asClass)(ProxyScheduler_1.default).singleton(),
        proxyHandler: (0, awilix_1.asClass)(ProxyHandler_1.default).singleton(),
        browserContextManager: (0, awilix_1.asClass)(BrowserContextManager_1.default).singleton(),
        browserService: (0, awilix_1.asClass)(BrowserService_1.default).singleton(),
        sessionService: (0, awilix_1.asClass)(SessionService_1.default).singleton(),
        parserRegistry: (0, awilix_1.asClass)(ParserRegistry_1.default).inject(() => ({
            config: config_1.projectConfig
        })).singleton(),
        productAggregatorService: (0, awilix_1.asClass)(ProductAggregatorService_1.default).singleton(),
        parserPublisherService: (0, awilix_1.asClass)(ParserPublisherService_1.default).singleton(),
        //productSearchService: asClass(ProductSearchService).singleton(),
        ozonParser: (0, awilix_1.asClass)(OzonParser_1.default).singleton(),
        wildBerriesParser: (0, awilix_1.asClass)(WildBerriesParser_1.default).singleton(),
        productController: (0, awilix_1.asClass)(ProductController_1.default).singleton(),
        productRoutes: (0, awilix_1.asClass)(ProductRoutes_1.default).singleton(),
    });
}
