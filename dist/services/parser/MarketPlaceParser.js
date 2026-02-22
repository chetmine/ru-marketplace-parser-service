"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketPlaceParser = void 0;
const ProductSearchService_1 = __importDefault(require("../ProductSearchService"));
class MarketPlaceParser {
    // @ts-ignore
    constructor() {
    }
    async findProduct(page, productName, products) {
        const foundProducts = products || await this.fetchProducts(page, productName, false);
        const matchedProduct = ProductSearchService_1.default.search(productName, foundProducts);
        if (!matchedProduct)
            return null;
        return await this.fetchProductInfo(page, matchedProduct[0].link);
    }
    ;
    async safeFetchText(element, timeout = 1000) {
        try {
            return await element.textContent({ timeout });
        }
        catch (e) {
            return null;
        }
    }
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.random() * (max - min) + min;
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(), delay);
        });
    }
}
exports.MarketPlaceParser = MarketPlaceParser;
