"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MarketPlaceParser_1 = require("../MarketPlaceParser");
class AliksonParser extends MarketPlaceParser_1.MarketPlaceParser {
    constructor() {
        super(...arguments);
        this.marketplaceUrl = 'https://alikson.ru';
    }
    async fetchProductInfo(page, productPath) {
        await page.goto(productPath, { waitUntil: 'load' });
        await page.waitForSelector(`.product`);
        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-info.png` });
        const productContainer = page.locator(`.product`);
        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-info-loaded.png` });
        return await this.parseProductInfo(page, productContainer);
    }
    async parseProductInfo(page, productContainer) {
        const name = await this.safeFetchText(productContainer.locator(`.product__info-title`));
        const priceString = await this.safeFetchText(productContainer.locator(`.product-card-price__cost > span`).first());
        const oldPriceString = await this.safeFetchText(productContainer.locator(`.product-card-price__cost .product-card-price__cost--discount`).first());
        const imgUrl = await productContainer.locator(`.swiper-product__slider-wrapper > div > img`).first().getAttribute("src");
        let deliveryDate;
        const deliveryDateElements = await productContainer.locator(`.product-delivery-info__delivery-item-deliver-when`).all();
        const deliveryDateElement = deliveryDateElements.find(async (element) => {
            const text = await this.safeFetchText(element);
            return text && !text.trim().toLowerCase().includes('нет');
        });
        if (deliveryDateElement) {
            deliveryDate = await this.safeFetchText(deliveryDateElement);
        }
        const featureElements = await page.locator(`.product-about__specifications-content dl`).all();
        //await page.waitForSelector(`.product-about .product-about-info section[id="specifications"] dl`)
        //await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/3.png` });
        const features = await Promise.all(featureElements.map(this.parseFeature.bind(this)));
        return {
            name: name,
            price: Number.parseInt(priceString?.trim().replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(oldPriceString?.trim().replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate,
            features: features,
            marketplace: "alikson"
        };
    }
    async parseFeature(featureElement) {
        const featureName = await this.safeFetchText(featureElement.locator(`dt.specifications__item-prop`).first());
        const featureValue = await this.safeFetchText(featureElement.locator(`dd.specifications__item-value`).first());
        return {
            name: featureName?.trim(),
            value: featureValue?.trim(),
        };
    }
    async fetchProducts(page, product, isPublishResults) {
        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/search/?q=${encoded}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-search.png` });
        await page.waitForSelector(`.category-page-new__products-list`);
        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-loaded.png` });
        const cardsContainer = page.locator(`.category-page-new__products-list`);
        let cards = await cardsContainer.locator(`> div`).all();
        cards.splice(10);
        return await Promise.all(cards.map(this.parseProduct.bind(this)));
    }
    async parseProduct(productCard) {
        const name = await productCard.locator(`.product-item__title`).getAttribute('title');
        const priceString = await this.safeFetchText(productCard.locator(`.product-item__product-prices-values > p`).first());
        const oldPriceString = await this.safeFetchText(productCard.locator(`.product-item__price-value-full`));
        const href = await productCard.locator(`.product-item__title`).getAttribute('href');
        const imgUrl = await productCard.locator(`.product-item__img`).getAttribute('src');
        return {
            name: name,
            price: Number.parseInt(priceString?.trim().replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(oldPriceString?.trim()?.replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`,
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            marketplace: 'alikson'
        };
    }
}
exports.default = AliksonParser;
