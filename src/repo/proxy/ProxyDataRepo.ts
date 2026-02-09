import PrismaService from "../../services/PrismaService";
import {Prisma, ProxyData} from '@prisma-app/client'

export default class ProxyDataRepo {
    private readonly prismaService: PrismaService;

    // @ts-ignore
    constructor({prismaService}) {
        this.prismaService = prismaService;
    }

    public async create(data: Prisma.ProxyDataCreateInput): Promise<ProxyData> {
        return this.prismaService.proxyData.create(
            {
                data: {
                    ...data,
                    proxy: {
                        create: {

                        },
                    }
                },
                include: {
                    proxy: true,
                }
            }
        );
    }

    public async upsert(data: ProxyData | Prisma.ProxyDataCreateInput): Promise<ProxyData> {
        return this.prismaService.proxyData.upsert({
            // @ts-ignore
            where: { id: data?.id },
            update: data,
            create: data,
        });
    }

    public async findById(id: number): Promise<ProxyData | null> {
        return this.prismaService.proxyData.findUnique({
            where: { id },
        });
    }

    public async findAll(params: {
        skip?: number;
        take?: number;
        where?: Prisma.ProxyDataWhereInput;
        include?: Prisma.ProxyDataInclude;
        orderBy?: Prisma.ProxyDataOrderByWithRelationInput;
    } = {}): Promise<ProxyData[]> {
        const { skip, take, where, orderBy } = params;
        return this.prismaService.proxyData.findMany({
            skip,
            take,
            where,
            orderBy,
        });
    }

    public async delete(id: number): Promise<ProxyData> {
        return this.prismaService.proxyData.delete({
            where: { id },
        });
    }
}