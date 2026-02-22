"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const MarketPlaceParser_1 = require("../MarketPlaceParser");
const process = __importStar(require("node:process"));
class WildBerriesParser extends MarketPlaceParser_1.MarketPlaceParser {
    // @ts-ignore
    constructor({ config }) {
        super();
        this.marketplaceUrl = "https://www.wildberries.ru";
        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
    }
    async fetchProductInfo(page, productPath) {
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-info.png` });
        await page.waitForSelector('.product-page');
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-info-loaded.png` });
        const pageContentElement = page.locator('[class*="productPageContent--"]');
        return await this.parseProductInfo(page, pageContentElement);
    }
    async parseProductInfo(page, pageContent) {
        const name = await this.safeFetchText(pageContent.locator('h3[class*="productTitle--"]'));
        const brand = await this.safeFetchText(pageContent.locator('span[class*="productHeaderBrandText--"]'));
        const priceString = await Promise.race([
            this.safeFetchText(pageContent.locator('[class*="priceBlockPrice--"] h2').first()),
            this.safeFetchText(pageContent.locator('[class*="priceBlockPrice--"] ins').first()),
        ]);
        const oldPriceString = await this.safeFetchText(pageContent.locator('[class*="priceBlockOldPrice--"]').first());
        const imageUrl = await pageContent
            .locator('[class*="mainSlide--"]')
            .locator('[class*="imgContainer--"]')
            .locator('img')
            .first()
            .getAttribute('src');
        const deliveryDate = await this.safeFetchText(pageContent
            .locator('[class*="deliveryTitleWrapper"]')
            .locator('span')
            .first());
        let scoresInfo;
        const scoresInfoString = await this.safeFetchText(pageContent.locator('span[class*="productReviewRating--"]'));
        if (scoresInfoString) {
            scoresInfo = this.parseRating(scoresInfoString);
        }
        const table = page.locator('.product-page table');
        const buttons = table.locator('xpath=ancestor::div[2]').locator('button');
        const button = buttons.filter({
            hasNot: page.locator('xpath=ancestor::td')
        });
        await button.click();
        await this.randomDelay(100, 200);
        const featuresDiv = page.locator('.mo-modal__paper');
        const featureTRs = await featuresDiv.locator('tr').all();
        const features = await Promise.all(featureTRs.map(async (tbody) => {
            const featureType = await tbody.locator('th').first().textContent({ timeout: 100 });
            const featureValue = await tbody.locator('td').first().textContent({ timeout: 100 });
            return {
                name: featureType?.trim(),
                value: featureValue?.trim(),
            };
        }));
        return {
            name: name.trim(),
            marketplace: 'wildberries',
            brand: brand,
            price: Number.parseFloat(priceString?.replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imageUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate,
            oldPrice: Number.parseFloat(oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            scoresInfo: scoresInfo,
            features: features,
        };
    }
    parseRating(input) {
        const match = input.match(/^([\d,]+)\s+·\s+([\d\s]+)\s+оценок$/);
        if (!match) {
            return null;
        }
        const average = parseFloat(match[1].replace(',', '.'));
        const count = parseInt(match[2].replace(/\s/g, ''), 10);
        return { average, count };
    }
    async fetchProducts(page, product, isPublishResults) {
        await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });
        await this.randomDelay();
        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/catalog/0/search.aspx?search=${encoded}`;
        await page.goto(url, { waitUntil: 'load' });
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-search.png` });
        await page.waitForSelector('.catalog-page__content');
        if (this.isSaveScreenshots)
            await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-search-loaded.png` });
        const container = page.locator('.catalog-page__content');
        if (await container.count() === 0)
            throw new Error("Product list not found. Maybe selector is invalid.");
        const cards = container.locator('article');
        const count = await cards.count();
        const promises = [];
        for (let i = 0; i < count; i++) {
            const card = cards.nth(i);
            promises.push(this.parseProduct(card));
        }
        return Promise.all(promises);
    }
    async parseProduct(card) {
        let priceString = await this.safeFetchText(card.locator('span.price__wrap > ins').first());
        const oldPriceString = await this.safeFetchText(card.locator('del').first());
        const brandNameString = await this.safeFetchText(card.locator('span[class="product-card__brand"]').first());
        const productNameString = await this.safeFetchText(card.locator('.product-card__name').first());
        const productLink = await card.locator('a[class="product-card__link j-card-link j-open-full-product-card"]').first().getAttribute('href');
        const imageLink = await card.locator('img[class="j-thumbnail"]').first().getAttribute("src");
        const deliveryDateString = await this.safeFetchText(card.locator('a[class="product-card__add-basket j-add-to-basket orderLink--tNgvO btn-main"]').first());
        const price = Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", ""));
        const oldPrice = Number.parseInt(oldPriceString?.replace(/\s/g, "").replace("₽", ""));
        return {
            name: `${productNameString}`.replace("/", "").trim(),
            marketplace: "wildberries",
            brand: `${brandNameString}`.trim(),
            price: price,
            oldPrice: oldPrice ? oldPrice : undefined,
            link: productLink || "No link",
            imgUrl: imageLink || "No link",
            deliveryDate: deliveryDateString?.trim(),
            isAvailable: true,
        };
    }
}
exports.default = WildBerriesParser;
