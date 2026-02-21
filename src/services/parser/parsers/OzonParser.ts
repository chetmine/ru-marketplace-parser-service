import {Locator, Page} from "playwright";
import {MarketPlaceParser, Product, ProductFeature} from "../MarketPlaceParser";
import ProductSearchService from "../../ProductSearchService";

export default class OzonParser extends MarketPlaceParser {

    public marketplaceUrl = "https://www.ozon.ru";

    private readonly isSaveScreenshots: boolean;

    // @ts-ignore
    constructor({config}) {
        super();

        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
    }


    public async fetchProducts(page: Page, product: string, isPublishResults?: boolean): Promise<Product[]> {

        const baseUrl = "https://www.ozon.ru";
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

        await this.randomDelay();

        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/search/?text=${encoded}&amp;from_global=true`;

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/ozon/product-search.png` });

        await page.waitForSelector('div[data-widget="tileGridDesktop"]');

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/ozon/product-search-loaded.png` });

        const container = page.locator('div[data-widget="tileGridDesktop"]');

        if (await container.count() === 0) throw new Error("Product list not found. Maybe selector is invalid.")

        const cards = await container.locator('> div').all();

        return await Promise.all(
            cards.map((cardElement) => (this.parseProduct(cardElement)))
        );
    }

    public async findProduct(page: Page, productName: string, products?: Product[]): Promise<Product | null> {
        const foundProducts = products || await this.fetchProducts(page, productName);

        const matchedProduct = ProductSearchService.search(productName, foundProducts);
        if (!matchedProduct) return null;

        return await this.fetchProductInfo(page, matchedProduct[0].link);
    }

    private async parseProduct(productCard: Locator): Promise<Product> {
        const prices = productCard.locator('span').filter({
            hasText: '₽'
        });

        const link = await productCard.locator('a').first().getAttribute('href');
        const imgUrl = await productCard.locator('img').first().getAttribute('src');

        const productName = await productCard.locator('a > div > span').textContent();

        const oldPrice = await productCard.locator('span').evaluateAll(spans => {
            const crossed = spans.find(span => {
                const color = window.getComputedStyle(span).color;
                return color === 'rgb(153, 163, 174)'; // --textOriginalpriceAvailable
            });
            return crossed?.textContent?.trim() || null;
        });

        const priceString = await this.safeFetchText(
            prices.first()
        );

        const price = Number.parseFloat(<string>priceString?.replace(/\s/g, "").replace("₽", ""));

        return ({
            name: productName || "No data provided.",
            marketplace: "ozon",

            price: price,
            link: this.marketplaceUrl + link,
            imgUrl: imgUrl || "No link provided.",

            oldPrice: oldPrice
                ? Number.parseFloat(<string>oldPrice?.replace(/\s/g, "").replace("₽", ""))
                : undefined,

            isAvailable: !!price
        });
    }

    public async fetchProductInfo(page: Page, productLink: string): Promise<Product> {
        const featuresUrl = `${productLink.replace(productLink.split("/")[5], "")}features`;

        await page.goto(productLink, { waitUntil: 'domcontentloaded' });

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/ozon/product-info.png` });

        const productContainer = page.locator('div[data-widget="container"]');

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/ozon/product-info-loaded.png` });

        if (await productContainer.count() === 0) throw new Error("Product info not found. Maybe selector is invalid.");

        const product = await this.parseProductInfo(page, productContainer, productLink);
        await this.randomDelay(200, 300);

        await page.goto(featuresUrl, { waitUntil: 'domcontentloaded' });

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/ozon/product-features.png` });

        await page.waitForSelector('div[data-widget="webCharacteristics"]', {
            timeout: 5000,
        });
        const featuresContainer = page.locator('div[data-widget="webCharacteristics"]');


        if (await featuresContainer.count() === 0) throw new Error("Product features not found. Maybe selector is invalid.");

        const featuresElements = featuresContainer.locator('dl');
        const count = await featuresElements.count();

        let features = [];

        for (let i = 0; i < count; i++) {
            const feature = featuresElements.nth(i);
            features.push(await this.parseProductFeature(feature));
        }

        product.features = features.reduce((acc, item) => {
            if (!acc.some(x => x.name === item.name)) {
                acc.push(item);
            }
            return acc;
        }, [] as ProductFeature[]);

        return product;
    }


    private async parseProductFeature(productFeature: Locator): Promise<ProductFeature> {
        const featureNameElement = productFeature.locator("dt > span");
        const featureValueElement = productFeature.locator("dd");

        const featureName = await featureNameElement.textContent();
        const featureValue = await featureValueElement.textContent();

        return {
            // @ts-ignore
            name: featureName,
            // @ts-ignore
            value: featureValue,
        }
    }

    private async parseProductInfo(page: Page, container: Locator, currentLink: string): Promise<Product> {

        let avgScoresString;

        try {
            avgScoresString = await container.locator('div[data-widget="webSingleProductScore"]')
                .locator('a > div')
                .first()
                .textContent({ timeout: 500 })
            ;
        } catch (e) {

        }

        const avgScore = avgScoresString
            ? Number.parseFloat(avgScoresString?.split(' ')[0])
            : undefined
        ;
        const scoresCount = avgScoresString
            ? Number.parseInt(avgScoresString?.split(' ')[2])
            : undefined
        ;

        // @ts-ignore
        const scoresInfo: ScoresInfo | undefined = avgScoresString
            ? {
                average: avgScore,
                count: scoresCount,
            } : undefined;

        const webPriceElement = container.locator('div[data-widget="webPrice"]');


        const priceString = await this.safeFetchText(
            webPriceElement.locator('span.tsHeadline600Large').first()
        )

        const price = Number.parseFloat(<string>priceString?.replace(/\s/g, "").replace("₽", ""));

        const oldPriceString = await webPriceElement.locator('span').evaluateAll(spans => {
            const crossed = spans.find(span => {
                const color = window.getComputedStyle(span).color;
                return color === 'rgb(153, 163, 174)'; // --textOriginalpriceAvailable
            });
            return crossed?.textContent?.trim() || null;
        });

        const oldPrice = Number.parseFloat(<string>oldPriceString?.replace(/\s/g, "").replace("₽", ""));

        const productName = await container.locator('div[data-widget="webProductHeading"]')
            .locator('h1')
            .first()
            .textContent()
        ;

        if (!productName) throw new Error("Cannot find product name.");

        const productImage = await container.locator('div[data-widget="webGallery"]')
            .locator('img[fetchpriority="high"]')
            .first()
            .getAttribute("src")
        ;

        if (!productImage) throw new Error("Cannot find product name.");


        let deliveryDate;

        try {
            await page.waitForSelector('div[data-widget="webAddToCart"] span.tsCompact400Small', {
                timeout: 3000,
            });

            const deliveryData = container.locator('div[data-widget="webAddToCart"]')
                .locator('span')
            ;
            const deliveryDataCount = await deliveryData.count();

            for (let i = 0; i < deliveryDataCount; i++) {
                const component = deliveryData.nth(i);
                const text = await component.textContent();
                const isTruthy = /\d+/.test(<string>text)
                    || text?.toLowerCase()?.includes('завтра')
                    || text?.toLowerCase()?.includes('послезавтра')
                    || text?.toLowerCase()?.includes('сегодня')
                ;

                if (isTruthy && text) {
                    deliveryDate = text.trim();
                    break;
                }
            }
        } catch (e) {

        }

        return {
            name: productName.trim(),
            marketplace: 'ozon',

            price: price,
            link: currentLink,
            imgUrl: productImage,

            deliveryDate: deliveryDate ? deliveryDate.trim() : undefined,
            oldPrice: oldPrice ? oldPrice : undefined,
            scoresInfo: scoresInfo,
            isAvailable: !!price
        }
    }
}