"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
class ProductRoutes {
    // @ts-ignore
    constructor({ productController }) {
        this.productController = productController;
    }
    setupRoutes() {
        const router = express_1.default.Router();
        router.get("/search", this.productController.searchProducts.bind(this.productController));
        router.get("/fetch", this.productController.getProduct.bind(this.productController));
        return router;
    }
}
exports.default = ProductRoutes;
