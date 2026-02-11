import {Request, Response,NextFunction} from 'express';
import crypto from 'crypto'

import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import BrowserService from "../services/BrowserService";
import {MarketPlaceParser} from "../services/parser/MarketPlaceParser";
import {faker} from "@faker-js/faker";
import ProductAggregatorService from "../services/ProductAggregatorService";

export default class ProductController {

    private readonly logger: Logger;
    private readonly browserService: BrowserService;

    private readonly wildberriesParser: MarketPlaceParser;

    private readonly productAggregatorService: ProductAggregatorService;

    // @ts-ignore
    constructor({browserService, productAggregatorService, wildBerriesParser}) {
        this.logger = loggerFactory(this);

        this.browserService = browserService;

        this.productAggregatorService = productAggregatorService;

        this.wildberriesParser = wildBerriesParser;
    }

    public async searchProducts(req: Request, res: Response, next: NextFunction) {
        try {

            const product = <string> req.query?.name;
            const marketplace = req.query?.marketplace;

            const id = <string>req.headers['session-id'];
            if (!id) return res.status(400).json({error: "Session-id must be provided."});

            const context = await this.browserService.getContext(
                id
            );

            const products = await this.productAggregatorService.searchProducts(
                context,
                id,
                product,
                {
                    marketplace: marketplace?.toString(),
                }
            );

            res.status(200).json({
                message: `Products received.`,
                products: products.sort((a, b) => a.price - b.price),
            });

            await this.browserService.save(id, context);

        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }

    public async getProduct(req: Request, res: Response, next: NextFunction) {
        try {

            const name = <string> req.query?.name;
            const marketplace = req.query?.marketplace;

            const id = <string>req.headers['session-id'];
            if (!id) return res.status(400).json({error: "Session-id must be provided."});

            const context = await this.browserService.getContext(
                id
            );

            const data = await this.productAggregatorService.searchProductDetailed(
                id,
                context,
                <string> name,
                {
                    marketplace: marketplace?.toString(),
                }
            );

            res.status(200).json({
                message: `Product received.`,
                data: data,
            });

            await this.browserService.save(id, context);

        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }
}