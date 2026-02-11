import {Prisma, ProxyData, ProxyStatus, Proxy} from "@prisma-app/client";
import ProxyDataRepo from "../repo/proxy/ProxyDataRepo";
import { HttpsProxyAgent } from 'https-proxy-agent';
import pLimit from 'p-limit';

import axios from 'axios'
import ProxyRepo from "../repo/proxy/ProxyRepo";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import {EventEmitter} from "events";


export interface ProxyReplacedEvent {
    proxyData: ProxyData;
    sessionId: string;
}

export interface CheckResult {
    proxyDataId: number;
    success: boolean;
    error?: string;
}

export default class ProxyService {
    private readonly proxyDataRepo: ProxyDataRepo;
    private readonly proxyRepo: ProxyRepo;

    private readonly eventBus: EventEmitter;

    private readonly logger: Logger;

    // @ts-ignore
    constructor({proxyDataRepo, proxyRepo, eventBus}) {
        this.proxyDataRepo = proxyDataRepo;
        this.proxyRepo = proxyRepo;

        this.eventBus = eventBus;

        this.logger = loggerFactory(this);
    }

    public async getProxyById(id: number): Promise<Proxy | null> {
        return this.proxyRepo.findById(id);
    }

    public async getProxyData(id: number): Promise<ProxyData | null> {
        return this.proxyDataRepo.findById(id);
    }

    public async getProxyDataByHost(host: string): Promise<ProxyData | null> {
        return this.proxyDataRepo.findByHost(host);
    }

    public async save(proxyData: Prisma.ProxyDataCreateInput) {
        return this.proxyDataRepo.upsert(proxyData);
    }

    public async addProxyData(proxyData: Prisma.ProxyDataCreateInput): Promise<ProxyData> {
        return await this.proxyDataRepo.create(proxyData);
    }

    public async getAllProxy(count: number, isActive: boolean): Promise<Proxy[]> {

        const query = {
            take: count
        }

        if (isActive) {
            // @ts-ignore
            query.where = {
                status: ProxyStatus.ACTIVE,
            }
        }

        return await this.proxyRepo.findAll(query);
    }

    public async removeProxy(id: number): Promise<void> {
        await this.proxyRepo.delete(id);
        await this.proxyDataRepo.delete(id);
    }

    public async removeAllProxy(): Promise<void> {
        await this.proxyRepo.deleteAll();
        await this.proxyDataRepo.deleteAll();
    }

    public toURL(proxyData: ProxyData): URL {
        const url = new URL(`${proxyData.protocol}://${proxyData.host}`)
        url.username = proxyData.username as string;
        url.password = proxyData.password as string;

        return url;
    }

    public async attachProxy(sessionId: string) {
        const existingProxy = await this.proxyRepo.findBySessionId(sessionId);
        if (existingProxy) return await this.proxyDataRepo.findById(existingProxy.proxyDataId);

        const freeProxy = await this.proxyRepo.findFree();
        if (!freeProxy) return undefined;

        const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
        if (!proxyData) return undefined;

        freeProxy.sessionId = sessionId;
        await this.proxyRepo.upsert(freeProxy);

        return proxyData;
    }

    public async unattachProxy(sessionId: string) {
        const proxy = await this.proxyRepo.findBySessionId(sessionId);
        if (!proxy) return;

        proxy.sessionId = null;
        await this.proxyRepo.upsert(proxy);
    }

    public async checkAll(): Promise<{ failed: number[]; passed: number[] }> {
        const chunkSize = 100;
        const concurrencyLimit = 10;
        let currentChunk = 0;

        let passedProxies: number[] = [];
        let failedProxies: number[] = [];

        while (true) {
            const proxiesData = await this.proxyDataRepo.findAll({
                take: chunkSize,
                skip: currentChunk * chunkSize,
                where: {
                    proxy: {
                        status: { not: ProxyStatus.SUSPENDED },
                    }
                },
                orderBy: { id: 'asc' },
                include: { proxy: true }
            });

            if (proxiesData.length === 0) break;

            const checkResults = await this.checkChunkWithLimit(
                proxiesData,
                concurrencyLimit
            );

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

            this.logger.info(
                `Chunk ${currentChunk + 1}: ${passedIds.length} passed, ${failedIds.length} failed`
            );

            currentChunk++;

            if (proxiesData.length < chunkSize) break;
        }

        return {
            failed: failedProxies,
            passed: passedProxies
        };
    }

    private async checkChunkWithLimit(
        proxiesData: ProxyData[],
        concurrency: number
    ): Promise<CheckResult[]> {
        const limit = pLimit(concurrency);

        const results = await Promise.allSettled(
            proxiesData.map(proxyData =>
                limit(async (): Promise<CheckResult> => {
                    try {
                        await this.check(proxyData);
                        return {
                            proxyDataId: proxyData.id,
                            success: true
                        };
                    } catch (error) {
                        return {
                            proxyDataId: proxyData.id,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                })
            )
        );

        return results.map(result =>
            result.status === 'fulfilled'
                ? result.value
                : { proxyDataId: -1, success: false, error: 'Promise rejected' }
        );
    }

    private async check(proxyData: ProxyData): Promise<void> {
        const url = this.toURL(proxyData);
        const proxyAgent = new HttpsProxyAgent(url);

        await axios.get('https://api.ipify.org?format=json', {
            httpsAgent: proxyAgent,
            timeout: 5000,
            headers: { 'Connection': 'keep-alive' }
        });
    }

    public async handleFailedProxiesBatch(ids: number[]): Promise<void> {
        await this.proxyRepo.updateMany({
            where: { id: { in: ids } },
            data: {
                status: ProxyStatus.FAILED,
                failedAttempts: { increment: 1 }
            }
        });

        await this.proxyRepo.updateMany({
            where: { failedAttempts: { gt: 3 } },
            data: {
                status: ProxyStatus.SUSPENDED,
            }
        });
    }

    public async handlePassedProxiesBatch(ids: number[]): Promise<void> {
        await this.proxyRepo.updateMany({
            where: { id: { in: ids } },
            data: {
                status: ProxyStatus.ACTIVE,
                failedAttempts: 0
            }
        });
    }

    public async replaceProxyById(sessionId: string): Promise<void> {
        const proxy = await this.proxyRepo.findBySessionId(sessionId);
        if (!proxy) throw new Error(`Proxy not found.`);

        const freeProxy = await this.proxyRepo.findFree();

        proxy.status = ProxyStatus.SUSPENDED;
        proxy.sessionId = null;
        await this.proxyRepo.upsert(proxy);

        if (!freeProxy) return undefined;
        freeProxy.sessionId = sessionId;
        await this.proxyRepo.upsert(freeProxy);

        const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
        this.eventBus.emit("proxyService.proxy-replaced", {
            proxyData,
            sessionId: freeProxy.sessionId
        });
    }


    private async replaceProxy(proxy: Proxy) {
        const consumer = proxy.sessionId;
        if (!consumer) throw new Error(`No consumer found.`);

        const freeProxy = await this.proxyRepo.findFree();
        if (!freeProxy) throw new Error(`No free proxy found.`);

        proxy.status = ProxyStatus.SUSPENDED;
        proxy.sessionId = null;
        freeProxy.sessionId = consumer;

        await this.proxyRepo.upsert(proxy);
        await this.proxyRepo.upsert(freeProxy);

        const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
        this.eventBus.emit("proxyService.proxy-replaced", {
            proxyData,
            sessionId: freeProxy.sessionId
        });

        return freeProxy;
    }


}
