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
import AliksonParser from "./services/parser/parsers/AliksonParser";

export default class App {

    private readonly logger: Logger;

    private readonly webServer: WebServer;
    private readonly redisClient: RedisClient;
    private readonly browserService: BrowserService;

    private readonly parserRegistry: ParserRegistry;

    // @ts-ignore
    constructor({webServer, redisClient, browserService, parserRegistry}) {
        this.logger = loggerFactory(this);

        this.webServer = webServer;
        this.redisClient = redisClient;
        this.browserService = browserService;

        this.parserRegistry = parserRegistry;
    }

    public async init() {

        await this.redisClient.init();

        this.webServer.init();
        this.webServer.start();

        await this.browserService.init();

        this.parserRegistry.registerParser("alikson", AliksonParser);
        this.parserRegistry.registerParser("magnitMarket", MagnitMarketParser);
        this.parserRegistry.registerParser("yandexMarket", YandexMarketParser);
        this.parserRegistry.registerParser("wildberries", WildBerriesParser);
        this.parserRegistry.registerParser("ozon", OzonParser);

        this.logger.info("App successfully started");
    }
}