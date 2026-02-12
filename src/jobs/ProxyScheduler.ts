import ProxyService from "../services/proxy/ProxyService";
import cron from "node-cron";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import BrowserService from "../services/BrowserService";
import BrowserProxyService from "../services/proxy/BrowserProxyService";

export default class ProxyScheduler {

    private readonly proxyService: ProxyService;
    private readonly browserProxyService: BrowserProxyService;
    private readonly browserService: BrowserService;
    private readonly logger: Logger;

    // @ts-ignore
    constructor({proxyService, browserProxyService, browserService}) {
        this.proxyService = proxyService;
        this.browserProxyService = browserProxyService;
        this.browserService = browserService;

        this.logger = loggerFactory(this);
    }

    init() {
        cron.schedule('*/5 * * * *', async () => {
            this.logger.info("Starting proxy health check...");
            try {
                const { passed, failed } = await this.proxyService.checkProxies();

                this.logger.debug(`Firstly proxy check results | passed: ${passed.length} | failed: ${failed.length}`);

                const passedProxiesData = await Promise.all(
                    passed.map(async id => this.proxyService.getProxyData(id))
                );

                const checkInfo = await this.browserProxyService.checkProxies(passedProxiesData.filter(
                    (proxyData) => !!proxyData)
                );

                this.logger.debug(`Secondly (browser) proxy check results | passed: ${checkInfo.passed.length} | failed: ${checkInfo.failed.length}`);

                this.logger.info(`Proxy check results | passed: ${checkInfo.passed.length} | failed: ${checkInfo.failed.length + failed.length}`);

            } catch (err: any) {
                this.logger.error(`Proxy check failed: ${err.message}`);
            }
        });

        cron.schedule('* * * * *', async () => {
            const proxiesData = await this.proxyService.getProxiesWithId();

            const results = await Promise.allSettled(
                proxiesData.map(async (proxyData) => {
                    const context = await this.browserService.isContextExists(<string>proxyData.sessionId);
                    if (!context) return {
                        id: proxyData.id,
                        success: false,
                    }

                    return {
                        id: proxyData.id,
                        success: true,
                    }
                })
            );

            const failedResults = results.filter(r =>
                r.status === 'fulfilled' && !r.value.success
            );

            // @ts-ignore
            const failedIds = failedResults.map(r => r.value.id);
            await this.proxyService.handleNotExistingSessionIdProxyBatch(failedIds);
        });
    }
}