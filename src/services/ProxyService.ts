import {Prisma, ProxyData, ProxyStatus, Proxy} from "@prisma-app/client";
import ProxyDataRepo from "../repo/proxy/ProxyDataRepo";
import { HttpsProxyAgent } from 'https-proxy-agent';

import axios from 'axios'
import ProxyRepo from "../repo/proxy/ProxyRepo";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import {EventEmitter} from "events";


export interface ProxyReplacedEvent {
    proxyData: ProxyData;
    sessionId: string;
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

    public async save(proxyData: Prisma.ProxyDataCreateInput) {
        return this.proxyDataRepo.upsert(proxyData);
    }

    public async addProxyData(proxyData: Prisma.ProxyDataCreateInput): Promise<ProxyData> {
        return await this.proxyDataRepo.create(proxyData);
    }

    public async getAllProxy(count: number): Promise<Proxy[]> {
        return await this.proxyRepo.findAll({
            take: count,
        });
    }

    public async removeProxy(id: number): Promise<void> {
        await this.proxyRepo.delete(id);
        await this.proxyDataRepo.delete(id);
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

    public async checkAll(): Promise<{ failed: number; passed: number }> {
        const chunkSize = 50;
        let currentChunk = 0;

        let passedProxyCount = 0;
        let failedProxyCount = 0;

        while (true) {
            const proxiesData = await this.proxyDataRepo.findAll({
                take: chunkSize,
                skip: currentChunk * chunkSize,
                where: {
                    proxy: {
                        status: { not: ProxyStatus.SUSPENDED },
                    }
                },
                orderBy: {
                    id: 'asc'
                },
                include: {
                    proxy: true
                }
            });

            currentChunk++;

            const results = await Promise.allSettled(
                proxiesData.map((proxyData) => this.check(proxyData))
            );

            for (const result of results) {
                const index = results.indexOf(result);
                if (result.status === 'fulfilled') {
                    passedProxyCount++;
                    await this.handlePassedProxy(proxiesData[index].id);
                    continue;
                }

                failedProxyCount++;
                await this.handleFailedProxy(proxiesData[index].id);
            }

            if (proxiesData.length < chunkSize) break;
        }

        return {
            failed: failedProxyCount,
            passed: passedProxyCount
        }
    }

    private async check(proxyData: ProxyData) {
        const url = this.toURL(proxyData);
        const proxyAgent = new HttpsProxyAgent(url);

        return await axios.get(`https://api.ipify.org?format=json`, {
            httpsAgent: proxyAgent,
            timeout: 5000
        });
    }

    private async handlePassedProxy(proxyDataId: number) {
        const proxy = await this.proxyRepo.findByDataId(proxyDataId);
        if (!proxy) throw new Error(`Proxy not found.`);

        proxy.status = ProxyStatus.ACTIVE;
        proxy.failedAttempts = 0

        await this.proxyRepo.upsert(proxy);
    }

    private async handleFailedProxy(proxyDataId: number) {
        let proxy = await this.proxyRepo.findByDataId(proxyDataId);
        if (!proxy) throw new Error(`Proxy not found.`);

        proxy.status = ProxyStatus.FAILED;
        proxy.failedAttempts = proxy.failedAttempts + 1

        if (proxy.failedAttempts >= 10) proxy.status = ProxyStatus.SUSPENDED;

        proxy = await this.proxyRepo.upsert(proxy);

        if (!proxy.sessionId) return;

        await this.replaceProxy(proxy);
    }


    private async replaceProxy(proxy: Proxy) {
        const consumer = proxy.sessionId;
        if (!consumer) throw new Error(`No consumer found.`);

        const freeProxy = await this.proxyRepo.findFree();
        if (!freeProxy) throw new Error(`No free proxy found.`);

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
