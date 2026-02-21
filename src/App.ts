import {Logger} from "winston";
import WebServer from "./WebServer";
import {loggerFactory} from "./utils/logger";
import RedisClient from "./redis/RedisClient";
import BrowserService from "./services/BrowserService";
import ParserRegistry from "./services/parser/ParserRegistry";
import WildBerriesParser from "./services/parser/parsers/WildBerriesParser";
import OzonParser from "./services/parser/parsers/OzonParser";
import YandexMarketParser from "./services/parser/parsers/YandexMarketParser";
import MagnitMarketParser from "./services/parser/parsers/MagnitMarketParser";
import PrismaService from "./services/PrismaService";
import ProxyScheduler from "./jobs/ProxyScheduler";
import ProxyHandler from "./handlers/ProxyHandler";
import MegaMarketParser from "./services/parser/parsers/MegaMarketParser";
import RabbitMQConnection from "./infrastructure/RabbitMQConnection";

export default class App {

    private readonly logger: Logger;

    private readonly prismaService: PrismaService;
    private readonly webServer: WebServer;
    private readonly redisClient: RedisClient;
    private readonly browserService: BrowserService;

    private readonly rabbitMQConnection: RabbitMQConnection;

    private readonly proxyScheduler: ProxyScheduler;
    private readonly proxyHandler: ProxyHandler;

    private readonly parserRegistry: ParserRegistry;


    // @ts-ignore
    constructor({webServer, redisClient, browserService, parserRegistry, prismaService, proxyScheduler, proxyHandler, rabbitMQConnection}) {
        this.logger = loggerFactory(this);

        this.prismaService = prismaService;
        this.webServer = webServer;
        this.redisClient = redisClient;
        this.browserService = browserService;

        this.proxyScheduler = proxyScheduler;
        this.proxyHandler = proxyHandler;

        this.parserRegistry = parserRegistry;

        this.rabbitMQConnection = rabbitMQConnection;
    }

    public async init() {

        await this.prismaService.connect();
        await this.redisClient.init();

        await this.rabbitMQConnection.connect();
        await this.rabbitMQConnection.setup();

        this.webServer.init();
        this.webServer.start();

        await this.browserService.init();

        this.parserRegistry.registerParser("megaMarket", MegaMarketParser);
        this.parserRegistry.registerParser("magnitMarket", MagnitMarketParser);
        this.parserRegistry.registerParser("yandexMarket", YandexMarketParser);
        this.parserRegistry.registerParser("wildberries", WildBerriesParser);
        this.parserRegistry.registerParser("ozon", OzonParser);

        this.proxyScheduler.init();
        this.proxyHandler.init();

        this.logger.info("App successfully started");
    }
}