import ProxyService from "../services/ProxyService";
import cron from "node-cron";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import BrowserService from "../services/BrowserService";

export default class ProxyScheduler {

    private readonly proxyService: ProxyService;
    private readonly browserService: BrowserService;
    private readonly logger: Logger;

    // @ts-ignore
    constructor({proxyService, browserService}) {
        this.proxyService = proxyService;
        this.browserService = browserService;

        this.logger = loggerFactory(this);
    }

    init() {
        cron.schedule('*/5 * * * *', async () => {
            this.logger.info("Starting proxy health check...");
            try {
                const { passed, failed } = await this.proxyService.checkAll();

                this.logger.debug(`Firstly proxy check results | passed: ${passed.length} | failed: ${failed.length}`);

                const passedProxiesData = await Promise.all(
                    passed.map(async id => this.proxyService.getProxyData(id))
                );

                const checkInfo = await this.browserService.checkProxies(passedProxiesData.filter(
                    (proxyData) => !!proxyData)
                );

                this.logger.debug(`Secondly (browser) proxy check results | passed: ${checkInfo.passed.length} | failed: ${checkInfo.failed.length}`);

                this.logger.info(`Proxy check results | passed: ${checkInfo.passed.length} | failed: ${checkInfo.failed.length + failed.length}`);

            } catch (err: any) {
                this.logger.error(`Proxy check failed: ${err.message}`);
            }
        });
    }
}