import ProxyService from "../services/ProxyService";
import cron from "node-cron";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";

export default class ProxyScheduler {

    private readonly proxyService: ProxyService;
    private readonly logger: Logger;

    // @ts-ignore
    constructor({proxyService}) {
        this.proxyService = proxyService;

        this.logger = loggerFactory(this);
    }

    init() {
        cron.schedule('*/1 * * * *', async () => {
            this.logger.info("Starting proxy health check...");
            try {
                const { passed, failed } = await this.proxyService.checkAll();

                this.logger.info(`Proxy check results | passed: ${passed} | failed: ${failed}`);

            } catch (err: any) {
                this.logger.error(`Proxy check failed: ${err.message}`);
            }
        });
    }
}