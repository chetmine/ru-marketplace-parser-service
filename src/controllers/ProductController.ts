import {Request, Response,NextFunction} from 'express';
import crypto from 'crypto'

import {Logger} from "winston";
import {loggerFactory} from "../utils/logger";
import BrowserService from "../services/BrowserService";
import {MarketPlaceParser} from "../services/parser/MarketPlaceParser";
import {faker} from "@faker-js/faker";
import ProductAggregatorService from "../services/ProductAggregatorService";
import {SessionIsBusyError} from "../services/SessionService";

export default class ProductController {

    private readonly logger: Logger;

    private readonly productAggregatorService: ProductAggregatorService;

    // @ts-ignore
    constructor({productAggregatorService}) {
        this.logger = loggerFactory(this);

        this.productAggregatorService = productAggregatorService;
    }

    public async searchProducts(req: Request, res: Response) {
        try {

            const product = <string> req.query?.name;
            const marketplace = req.query?.marketplace;

            const id = <string>req.headers['session-id'];
            if (!id) return res.status(400).json({error: "Session-id must be provided."});

            const products = await this.productAggregatorService.searchProducts(
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

        } catch (e: any) {

            if (e instanceof SessionIsBusyError) {
                return res.status(409).json({error: e.message});
            }

            res.status(500).json({error: e.message});
        }
    }

    public async getProduct(req: Request, res: Response) {
        try {

            const name = <string> req.query?.name;
            const marketplace = req.query?.marketplace;

            const id = <string>req.headers['session-id'];
            if (!id) return res.status(400).json({error: "Session-id must be provided."});

            const data = await this.productAggregatorService.searchProductDetailed(
                id,
                <string> name,
                {
                    marketplace: marketplace?.toString(),
                }
            );

            res.status(200).json({
                message: `Product received.`,
                data: data,
            });
        } catch (e: any) {

            if (e instanceof SessionIsBusyError) {
                return res.status(409).json({error: e.message});
            }

            res.status(500).json({error: e.message});
        }
    }
}