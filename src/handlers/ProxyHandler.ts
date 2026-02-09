import cron from "node-cron";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import ProxyService, {ProxyReplacedEvent} from "../services/ProxyService";
import {EventEmitter} from "events";

import {ProxyData} from "@prisma-app/client";
import BrowserService from "../services/BrowserService";

export default class ProxyHandler {

    private readonly logger: Logger;
    private readonly proxyService: ProxyService;
    private readonly browserService: BrowserService;

    private readonly eventBus: EventEmitter;

    // @ts-ignore
    constructor({proxyService, browserService, eventBus}) {
        this.proxyService = proxyService;
        this.browserService = browserService;

        this.eventBus = eventBus;

        this.logger = loggerFactory(this);
    }

    init() {
        this.eventBus.on("proxyService.proxy-replaced", async ({ proxyData, sessionId }: ProxyReplacedEvent) => {
            try {

                const currentContext = await this.browserService.getContext(sessionId);

                await this.browserService.save(
                    sessionId,
                    currentContext,
                    proxyData,
                );

                this.logger.debug(`Replaced proxy to ${sessionId}.`);

            } catch (e: any) {
                this.logger.error(`Failed to replace proxy in browser context: ${e.message}`);
            }
        });
    }
}