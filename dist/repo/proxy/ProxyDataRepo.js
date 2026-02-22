"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ProxyDataRepo {
    // @ts-ignore
    constructor({ prismaService }) {
        this.prismaService = prismaService;
    }
    async create(data) {
        return this.prismaService.proxyData.create({
            data: {
                ...data,
                proxy: {
                    create: {},
                }
            },
            include: {
                proxy: true,
            }
        });
    }
    async upsert(data) {
        return this.prismaService.proxyData.upsert({
            // @ts-ignore
            where: { id: data?.id },
            update: data,
            create: data,
        });
    }
    async findById(id) {
        return this.prismaService.proxyData.findUnique({
            where: { id },
        });
    }
    async findByHost(host) {
        return this.prismaService.proxyData.findMany({
            where: { host },
        });
    }
    async findAll(params = {}) {
        const { skip, take, where, orderBy } = params;
        return this.prismaService.proxyData.findMany({
            skip,
            take,
            where,
            orderBy,
        });
    }
    async delete(id) {
        return this.prismaService.proxyData.delete({
            where: { id },
        });
    }
    async deleteAll() {
        return this.prismaService.proxyData.deleteMany({});
    }
}
exports.default = ProxyDataRepo;
