"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma-app/client");
const https_proxy_agent_1 = require("https-proxy-agent");
const p_limit_1 = __importDefault(require("p-limit"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
class ProxyService {
    // @ts-ignore
    constructor({ proxyDataRepo, proxyRepo, eventBus }) {
        this.proxyDataRepo = proxyDataRepo;
        this.proxyRepo = proxyRepo;
        this.eventBus = eventBus;
        this.logger = (0, logger_1.loggerFactory)(this);
    }
    async getProxiesWithId() {
        // const proxyData = await this.proxyDataRepo.findAll({
        //     where: {
        //         proxy: {
        //             // @ts-ignore
        //             some: {
        //                 sessionId: {
        //                     not: null
        //                 }
        //             }
        //         }
        //     }
        // });
        return this.proxyRepo.findAll({
            where: {
                sessionId: { not: null }
            }
        });
    }
    async getProxyBySessionId(sessionId) {
        return this.proxyRepo.findBySessionId(sessionId);
    }
    async getProxyById(id) {
        return this.proxyRepo.findById(id);
    }
    async getProxyData(id) {
        return this.proxyDataRepo.findById(id);
    }
    async getProxiesByHost(host) {
        return this.proxyDataRepo.findByHost(host);
    }
    async save(proxyData) {
        return this.proxyDataRepo.upsert(proxyData);
    }
    async addProxyData(proxyData) {
        return await this.proxyDataRepo.create(proxyData);
    }
    async getAllProxy(count, isActive) {
        const query = {
            take: count
        };
        if (isActive) {
            // @ts-ignore
            query.where = {
                status: client_1.ProxyStatus.ACTIVE,
            };
        }
        return await this.proxyRepo.findAll(query);
    }
    async removeProxy(id) {
        await this.proxyRepo.delete(id);
        await this.proxyDataRepo.delete(id);
    }
    async removeAllProxy() {
        await this.proxyRepo.deleteAll();
        await this.proxyDataRepo.deleteAll();
    }
    toURL(proxyData) {
        const url = new URL(`${proxyData.protocol}://${proxyData.host}`);
        url.username = proxyData.username;
        url.password = proxyData.password;
        return url;
    }
    async attachProxy(sessionId) {
        const maxRetries = 5;
        const existingProxy = await this.proxyRepo.findBySessionId(sessionId);
        if (existingProxy)
            return await this.proxyDataRepo.findById(existingProxy.proxyDataId);
        for (let i = 0; i < maxRetries; i++) {
            try {
                const freeProxy = await this.proxyRepo.findFreeOptimistic();
                if (!freeProxy)
                    throw new Error("Free proxy Not Found");
                freeProxy.sessionId = sessionId;
                await this.proxyRepo.upsert(freeProxy);
                const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
                if (!proxyData)
                    throw new Error("Proxy Data not found");
                return proxyData;
            }
            catch (e) {
                if (e.message === 'Free proxy Not Found') {
                    return undefined;
                }
                if (e.message === 'Optimistic lock failed' && i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
                    continue;
                }
                this.logger.warn(`Optimistic lock failed for ${sessionId}.`);
                throw e;
            }
        }
    }
    async replaceProxyById(sessionId) {
        const proxy = await this.proxyRepo.findBySessionId(sessionId);
        if (!proxy)
            throw new Error(`Proxy not found.`);
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const freeProxy = await this.proxyRepo.findFreeOptimistic();
                if (!freeProxy)
                    throw new Error("Proxy Not Found");
                proxy.status = client_1.ProxyStatus.SUSPENDED;
                proxy.sessionId = null;
                freeProxy.sessionId = sessionId;
                await this.proxyRepo.upsert(proxy);
                await this.proxyRepo.upsert(freeProxy);
                const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
                if (!proxyData)
                    throw new Error("Proxy Data not found");
                this.logger.debug(`Replaced proxy for ${sessionId} to ${proxyData.host}.`);
                return proxyData;
            }
            catch (e) {
                if (e.message === 'Optimistic lock failed' && i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
                    continue;
                }
                this.logger.warn(`Optimistic lock failed for ${sessionId}.`);
                throw e;
            }
        }
    }
    async unattachProxy(sessionId) {
        const proxy = await this.proxyRepo.findBySessionId(sessionId);
        if (!proxy)
            return;
        proxy.sessionId = null;
        await this.proxyRepo.upsert(proxy);
    }
    async checkProxies() {
        const chunkSize = 100;
        const concurrencyLimit = 10;
        let currentChunk = 0;
        let passedProxies = [];
        let failedProxies = [];
        while (true) {
            const proxiesData = await this.proxyDataRepo.findAll({
                take: chunkSize,
                skip: currentChunk * chunkSize,
                where: {
                    proxy: {
                        status: { not: client_1.ProxyStatus.SUSPENDED },
                    }
                },
                orderBy: { id: 'asc' },
                include: { proxy: true }
            });
            if (proxiesData.length === 0)
                break;
            const checkResults = await this.checkChunkWithLimit(proxiesData, concurrencyLimit);
            const failedIds = checkResults
                .filter(r => !r.success)
                .map(r => r.proxyDataId);
            const passedIds = checkResults
                .filter(r => r.success)
                .map(r => r.proxyDataId);
            if (failedIds.length > 0) {
                await this.handleFailedProxiesBatch(failedIds);
            }
            if (passedIds.length > 0) {
                await this.handlePassedProxiesBatch(passedIds);
            }
            failedProxies = [...failedProxies, ...failedIds];
            passedProxies = [...passedProxies, ...passedIds];
            this.logger.info(`Chunk ${currentChunk + 1}: ${passedIds.length} passed, ${failedIds.length} failed`);
            currentChunk++;
            if (proxiesData.length < chunkSize)
                break;
        }
        return {
            failed: failedProxies,
            passed: passedProxies
        };
    }
    async checkChunkWithLimit(proxiesData, concurrency) {
        const limit = (0, p_limit_1.default)(concurrency);
        const results = await Promise.allSettled(proxiesData.map(proxyData => limit(async () => {
            try {
                await this.checkProxy(proxyData);
                return {
                    proxyDataId: proxyData.id,
                    success: true
                };
            }
            catch (error) {
                return {
                    proxyDataId: proxyData.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        })));
        return results.map(result => result.status === 'fulfilled'
            ? result.value
            : { proxyDataId: -1, success: false, error: 'Promise rejected' });
    }
    async checkProxy(proxyData) {
        const url = this.toURL(proxyData);
        const proxyAgent = new https_proxy_agent_1.HttpsProxyAgent(url);
        await axios_1.default.get('https://api.ipify.org?format=json', {
            httpsAgent: proxyAgent,
            timeout: 5000,
            headers: { 'Connection': 'keep-alive' }
        });
    }
    async handleNotExistingSessionIdProxyBatch(ids) {
        await this.proxyRepo.updateMany({
            where: { id: { in: ids } },
            data: {
                sessionId: null
            }
        });
    }
    async handleFailedProxiesBatch(ids) {
        await this.proxyRepo.updateMany({
            where: { id: { in: ids } },
            data: {
                status: client_1.ProxyStatus.FAILED,
                failedAttempts: { increment: 1 }
            }
        });
        await this.proxyRepo.updateMany({
            where: { failedAttempts: { gt: 3 } },
            data: {
                status: client_1.ProxyStatus.SUSPENDED,
            }
        });
    }
    async handlePassedProxiesBatch(ids) {
        await this.proxyRepo.updateMany({
            where: { id: { in: ids } },
            data: {
                status: client_1.ProxyStatus.ACTIVE,
                failedAttempts: 0
            }
        });
    }
}
exports.default = ProxyService;
