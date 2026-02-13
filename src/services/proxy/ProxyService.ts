import {Prisma, ProxyData, ProxyStatus, Proxy} from "@prisma-app/client";
import ProxyDataRepo from "../../repo/proxy/ProxyDataRepo";
import { HttpsProxyAgent } from 'https-proxy-agent';
import pLimit from 'p-limit';

import axios from 'axios'
import ProxyRepo from "../../repo/proxy/ProxyRepo";
import {Logger} from "winston";
import {loggerFactory} from "../../utils/logger";
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

    public async getProxiesWithId(): Promise<Proxy[]> {
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


    // TODO: execute transaction here

    public async attachProxy(sessionId: string) {

        const maxRetries = 3;

        const existingProxy = await this.proxyRepo.findBySessionId(sessionId);
        if (existingProxy) return await this.proxyDataRepo.findById(existingProxy.proxyDataId);


        for (let i = 0; i < maxRetries; i++) {
            try {

                const freeProxy = await this.proxyRepo.findFreeOptimistic();
                if (!freeProxy) throw new Error("Proxy Not Found");

                freeProxy.sessionId = sessionId;
                await this.proxyRepo.upsert(freeProxy);

                const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
                if (!proxyData) throw new Error("Proxy Data not found");

                return proxyData;

                // return await this.proxyRepo.transaction(async transaction => {
                //     const freeProxy = await this.proxyRepo.findFree();
                //     if (!freeProxy) return undefined;
                //
                //     const updated = await this.proxyRepo.updateMany({
                //         where: {
                //             id: freeProxy.id,
                //             version: freeProxy.version
                //         },
                //         data: {
                //             sessionId: sessionId,
                //             version: {increment: 1}
                //         }
                //     });
                //
                //     // @ts-ignore
                //     if (updated?.count === 0) throw new Error("Optimistic lock failed");
                //
                //     const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
                //     if (!proxyData) throw new Error("Proxy Data not found");
                //
                //     return proxyData;
                // });
            } catch (e: any) {
                if (e.message === 'Optimistic lock failed' && i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
                    continue;
                }

                this.logger.warn(`Optimistic lock failed for ${sessionId}.`);

                throw e;
            }
        }
    }

    public async unattachProxy(sessionId: string) {
        const proxy = await this.proxyRepo.findBySessionId(sessionId);
        if (!proxy) return;

        proxy.sessionId = null;
        await this.proxyRepo.upsert(proxy);
    }

    public async checkProxies(): Promise<{ failed: number[]; passed: number[] }> {
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
                        await this.checkProxy(proxyData);
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

    public async checkProxy(proxyData: ProxyData): Promise<void> {
        const url = this.toURL(proxyData);
        const proxyAgent = new HttpsProxyAgent(url);

        await axios.get('https://api.ipify.org?format=json', {
            httpsAgent: proxyAgent,
            timeout: 5000,
            headers: { 'Connection': 'keep-alive' }
        });
    }


    public async handleNotExistingSessionIdProxyBatch(ids: number[]): Promise<void> {
        await this.proxyRepo.updateMany({
            where: { id: { in: ids } },
            data: {
                sessionId: null
            }
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

    public async replaceProxyById(sessionId: string): Promise<ProxyData> {
        const proxy = await this.proxyRepo.findBySessionId(sessionId);
        if (!proxy) throw new Error(`Proxy not found.`);

        const freeProxy = await this.proxyRepo.findFree();

        proxy.status = ProxyStatus.SUSPENDED;
        proxy.sessionId = null;
        await this.proxyRepo.upsert(proxy);

        if (!freeProxy) throw new Error(`Proxy not found.`);
        freeProxy.sessionId = sessionId;
        await this.proxyRepo.upsert(freeProxy);

        const proxyData = await this.proxyDataRepo.findById(freeProxy.proxyDataId);
        if (!proxyData) throw new Error(`Proxy not found.`);

        this.logger.debug(`Replaced proxy for ${sessionId} to ${proxyData.host}.`);

        return proxyData;

        // this.eventBus.emit("proxyService.proxy-replaced", {
        //     proxyData,
        //     sessionId: freeProxy.sessionId
        // });
    }


}
