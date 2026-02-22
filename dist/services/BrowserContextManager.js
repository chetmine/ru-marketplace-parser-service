"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BrowserContextManager {
    // @ts-ignore
    constructor({ browserService, browserProxyService, proxyService }) {
        this.browserService = browserService;
        this.browserProxyService = browserProxyService;
        this.proxyService = proxyService;
    }
    async getContext(id) {
        const contextData = await this.browserService.getContextData(id);
        return contextData.context;
    }
    async getContextData(id) {
        return this.browserService.getContextData(id);
    }
    /**
     * Replaces proxy, saves context and returns new created BrowserContext.
     * @param {string} id
     */
    async replaceProxy(id) {
        return this.browserProxyService.replaceProxy(id);
    }
    async saveContext(id, contextData) {
        await this.browserService.save(id, contextData);
    }
}
exports.default = BrowserContextManager;
