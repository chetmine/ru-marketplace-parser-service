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
}