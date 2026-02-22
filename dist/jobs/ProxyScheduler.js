"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../utils/logger");
class ProxyScheduler {
    // @ts-ignore
    constructor({ proxyService, browserProxyService, browserService }) {
        this.proxyService = proxyService;
        this.browserProxyService = browserProxyService;
        this.browserService = browserService;
        this.logger = (0, logger_1.loggerFactory)(this);
    }
    init() {
        node_cron_1.default.schedule('*/5 * * * *', async () => {
            this.logger.info("Starting proxy health check...");
            try {
                const { passed, failed } = await this.proxyService.checkProxies();
                this.logger.debug(`Firstly proxy check results | passed: ${passed.length} | failed: ${failed.length}`);
                const passedProxiesData = await Promise.all(passed.map(async (id) => this.proxyService.getProxyData(id)));
                const checkInfo = await this.browserProxyService.checkProxies(passedProxiesData.filter((proxyData) => !!proxyData));
                this.logger.debug(`Secondly (browser) proxy check results | passed: ${checkInfo.passed.length} | failed: ${checkInfo.failed.length}`);
                this.logger.info(`Proxy check results | passed: ${checkInfo.passed.length} | failed: ${checkInfo.failed.length + failed.length}`);
            }
            catch (err) {
                this.logger.error(`Proxy check failed: ${err.message}`);
            }
        });
        node_cron_1.default.schedule('* * * * *', async () => {
            const proxiesData = await this.proxyService.getProxiesWithId();
            const results = await Promise.allSettled(proxiesData.map(async (proxyData) => {
                const context = await this.browserService.isContextExists(proxyData.sessionId);
                if (!context)
                    return {
                        id: proxyData.id,
                        success: false,
                    };
                return {
                    id: proxyData.id,
                    success: true,
                };
            }));
            const failedResults = results.filter(r => r.status === 'fulfilled' && !r.value.success);
            // @ts-ignore
            const failedIds = failedResults.map(r => r.value.id);
            await this.proxyService.handleNotExistingSessionIdProxyBatch(failedIds);
        });
    }
}
exports.default = ProxyScheduler;
