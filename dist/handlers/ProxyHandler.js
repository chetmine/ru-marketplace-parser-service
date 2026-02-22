"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
class ProxyHandler {
    // @ts-ignore
    constructor({ proxyService, browserService, eventBus }) {
        this.proxyService = proxyService;
        this.browserService = browserService;
        this.eventBus = eventBus;
        this.logger = (0, logger_1.loggerFactory)(this);
    }
    init() {
        this.eventBus.on("proxyService.proxy-replaced", async ({ proxyData, sessionId }) => {
            // try {
            //
            //     const currentContext = await this.browserService.getContext(sessionId);
            //
            //     await this.browserService.save(
            //         sessionId,
            //         currentContext,
            //         proxyData,
            //     );
            //
            //     this.logger.debug(`Replaced ${sessionId} proxy to ${proxyData.host}.`);
            //
            // } catch (e: any) {
            //     this.logger.error(`Failed to replace proxy in browser context: ${e.message}`);
            // }
        });
    }
}
exports.default = ProxyHandler;
