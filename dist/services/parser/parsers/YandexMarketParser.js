"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MarketPlaceParser_1 = require("../MarketPlaceParser");
const node_process_1 = __importDefault(require("node:process"));
class YandexMarketParser extends MarketPlaceParser_1.MarketPlaceParser {
    // @ts-ignore
    constructor({ config }) {
        super();
        this.marketplaceUrl = "https://market.yandex.ru";
        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
    }
    //@ts-ignore
    async fetchProductInfo(page, productPath) {
        await this.randomDelay();
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${node_process_1.default.cwd()}/screenshots/yandexMarket/product-info.png` });
        await page.waitForSelector('div[data-baobab-name="main"]');
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${node_process_1.default.cwd()}/screenshots/yandexMarket/product-info-loaded.png` });
        return this.parseProductInfo(page, page.locator('div[data-baobab-name="main"]'));
    }
    async parseProductInfo(page, productContainer) {
        const name = await this.safeFetchText(productContainer.locator(`h1[data-auto="productCardTitle"]`));
        const brand = await this.safeFetchText(productContainer.locator(`[data-auto="product-card-vendor"]`));
        const priceString = await this.safeFetchText(productContainer.locator(`[data-auto="snippet-price-current"] span`).first());
        const oldPriceString = await this.safeFetchText(productContainer.locator(`[data-auto="snippet-price-old"] span`).first());
        const imgUrl = await productContainer.locator(`[data-auto="media-viewer-gallery"] img`).first().getAttribute("src");
        const deliveryDate = await this.safeFetchText(productContainer
            .locator(`[data-zone-name="deliveryVariant"]`).first()
            .locator("span").first());
        let scoresInfo;
        let scoresString;
        try {
            scoresString = await productContainer.locator(`a[data-auto="product-rating"]`).first().getAttribute("aria-label");
        }
        catch (e) {
        }
        if (scoresString) {
            const match = scoresString.match(/(\d+\.?\d*)\s*из\s*(\d+)/);
            if (match) {
                const current = match[1];
                const max = match[2];
                scoresInfo = {
                    average: Number.parseFloat(current),
                    count: Number.parseInt(max)
                };
            }
        }
        const featuresContainer = page.locator(`[data-baobab-name="fullSpecs"]`);
        const featureElements = await featuresContainer.locator(`[data-auto="product-spec"]`).locator(`xpath=ancestor::div[3]`).all();
        const features = await Promise.all(featureElements.map((element) => (this.parseFeature(element))));
        return {
            name: name,
            brand: brand,
            price: Number.parseInt(priceString?.replace(/\s/g, "")),
            oldPrice: Number.parseInt(oldPriceString?.replace(/\s/g, "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            marketplace: "yandexMarket",
            deliveryDate: deliveryDate,
            scoresInfo: scoresInfo ? scoresInfo : undefined,
            features: features
        };
    }
    async parseFeature(featureElement) {
        const featureName = await this.safeFetchText(featureElement
            .locator(`[data-auto="product-spec"]`)
            .first());
        const featureValue = await this.safeFetchText(featureElement.locator('[data-auto="product-spec"]')
            .locator('xpath=ancestor::div[2]/following-sibling::div[1]//span')
            .first());
        return {
            name: featureName?.trim(),
            value: featureValue?.trim(),
        };
    }
    async fetchProducts(page, product, isPublishResults) {
        const encoded = encodeURI(product);
        const url = `https://market.yandex.ru/search?text=${encoded}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${node_process_1.default.cwd()}/screenshots/yandexMarket/product-search.png` });
        await page.waitForSelector('div[data-apiary-widget-name="@marketfront/VirtualizeSerp"]', {
            timeout: 5000,
        });
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${node_process_1.default.cwd()}/screenshots/yandexMarket/product-search-loaded.png` });
        const container = page.locator('div[data-apiary-widget-name="@marketfront/SerpLayout"]');
        const cards = await container.locator('div[data-apiary-widget-name="@marketfront/SerpEntity"] article[data-auto="searchOrganic"]').all();
        const products = await Promise.all(cards.map((cardElement) => (this.parseProducts(cardElement))));
        return products;
    }
    async parseProducts(productElement) {
        const name = await this.safeFetchText(productElement.locator(`[data-zone-name="title"]`));
        const priceString = await this.safeFetchText(productElement.locator(`[data-auto="snippet-price-current"] span`).first());
        const internalLink = await productElement.locator(`a[data-auto="galleryLink"]`).getAttribute('href');
        const deliveryDate = await this.safeFetchText(productElement.locator(`[data-baobab-name="deliveryInfo"] span[class*="ds-text"]`).first());
        const imgUrl = await productElement.locator('img').first().getAttribute('src', { timeout: 1000 });
        return {
            name: name,
            marketplace: 'yandexMarket',
            price: Number.parseInt(priceString?.replace(/\s/g, "")),
            link: `${this.marketplaceUrl}${internalLink}`,
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate,
        };
    }
    fetchAvailableFilters(productsPage) {
        return Promise.resolve(undefined);
    }
}
exports.default = YandexMarketParser;
