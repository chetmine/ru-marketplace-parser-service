import {MarketPlaceParser, Product, ProductFeature, ProductPreview, ScoresInfo} from "../MarketPlaceParser";
import {Locator, Page} from "playwright";

export default class MagnitMarketParser extends MarketPlaceParser {
    marketplaceUrl: string = "https://mm.ru";

    fetchAvailableFilters(productsPage: Page): Promise<any> {
        return Promise.resolve(undefined);
    }



    async fetchProducts(page: Page, product: string): Promise<ProductPreview[]> {
        await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });
        await this.randomDelay();

        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/search?query=${encoded}`;

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector(".products-list");

        //await page.screenshot({ path: `${process.cwd()}/screenshots/mm/${product}.png` });

        const cards = await page.locator('div[class*="product-card-"]').all();
        cards.splice(10);

        const products = await Promise.all(
            cards.map(this.parseProduct.bind(this))
        );

        return products;
    }

    private async parseProduct(card: Locator): Promise<ProductPreview> {
        const name = <string> await this.safeFetchText(
            card.locator(`.mm-product-card__title`).first(),
        );

        const priceString = <string> await this.safeFetchText(
            card.locator('.price-block__sell')
        );

        const oldPriceString = await this.safeFetchText(
            card.locator('.currency_crossed-out'),
            50
        );

        const href = <string> await card.locator('a').first().getAttribute('href');

        const imgUrl = await card.locator('img').first().getAttribute('src');

        const deliveryDate = await this.safeFetchText(
            card.locator('.add-to-cart-button').first(),
        );

        return {
            name: name,
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`,
            imgUrl: imgUrl,
            deliveryDate: deliveryDate?.trim(),
            isAvailable: !!priceString,
            marketplace: "magnitMarket"
        }
    }

    async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        await this.randomDelay();
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector(".product-body");

        const productContainer = page.locator('.product-body');

        return await this.parseProductInfo(page, productContainer);
    }

    private async parseProductInfo(page: Page, productContainer: Locator): Promise<Product> {
        const name = <string> await this.safeFetchText(
            productContainer.locator(`.pl-text.title`)
        );

        const priceString = <string> await this.safeFetchText(
            productContainer.locator(`.price .currency.sell-price`)
        );

        const oldPriceString = await this.safeFetchText(
            productContainer.locator(`.price .currency.full-price`)
        );

        const imgUrl = await productContainer.locator('img[class="main-photo__content__image"]').first().getAttribute('src');

        const deliveryDate = await this.safeFetchText(
            productContainer.locator(`.label--date--time`)
        );

        let scoresInfo;

        const averageString = await this.safeFetchText(
            productContainer.locator(`.rating .rating-value`)
        );

        const countString = await this.safeFetchText(
            productContainer.locator(`.stats-container .reviews`)
        );

        if (averageString && countString) {
            scoresInfo = {
                average: Number.parseFloat(averageString.trim()),
                count: Number.parseInt(countString.trim().split(" ")[0]),
            }
        }

        const button = page.locator('.product-tabs-wrap span', { hasText: "Характеристики" });
        await button.click();

        //await page.waitForSelector(`.characteristics`);

        const featureElements = await page.locator(`li[class="characteristic"]`).all();
        const features = await Promise.all(
            featureElements.map(this.parseFeature.bind(this))
        );

        return {
            name: name,
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate?.trim(),
            scoresInfo: scoresInfo,
            features: features,
            marketplace: "magnitMarket",
        }
    }

    private async parseFeature(featureElement: Locator): Promise<ProductFeature> {
        const featureName = <string> await this.safeFetchText(
            featureElement.locator(`span`).first(),
        );
        const featureValue = <string> await this.safeFetchText(
            featureElement.locator(`div`).first(),
        );

        return {
            name: featureName.trim(),
            value: featureValue.trim(),
        };
    }

}