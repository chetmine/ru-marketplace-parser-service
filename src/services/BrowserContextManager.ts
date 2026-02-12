import BrowserService from "./BrowserService";
import {BrowserContext} from "playwright";
import BrowserProxyService from "./proxy/BrowserProxyService";

export default class BrowserContextManager {

    private readonly browserService: BrowserService;
    private readonly browserProxyService: BrowserProxyService;

    // @ts-ignore
    constructor({browserService, browserProxyService}) {
        this.browserService = browserService;
        this.browserProxyService = browserProxyService;
    }

    async getContext(id: string): Promise<BrowserContext> {
        return this.browserService.getContext(id);
    }

    async replaceProxy(id: string): Promise<BrowserContext> {
        return this.browserProxyService.replaceProxy(id);
    }

    async saveContext(id: string, context: BrowserContext): Promise<void> {
        return this.browserService.save(id, context);
    }
}