import BrowserService from "../BrowserService";
import ProxyService, {CheckResult} from "./ProxyService";
import {ProxyData} from "@prisma-app/client";
import {BrowserContext} from "playwright";
import {Logger} from "winston";
import {loggerFactory} from "../../utils/logger";

export default class BrowserProxyService {

    private readonly browserService: BrowserService;
    private readonly proxyService: ProxyService;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({browserService, proxyService}) {
        this.browserService = browserService;
        this.proxyService = proxyService;

        this.logger = loggerFactory(this);
    }

    public async checkProxies(proxiesData: ProxyData[]): Promise<{ passed: any[]; failed: any[] }> {
        const results = await Promise.allSettled(
            proxiesData.map((proxyData) => this.checkProxy(proxyData))
        );

        const checkResults = results.map(result =>
            result.status === 'fulfilled'
                ? result.value
                : { proxyDataId: -1, success: false, error: 'Promise rejected' }
        );

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
        }

    }

    public async checkProxy(proxyData: ProxyData): Promise<CheckResult> {
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

        } catch (e: any) {

            return {
                proxyDataId: proxyData.id,
                success: false,
                error: e
            };
        } finally {
            await testContext.close();
        }
    }

    public async attachProxy(id: string): Promise<BrowserContext> {
        const proxyData = await this.proxyService.attachProxy(id);
        if (!proxyData) throw Error("Failed to attach proxy");

        const contextData = await this.browserService.getContextData(id);
        contextData.attachedProxyId = proxyData.id;

        await this.browserService.save(
            id,
            contextData
        );

        const { context } = await this.browserService.getContextData(id);
        return context;
    }

    public async unattachProxy(id: string): Promise<BrowserContext> {
        await this.proxyService.unattachProxy(id);

        const contextData = await this.browserService.getContextData(id);
        contextData.attachedProxyId = undefined;

        await this.browserService.save(
            id,
            contextData
        );

        const { context } = await this.browserService.getContextData(id);
        return context;
    }

    public async replaceProxy(id: string): Promise<BrowserContext> {
        let proxyData;

        try {
            proxyData = await this.proxyService.replaceProxyById(id);
        } catch (e: any) {
            this.logger.warn(`Failed to replace proxy for ${id}. Reason: ${e.message}`);
        }

        const contextData = await this.browserService.getContextData(id);

        contextData.attachedProxyId = proxyData?.id;

        await this.browserService.save(
            id,
            contextData,
        );

        this.logger.debug(`Saved context ${id} with proxy ${proxyData?.host}`);

        await contextData.context.close();

        const { context } = await this.browserService.getContextData(id);
        return context;
    }
}