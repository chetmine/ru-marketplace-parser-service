import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg'
import {PrismaClient} from "@prisma-app/client";
import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";


export default class PrismaService extends PrismaClient {

    private readonly adapter: PrismaPg;
    private readonly logger: Logger

    constructor() {

        const adapter = new PrismaPg(new Pool({
            connectionString: process.env.DATABASE_URL,
        }));

        super({ adapter: adapter });

        this.logger = loggerFactory(this);

        this.adapter = adapter;
    }

    async connect(): Promise<void> {
        await this.$connect();

        this.logger.info("Connected to Prisma Service");
    }

    async disconnect(): Promise<void> {
        await this.$disconnect();

        this.logger.info("Disconnected from Prisma Service");
    }
}