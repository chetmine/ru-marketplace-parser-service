import {MarketPlaceParser, Product, ProductPreview} from "../MarketPlaceParser";
import {Page} from "playwright";

export default class ExampleParser extends MarketPlaceParser {
    async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        return {
            name: "____",
            isAvailable: false,
            link: "",
            marketplace: "",
            price: 0,
        };
    }

    async fetchProducts(page: Page, product: string): Promise<ProductPreview[]> {
        await page.goto(`https://api.ipify.org/`, { waitUntil: 'domcontentloaded' });

        await page.screenshot({ path: `${process.cwd()}/screenshots/example-parser/product-loaded.png` })

        return Promise.resolve([]);
    }

}