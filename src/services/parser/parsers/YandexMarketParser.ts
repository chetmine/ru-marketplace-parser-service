import {MarketPlaceParser, Product, ProductFeature, ProductPreview, ScoresInfo} from "../MarketPlaceParser";
import {Locator, Page} from "playwright";
import process from "node:process";

export default class YandexMarketParser extends MarketPlaceParser {
    marketplaceUrl: string = "https://market.yandex.ru";

    //@ts-ignore
    async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        await this.randomDelay();
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });

        await page.screenshot({ path: `${process.cwd()}/screenshots/yandexMarket/product-info.png` });

        await page.waitForSelector('div[data-baobab-name="main"]');

        await page.screenshot({ path: `${process.cwd()}/screenshots/yandexMarket/product-info-loaded.png` });

        return this.parseProductInfo(page, page.locator('div[data-baobab-name="main"]'));
    }

    private async parseProductInfo(page: Page, productContainer: Locator): Promise<Product> {

        const name = <string> await this.safeFetchText(
            productContainer.locator(`h1[data-auto="productCardTitle"]`),
        );

        const brand = await this.safeFetchText(
            productContainer.locator(`[data-auto="product-card-vendor"]`),
        );

        const priceString = <string> await this.safeFetchText(
            productContainer.locator(`[data-auto="snippet-price-current"] span`).first(),
        );

        const oldPriceString = await this.safeFetchText(
            productContainer.locator(`[data-auto="snippet-price-old"] span`).first(),
        );

        const imgUrl = await productContainer.locator(`[data-auto="media-viewer-gallery"] img`).first().getAttribute("src");

        const deliveryDate = await this.safeFetchText(
            productContainer
                .locator(`[data-zone-name="deliveryVariant"]`).first()
                .locator("span").first(),
        );


        let scoresInfo;
        const scoresString = await productContainer.locator(`a[data-auto="product-rating"]`).first().getAttribute("aria-label");
        if (scoresString) {
            const match = scoresString.match(/(\d+\.?\d*)\s*из\s*(\d+)/);
            if (match) {
                const current = match[1];
                const max = match[2];

                scoresInfo = {
                    average: Number.parseFloat(current),
                    count: Number.parseInt(max)
                }
            }
        }


        const featuresContainer = page.locator(`[data-baobab-name="fullSpecs"]`);
        const featureElements = await featuresContainer.locator(`[data-auto="product-spec"]`).locator(`xpath=ancestor::div[3]`).all();

        const features = await Promise.all(
            featureElements.map((element) => (this.parseFeature(element)))
        );

        return {
            name: name,
            brand: brand,
            price: Number.parseInt(priceString?.replace(/\s/g, "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.replace(/\s/g, "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            marketplace: "yandexMarket",
            deliveryDate: deliveryDate,
            scoresInfo: scoresInfo ? scoresInfo : undefined,
            features: features
        }

    }

    private async parseFeature(featureElement: Locator): Promise<ProductFeature> {

        const featureName = <string> await this.safeFetchText(
            featureElement
                .locator(`[data-auto="product-spec"]`)
                .first()
        );

        const featureValue = <string> await this.safeFetchText(
            featureElement.locator('[data-auto="product-spec"]')
                .locator('xpath=ancestor::div[2]/following-sibling::div[1]//span')
                .first()
        );

        return {
            name: featureName?.trim(),
            value: featureValue?.trim(),
        };
    }

    async fetchProducts(page: Page, product: string): Promise<ProductPreview[]> {
        const encoded = encodeURI(product);
        const url = `https://market.yandex.ru/search?text=${encoded}`;

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.screenshot({ path: `${process.cwd()}/screenshots/yandexMarket/product-search.png` });

        await page.waitForSelector('div[data-apiary-widget-name="@marketfront/VirtualizeSerp"]', {
            timeout: 5000,
        });

        await page.screenshot({ path: `${process.cwd()}/screenshots/yandexMarket/product-search-loaded.png` });

        const container = page.locator('div[data-apiary-widget-name="@marketfront/SerpLayout"]');
        const cards = await container.locator('div[data-apiary-widget-name="@marketfront/SerpEntity"] article[data-auto="searchOrganic"]').all();

        const products = await Promise.all(
            cards.map((cardElement) => (this.parseProducts(cardElement)))
        );

        return products;
    }

    private async parseProducts(productElement: Locator): Promise<Product> {

        const name = <string> await this.safeFetchText(
            productElement.locator(`[data-zone-name="title"]`),
        );

        const priceString = <string> await this.safeFetchText(
            productElement.locator(`[data-auto="snippet-price-current"] span`).first(),
        );

        const internalLink = <string> await productElement.locator(`a[data-auto="galleryLink"]`).getAttribute('href');

        const deliveryDate = await this.safeFetchText(
            productElement.locator(`[data-baobab-name="deliveryInfo"] span[class*="ds-text"]`).first(),
        )

        const imgUrl = await productElement.locator('img').first().getAttribute('src', { timeout: 1000 });

        return {
            name: name,
            marketplace: 'yandexMarket',
            price: Number.parseInt(priceString?.replace(/\s/g, "")),
            link: `${this.marketplaceUrl}${internalLink}`,
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate,
        }
    }

    fetchAvailableFilters(productsPage: Page): Promise<any> {
        return Promise.resolve(undefined);
    }

}