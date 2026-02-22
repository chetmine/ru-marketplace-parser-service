"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./utils/logger");
const WildBerriesParser_1 = __importDefault(require("./services/parser/parsers/WildBerriesParser"));
const OzonParser_1 = __importDefault(require("./services/parser/parsers/OzonParser"));
const YandexMarketParser_1 = __importDefault(require("./services/parser/parsers/YandexMarketParser"));
const MagnitMarketParser_1 = __importDefault(require("./services/parser/parsers/MagnitMarketParser"));
const MegaMarketParser_1 = __importDefault(require("./services/parser/parsers/MegaMarketParser"));
class App {
    // @ts-ignore
    constructor({ webServer, redisClient, browserService, parserRegistry, prismaService, proxyScheduler, proxyHandler, rabbitMQConnection }) {
        this.logger = (0, logger_1.loggerFactory)(this);
        this.prismaService = prismaService;
        this.webServer = webServer;
        this.redisClient = redisClient;
        this.browserService = browserService;
        this.proxyScheduler = proxyScheduler;
        this.proxyHandler = proxyHandler;
        this.parserRegistry = parserRegistry;
        this.rabbitMQConnection = rabbitMQConnection;
    }
    async init() {
        await this.prismaService.connect();
        await this.redisClient.init();
        await this.rabbitMQConnection.connect();
        await this.rabbitMQConnection.setup();
        this.webServer.init();
        this.webServer.start();
        await this.browserService.init();
        this.parserRegistry.registerParser("megaMarket", MegaMarketParser_1.default);
        this.parserRegistry.registerParser("magnitMarket", MagnitMarketParser_1.default);
        this.parserRegistry.registerParser("yandexMarket", YandexMarketParser_1.default);
        this.parserRegistry.registerParser("wildberries", WildBerriesParser_1.default);
        this.parserRegistry.registerParser("ozon", OzonParser_1.default);
        this.proxyScheduler.init();
        this.proxyHandler.init();
        this.logger.info("App successfully started");
    }
}
exports.default = App;
