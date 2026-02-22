"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma-app/client");
class ProxyRepo {
    // @ts-ignore
    constructor({ prismaService }) {
        this.prismaService = prismaService;
    }
    async create(data) {
        return this.prismaService.proxy.create({
            data
        });
    }
    async upsert(data) {
        return this.prismaService.proxy.upsert({
            // @ts-ignore
            where: { id: data?.id },
            update: data,
            create: data,
        });
    }
    async findById(id) {
        return this.prismaService.proxy.findUnique({
            where: { id },
        });
    }
    async findByDataId(id) {
        return this.prismaService.proxy.findUnique({
            where: { proxyDataId: id },
        });
    }
    async findFree() {
        return this.prismaService.proxy.findFirst({
            where: {
                status: client_1.ProxyStatus.ACTIVE,
                sessionId: null
            },
        });
    }
    async findFreeOptimistic() {
        return await this.prismaService.$transaction(async (transaction) => {
            const freeProxy = await transaction.proxy.findFirst({
                where: {
                    status: client_1.ProxyStatus.ACTIVE,
                    sessionId: null
                },
            });
            if (!freeProxy)
                return null;
            const updated = await transaction.proxy.updateMany({
                where: {
                    id: freeProxy.id,
                    version: freeProxy.version
                },
                data: {
                    version: { increment: 1 }
                }
            });
            // @ts-ignore
            if (updated?.count === 0)
                throw new Error("Optimistic lock failed");
            return freeProxy;
        });
    }
    async findBySessionId(sessionId) {
        return this.prismaService.proxy.findFirst({
            where: {
                sessionId: sessionId
            },
        });
    }
    async findAll(params = {}) {
        const { skip, take, where, orderBy } = params;
        return this.prismaService.proxy.findMany({
            skip,
            take,
            where,
            orderBy,
        });
    }
    async delete(id) {
        return this.prismaService.proxy.delete({
            where: { id },
        });
    }
    async deleteAll() {
        return this.prismaService.proxy.deleteMany({});
    }
    async updateMany(params) {
        // @ts-ignore
        return await this.prismaService.proxy.updateMany(params);
    }
    async transaction(fn) {
        // @ts-ignore
        return await this.prismaService.$transaction(fn);
    }
}
exports.default = ProxyRepo;
