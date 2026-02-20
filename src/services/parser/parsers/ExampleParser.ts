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
        await this.botTest(page);

        return Promise.resolve([]);
    }

    private async botTest(page: Page): Promise<void> {

        await page.goto(`https://arh.antoinevastel.com/bots/`, { waitUntil: 'networkidle' });

        const testResultElement = page.locator(`table[id="scanner"]`);
        await testResultElement.scrollIntoViewIfNeeded();

        await page.screenshot({ path: `${process.cwd()}/screenshots/test/bot-test-result.png` });

        await page.close();
    }

}