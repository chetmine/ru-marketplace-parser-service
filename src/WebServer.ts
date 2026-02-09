import express from 'express'
import {Logger} from "winston";
import {loggerFactory} from "./utils/logger";
import ProductRoutes from "./routes/ProductRoutes";
import cors from 'cors'
import ProxyRoutes from "./routes/ProxyRoutes";

export interface WebServerConfig {
    port: number;
    debug: boolean;
}

export default class WebServer {

    private readonly logger: Logger

    private readonly config: WebServerConfig;

    declare private app: express.Express;

    private readonly productRoutes: ProductRoutes;
    private readonly proxyRoutes: ProxyRoutes;

    // @ts-ignore
    constructor({logger, config, productRoutes, proxyRoutes}) {
        this.logger = loggerFactory(this);

        this.config = config;

        this.productRoutes = productRoutes;
        this.proxyRoutes = proxyRoutes;
    }

    public init() {
        this.app = express();
        this.app.use(cors());

        this.app.use(express.json({
            limit: '10mb',
        }));

        this.logger.info(`Initialized successfully.`);
    }

    public start() {
        const port = this.config.port;

        this.app.listen(port, () => {
            this.logger.info(`Started on port ${this.config.port}.`);
        });

        this.setupErrorHandler();

        this.setupRoutes();
    }

    private setupRoutes() {
        this.app.use(`/api/v1/product`, this.productRoutes.setupRoutes());
        this.app.use(`/api/v1/proxy`, this.proxyRoutes.setupRoutes());
    }

    private setupErrorHandler() {
        this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            this.logger.error(err.stack);

            const message = this.config.debug
                ? err.message
                : 'Internal Server Error'
            ;

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