import BrowserService, {ContextData} from "./BrowserService";
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
        const contextData = await this.browserService.getContextData(id);
        return contextData.context;
    }

    async getContextData(id: string): Promise<ContextData> {
        return this.browserService.getContextData(id);
    }


    /**
     * Replaces proxy, saves context and returns new created BrowserContext.
     * @param {string} id
     */

    async replaceProxy(id: string): Promise<BrowserContext> {
        return this.browserProxyService.replaceProxy(id);
    }

    async replaceContext(id: string): Promise<ContextData> {
        await this.browserService.removeContext(id);
        return this.browserService.getContextData(id);
    }

    async saveContext(id: string, contextData: ContextData): Promise<void> {
        await this.browserService.save(id, contextData);
    }
}