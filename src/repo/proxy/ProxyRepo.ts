import PrismaService from "../../services/PrismaService";
import {Prisma, Proxy, ProxyStatus} from '@prisma-app/client'

export default class ProxyRepo {
    private readonly prismaService: PrismaService;

    // @ts-ignore
    constructor({prismaService}) {
        this.prismaService = prismaService;
    }

    public async create(data: Prisma.ProxyCreateInput): Promise<Proxy> {
        return this.prismaService.proxy.create({
            data
        });
    }

    public async upsert(data: Proxy | Prisma.ProxyCreateInput): Promise<Proxy> {
        return this.prismaService.proxy.upsert({
            // @ts-ignore
            where: { id: data?.id },
            update: data,
            create: data,
        });
    }

    public async findById(id: number): Promise<Proxy | null> {
        return this.prismaService.proxy.findUnique({
            where: { id },
        });
    }

    public async findByDataId(id: number): Promise<Proxy | null> {
        return this.prismaService.proxy.findUnique({
            where: { proxyDataId: id },
        });
    }

    public async findFree(): Promise<Proxy | null> {
        return this.prismaService.proxy.findFirst({
            where: {
                status: ProxyStatus.ACTIVE,
                sessionId: null
            },
        });
    }

    public async findFreeOptimistic(): Promise<Proxy | null> {
        return await this.prismaService.$transaction(async transaction => {
            const freeProxy = await transaction.proxy.findFirst({
                where: {
                    status: ProxyStatus.ACTIVE,
                    sessionId: null
                },
            });
            if (!freeProxy) return null;

            const updated = await transaction.proxy.updateMany({
                where: {
                    id: freeProxy.id,
                    version: freeProxy.version
                },
                data: {
                    version: {increment: 1}
                }
            });

            // @ts-ignore
            if (updated?.count === 0) throw new Error("Optimistic lock failed");

            return freeProxy;
        });
    }

    public async findBySessionId(sessionId: string): Promise<Proxy | null> {
        return this.prismaService.proxy.findFirst({
            where: {
                sessionId: sessionId
            },
        });
    }

    public async findAll(params: {
        skip?: number;
        take?: number;
        where?: Prisma.ProxyWhereInput;
        orderBy?: Prisma.ProxyOrderByWithRelationInput;
    } = {}): Promise<Proxy[]> {
        const { skip, take, where, orderBy } = params;
        return this.prismaService.proxy.findMany({
            skip,
            take,
            where,
            orderBy,
        });
    }

    public async delete(id: number): Promise<Proxy> {
        return this.prismaService.proxy.delete({
            where: { id },
        });
    }

    public async deleteAll() {
        return this.prismaService.proxy.deleteMany({})
    }

    public async updateMany(params: any): Promise<Proxy> {
        // @ts-ignore
        return await this.prismaService.proxy.updateMany(params);
    }

    public async transaction<T>(
        fn: (prismaService: PrismaService) => Promise<T>,
    ): Promise<T> {
        // @ts-ignore
        return await this.prismaService.$transaction(fn);
    }
}