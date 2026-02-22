"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MarketPlaceParser_1 = require("../MarketPlaceParser");
class MagnitMarketParser extends MarketPlaceParser_1.MarketPlaceParser {
    // @ts-ignore
    constructor({ config }) {
        super();
        this.marketplaceUrl = "https://mm.ru";
        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
    }
    async fetchProducts(page, product) {
        await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });
        await this.randomDelay();
        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/search?query=${encoded}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/mm/product-search-loaded.png` });
        await page.waitForSelector(".products-list");
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/mm/product-search-loaded.png` });
        const cards = await page.locator('div[class*="product-card-"]').all();
        cards.splice(10);
        const products = await Promise.all(cards.map(this.parseProduct.bind(this)));
        return products;
    }
    async parseProduct(card) {
        const name = await this.safeFetchText(card.locator(`.mm-product-card__title`).first());
        const priceString = await this.safeFetchText(card.locator('.price-block__sell'));
        const oldPriceString = await this.safeFetchText(card.locator('.currency_crossed-out'), 50);
        const href = await card.locator('a').first().getAttribute('href');
        const imgUrl = await card.locator('img').first().getAttribute('src');
        const deliveryDate = await this.safeFetchText(card.locator('.add-to-cart-button').first());
        return {
            name: name,
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`,
            imgUrl: imgUrl,
            deliveryDate: deliveryDate?.trim(),
            isAvailable: !!priceString,
            marketplace: "magnitMarket"
        };
    }
    async fetchProductInfo(page, productPath) {
        await this.randomDelay();
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(".product-body");
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/mm/product-info.png` });
        const productContainer = page.locator('.product-body');
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/mm/product-info-loaded.png` });
        return await this.parseProductInfo(page, productContainer);
    }
    async parseProductInfo(page, productContainer) {
        const name = await this.safeFetchText(productContainer.locator(`.pl-text.title`));
        const priceString = await this.safeFetchText(productContainer.locator(`.price .currency.sell-price`));
        const oldPriceString = await this.safeFetchText(productContainer.locator(`.price .currency.full-price`));
        const imgUrl = await productContainer.locator('img[class="main-photo__content__image"]').first().getAttribute('src');
        const deliveryDate = await this.safeFetchText(productContainer.locator(`.label--date--time`));
        let scoresInfo;
        const averageString = await this.safeFetchText(productContainer.locator(`.rating .rating-value`));
        const countString = await this.safeFetchText(productContainer.locator(`.stats-container .reviews`));
        if (averageString && countString) {
            scoresInfo = {
                average: Number.parseFloat(averageString.trim()),
                count: Number.parseInt(countString.trim().split(" ")[0]),
            };
        }
        const button = page.locator('.product-tabs-wrap span', { hasText: "Характеристики" });
        await button.click();
        //await page.waitForSelector(`.characteristics`);
        const featureElements = await page.locator(`li[class="characteristic"]`).all();
        const features = await Promise.all(featureElements.map(this.parseFeature.bind(this)));
        return {
            name: name,
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate?.trim(),
            scoresInfo: scoresInfo,
            features: features,
            marketplace: "magnitMarket",
        };
    }
    async parseFeature(featureElement) {
        const featureName = await this.safeFetchText(featureElement.locator(`span`).first());
        const featureValue = await this.safeFetchText(featureElement.locator(`div`).first());
        return {
            name: featureName.trim(),
            value: featureValue.trim(),
        };
    }
}
exports.default = MagnitMarketParser;
