"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const SessionService_1 = require("../services/SessionService");
class ProductController {
    // @ts-ignore
    constructor({ productAggregatorService }) {
        this.logger = (0, logger_1.loggerFactory)(this);
        this.productAggregatorService = productAggregatorService;
    }
    async searchProducts(req, res) {
        try {
            const product = req.query?.name;
            const marketplace = req.query?.marketplace;
            const id = req.headers['session-id'];
            if (!id)
                return res.status(400).json({ error: "Session-id must be provided." });
            const products = await this.productAggregatorService.searchProducts(id, product, {
                marketplace: marketplace?.toString(),
            });
            res.status(200).json({
                message: `Products received.`,
                products: products.sort((a, b) => a.price - b.price),
            });
        }
        catch (e) {
            if (e instanceof SessionService_1.SessionIsBusyError) {
                return res.status(409).json({ error: e.message });
            }
            res.status(500).json({ error: e.message });
        }
    }
    async getProduct(req, res) {
        try {
            const name = req.query?.name;
            const marketplace = req.query?.marketplace;
            const id = req.headers['session-id'];
            if (!id)
                return res.status(400).json({ error: "Session-id must be provided." });
            const data = await this.productAggregatorService.searchProductDetailed(id, name, {
                marketplace: marketplace?.toString(),
            });
            res.status(200).json({
                message: `Product received.`,
                data: data,
            });
        }
        catch (e) {
            if (e instanceof SessionService_1.SessionIsBusyError) {
                return res.status(409).json({ error: e.message });
            }
            res.status(500).json({ error: e.message });
        }
    }
}
exports.default = ProductController;
