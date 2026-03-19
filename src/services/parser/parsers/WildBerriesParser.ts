import {MarketPlaceParser, Product, ProductFeature, ScoresInfo} from "../MarketPlaceParser";
import {Locator, Page} from "playwright";
import * as process from "node:process";
import ProductSearchService from "../../ProductSearchService";



export default class WildBerriesParser extends MarketPlaceParser {
    marketplaceUrl: string = "https://www.wildberries.ru";

    private readonly isSaveScreenshots: boolean;

    // @ts-ignore
    constructor({config, name}) {
        super(name);

        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
    }

    public async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-info.png` });

        await page.waitForSelector('.product-page');

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-info-loaded.png` });

        const pageContentElement = page.locator('[class*="productPageContent--"]')

        return await this.parseProductInfo(page, pageContentElement);
    }

    private async parseProductInfo(page: Page, pageContent: Locator): Promise<Product> {
        const name = <string> await this.safeFetchText(
            pageContent.locator('h3[class*="productTitle--"]'),
        );

        const brand = await this.safeFetchText(
            pageContent.locator('span[class*="productHeaderBrandText--"]'),
        );

        const priceString = <string> await Promise.race(
            [
                this.safeFetchText(
                    pageContent.locator('[class*="priceBlockPrice--"] h2').first(),
                ),
                this.safeFetchText(
                    pageContent.locator('[class*="priceBlockPrice--"] ins').first(),
                ),
            ]
        );

        const oldPriceString = await this.safeFetchText(
            pageContent.locator('[class*="priceBlockOldPrice--"]').first(),
        );

        const imageUrl = await pageContent
            .locator('[class*="mainSlide--"]')
            .locator('[class*="imgContainer--"]')
            .locator('img')
            .first()
            .getAttribute('src')
        ;

        const deliveryDate = await this.safeFetchText(
            pageContent
                .locator('[class*="deliveryTitleWrapper"]')
                .locator('span')
                .first()
        );

        let scoresInfo;

        const scoresInfoString = await this.safeFetchText(
            pageContent.locator('span[class*="productReviewRating--"]')
        );

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

        const features: ProductFeature[] = await Promise.all(
            featureTRs.map(this.parseFeature)
        );

        return {
            name: name.trim(),
            marketplace: 'wildberries',
            brand: brand,
            price: Number.parseFloat(<string>priceString?.replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imageUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate,
            oldPrice: Number.parseFloat(<string>oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            scoresInfo: <ScoresInfo>scoresInfo,
            features: features.filter(feature => !!feature.value),
        }
    }

    private async parseFeature(featureElement: Locator) {

        try {
            const featureType = await featureElement.locator('th').first().textContent({timeout: 100})
            const featureValue = await featureElement.locator('td').first().textContent({timeout: 100})

            return {
                name: featureType?.trim() as string,
                value: featureValue?.trim() as string,
            }
        } catch (e: any) {
            return {
                name: "",
                value: ""
            }
        }
    }

    private parseRating(input: string): ScoresInfo | null {
        const match = input.match(/^([\d,]+)\s+·\s+([\d\s]+)\s+оценок$/);

        if (!match) {
            return null;
        }

        const average = parseFloat(match[1].replace(',', '.'));
        const count = parseInt(match[2].replace(/\s/g, ''), 10);

        return { average, count };
    }

    async fetchProducts(page: Page, product: string, isPublishResults?: boolean): Promise<Product[]> {
        await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });
        await this.randomDelay();

        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/catalog/0/search.aspx?search=${encoded}`;

        await page.goto(url, { waitUntil: 'load' });

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-search.png` });

        await page.waitForSelector('.catalog-page__content');

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/wildberries/product-search-loaded.png` });

        const container = page.locator('.catalog-page__content');
        if (await container.count() === 0) throw new Error("Product list not found. Maybe selector is invalid.")

        const cards = await container.locator('article').all();
        cards.splice(10);

        return await Promise.all(cards.map(this.parseProduct.bind(this)));
    }

    private async parseProduct(card: Locator): Promise<Product> {
        let priceString = await this.safeFetchText(
            card.locator('span.price__wrap > ins').first()
        );

        const oldPriceString = await this.safeFetchText(
            card.locator('del').first()
        );

        const brandNameString = await this.safeFetchText(
            card.locator('span[class="product-card__brand"]').first()
        )

        const productNameString = <string> await this.safeFetchText(
            card.locator('.product-card__name').first()
        );

        const productLink = await card.locator('a[class="product-card__link j-card-link j-open-full-product-card"]').first().getAttribute('href');
        const imageLink = await card.locator('img[class="j-thumbnail"]').first().getAttribute("src");

        const deliveryDateString = await this.safeFetchText(
            card.locator('a[class="product-card__add-basket j-add-to-basket orderLink--tNgvO btn-main"]').first()
        );

        const price= Number.parseInt(<string>priceString?.replace(/\s/g, "").replace("₽", ""));
        const oldPrice= Number.parseInt(<string>oldPriceString?.replace(/\s/g, "").replace("₽", ""));

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
        }
    }

}