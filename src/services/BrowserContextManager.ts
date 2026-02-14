import BrowserService from "./BrowserService";
import {BrowserContext} from "playwright";
import BrowserProxyService from "./proxy/BrowserProxyService";
import ProxyService from "./proxy/ProxyService";

export default class BrowserContextManager {

    private readonly browserService: BrowserService;
    private readonly browserProxyService: BrowserProxyService;
    private readonly proxyService: ProxyService;

    // @ts-ignore
    constructor({browserService, browserProxyService, proxyService}) {
        this.browserService = browserService;
        this.browserProxyService = browserProxyService;
        this.proxyService = proxyService;
    }

    async getContext(id: string): Promise<BrowserContext> {
        return this.browserService.getContext(id);
    }


    /**
     * Replaces proxy, saves context and returns new created BrowserContext.
     * @param {string} id
     */

    async replaceProxy(id: string): Promise<BrowserContext> {
        return this.browserProxyService.replaceProxy(id);
    }

    async saveContext(id: string, context: BrowserContext): Promise<void> {

        let proxyData;

        const proxy = await this.proxyService.getProxyBySessionId(id);
        if (proxy) {
            proxyData = await this.proxyService.getProxyData(proxy.proxyDataId);
        }

        await this.browserService.save(id, context, proxyData ? proxyData : undefined);
    }
}