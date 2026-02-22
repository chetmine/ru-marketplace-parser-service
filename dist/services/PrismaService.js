"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma-app/client");
const logger_1 = require("../utils/logger");
class PrismaService extends client_1.PrismaClient {
    constructor() {
        const adapter = new adapter_pg_1.PrismaPg(new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
        }));
        super({ adapter: adapter });
        this.logger = (0, logger_1.loggerFactory)(this);
        this.adapter = adapter;
    }
    async connect() {
        await this.$connect();
        this.logger.info("Connected to Prisma Service");
    }
    async disconnect() {
        await this.$disconnect();
        this.logger.info("Disconnected from Prisma Service");
    }
}
exports.default = PrismaService;
