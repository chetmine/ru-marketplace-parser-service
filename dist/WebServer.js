"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const logger_1 = require("./utils/logger");
const cors_1 = __importDefault(require("cors"));
class WebServer {
    // @ts-ignore
    constructor({ logger, config, productRoutes, proxyRoutes }) {
        this.logger = (0, logger_1.loggerFactory)(this);
        this.config = config;
        this.productRoutes = productRoutes;
        this.proxyRoutes = proxyRoutes;
    }
    init() {
        this.app = (0, express_1.default)();
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json({
            limit: '10mb',
        }));
        this.logger.info(`Initialized successfully.`);
    }
    start() {
        const port = this.config.port;
        this.app.listen(port, () => {
            this.logger.info(`Started on port ${this.config.port}.`);
        });
        this.setupErrorHandler();
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.use(`/api/v1/product`, this.productRoutes.setupRoutes());
        this.app.use(`/api/v1/proxy`, this.proxyRoutes.setupRoutes());
    }
    setupErrorHandler() {
        this.app.use((err, req, res, next) => {
            this.logger.error(err.stack);
            const message = this.config.debug
                ? err.message
                : 'Internal Server Error';
            // @ts-ignore
            res.status(err.status || 500).json({
                error: {
                    message,
                    ...(this.config.debug && { stack: err.stack })
                }
            });
        });
    }
}
exports.default = WebServer;
