"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../utils/logger");
class BrowserProxyService {
    // @ts-ignore
    constructor({ browserService, proxyService }) {
        this.browserService = browserService;
        this.proxyService = proxyService;
        this.logger = (0, logger_1.loggerFactory)(this);
    }
    async checkProxies(proxiesData) {
        const results = await Promise.allSettled(proxiesData.map((proxyData) => this.checkProxy(proxyData)));
        const checkResults = results.map(result => result.status === 'fulfilled'
            ? result.value
            : { proxyDataId: -1, success: false, error: 'Promise rejected' });
        const failedIds = checkResults
            .filter(r => !r.success)
            .map(r => r.proxyDataId);
        const passedIds = checkResults
            .filter(r => r.success)
            .map(r => r.proxyDataId);
        await this.proxyService.handleFailedProxiesBatch(failedIds);
        await this.proxyService.handlePassedProxiesBatch(passedIds);
        return {
            passed: passedIds,
            failed: failedIds
        };
    }
    async checkProxy(proxyData) {
        const fingerprint = this.browserService.generateFingerprint();
        const testContext = await this.browserService.createContext(fingerprint, proxyData.id);
        const page = await testContext.newPage();
        try {
            await page.goto('https://api.ipify.org');
            await page.textContent('body', { timeout: 3000 });
            return {
                proxyDataId: proxyData.id,
                success: true
            };
        }
        catch (e) {
            return {
                proxyDataId: proxyData.id,
                success: false,
                error: e
            };
        }
        finally {
            await testContext.close();
        }
    }
    async attachProxy(id) {
        const proxyData = await this.proxyService.attachProxy(id);
        if (!proxyData)
            throw Error("Failed to attach proxy");
        const contextData = await this.browserService.getContextData(id);
        contextData.attachedProxyId = proxyData.id;
        await this.browserService.save(id, contextData);
        const { context } = await this.browserService.getContextData(id);
        return context;
    }
    async unattachProxy(id) {
        await this.proxyService.unattachProxy(id);
        const contextData = await this.browserService.getContextData(id);
        contextData.attachedProxyId = undefined;
        await this.browserService.save(id, contextData);
        const { context } = await this.browserService.getContextData(id);
        return context;
    }
    async replaceProxy(id) {
        let proxyData;
        try {
            proxyData = await this.proxyService.replaceProxyById(id);
        }
        catch (e) {
            this.logger.warn(`Failed to replace proxy for ${id}. Reason: ${e.message}`);
        }
        const contextData = await this.browserService.getContextData(id);
        contextData.attachedProxyId = proxyData?.id;
        await this.browserService.save(id, contextData);
        this.logger.debug(`Saved context ${id} with proxy ${proxyData?.host}`);
        await contextData.context.close();
        const { context } = await this.browserService.getContextData(id);
        return context;
    }
}
exports.default = BrowserProxyService;
