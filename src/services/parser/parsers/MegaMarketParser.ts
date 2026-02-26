import {MarketPlaceParser, Product, ProductFeature, ProductPreview} from "../MarketPlaceParser";
import playwright, {Locator, Page} from "playwright";

export default class MegaMarketParser extends MarketPlaceParser {

    marketplaceUrl: string = "https://megamarket.ru";

    private readonly isSaveScreenshots: boolean;

    // @ts-ignore
    constructor({config}) {
        super();

        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
    }


    async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        await this.disableIntegrityCheckRequests(page);
        await page.goto(productPath, { waitUntil: 'domcontentloaded' });

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/product-info.png` });

        await page.waitForSelector(`.catalog-default`);
        const productContainer = page.locator('.catalog-default article').first();

        await this.randomDelay(500, 1200);

        const allFeaturesRefererButton = productContainer.locator('.regular-characteristics__all-attrs');
        await allFeaturesRefererButton.scrollIntoViewIfNeeded();
        await this.randomDelay(200, 600);
        await allFeaturesRefererButton.click();

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/show-all-features-button-clicked.png` });

        return await this.parseProductInfo(page, productContainer);
    }

    private async parseProductInfo(page: Page, productContainer: Locator): Promise<Product> {
        const name = <string> await this.safeFetchText(
            productContainer.locator(`header h1`)
        );

        const priceString = <string> await this.safeFetchText(
            productContainer.locator(`.sales-block-offer-price__price-final`)
        );

        const oldPriceString = await this.safeFetchText(
            productContainer.locator(`.crossed-old-price-with-discount__crossed-old-price`),
            50
        );

        const imgUrl = await productContainer.locator('img[class*="base-gallery-slide__inner-image-zoom-slide"]').first().getAttribute('src');

        const deliveryDate = await this.safeFetchText(
            productContainer.locator(`.sales-block-delivery-type__date`)
        );

        let scoresInfo;

        const averageString = await this.safeFetchText(
            productContainer.locator(`.pui-rating-display__narrow-text`)
        );

        const countString = await this.safeFetchText(
            productContainer.locator(`.pui-rating-display__text-bullet`)
        );

        if (averageString && countString) {
            scoresInfo = {
                average: Number.parseFloat(averageString.trim()),
                count: Number.parseInt(countString.trim().split(" ")[0]),
            }
        }

        const featureElements = await page.locator(`section[class="pdp-specs"] .spec-info-item`).all();
        const features = await Promise.all(
            featureElements.map(this.parseFeature.bind(this))
        );

        return {
            name: name.trim(),
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate?.trim(),
            scoresInfo: scoresInfo,
            features: features,
            marketplace: "megaMarket",
        }
    }

    private async parseFeature(featureElement: Locator): Promise<ProductFeature> {
        const featureName = <string> await this.safeFetchText(
            featureElement
                .locator(`.spec-info-item__name`)
                .first()
        );

        const featureValue = <string> await this.safeFetchText(
            featureElement
                .locator('.spec-info-item__value')
                .first()
        );

        return {
            name: featureName?.trim(),
            value: featureValue?.trim(),
        };
    }

    async fetchProducts(page: Page, product: string): Promise<ProductPreview[]> {
        await this.disableIntegrityCheckRequests(page);
        await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });

        // if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/main-page.png` });
        //
        // //await this.checkForIntegrityDetection(page);
        //
        // const openSearchTabElement = page.locator(`div[class*="desktop-navigation-tabs__item_search"]`);
        // //await openSearchTabElement.focus({ timeout: 3000 });
        // //await this.randomDelay(10, 40)
        // await openSearchTabElement.click();
        //
        // if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/search-tab-opened.png` });
        //
        // const textArea = page.locator(`textarea[class*="search-input__textarea"]`);
        //
        // await this.randomDelay(400, 1100);
        // await textArea.focus();
        // await this.randomDelay(200, 500);
        // await textArea.fill(product);
        //
        // if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/input-filled.png` });
        //
        // await this.randomDelay(50, 200);
        // await page.keyboard.press("Enter");
        //
        // if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/search-started.png` });

        await page.goto(`https://megamarket.ru/catalog/?q=${encodeURI(product)}`, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector(`.catalog-items-list__container`)
        await page.waitForSelector(`.catalog-items-list__container > div`)

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/search-finished.png` });

        const productCards = await page.locator(`.catalog-items-list__container div[itemprop*="itemListElement"]`).all();
        productCards.splice(10);

        await productCards[5]?.scrollIntoViewIfNeeded();

        const products = await Promise.all(
            productCards.map(card => this.parseProduct(card))
        );

        return products;
    }

    private async checkForCaptcha(page: Page) {
        try {
            const captchaForm = page.locator(`div[id="captcha-root"]`)
            await captchaForm.getAttribute(`id`, { timeout: 2000 });

            throw new Error("Captcha detected!")
        } catch (e) {
            if (e instanceof playwright.errors.TimeoutError) return;
            throw e;
        }
    }

    private async disableIntegrityCheckRequests(page: Page): Promise<void> {
        await page.route('**/send', route => route.abort());
        await page.route('**/list', route => route.abort());
        await page.route('**/search', route => route.abort());
        await page.route('**/get', route => route.abort());
        await page.route('**/start', route => route.abort());
        await page.route('**/push', route => route.abort());
        await page.route('**/searchSuggest', route => route.abort());
        await page.route('**/menu', route => route.abort());
        await page.route('**/findByOffer', route => route.abort());
    }

    private async checkForIntegrityDetection(page: Page) {
        try {
            await page.waitForSelector(`.pui-empty__content`, { timeout: 2000 });
            throw new Error("Integrity check failed. Parser detected!")
        } catch (e) {
            if (e instanceof playwright.errors.TimeoutError) return;
            throw e;
        }
    }

    private async parseProduct(card: Locator): Promise<ProductPreview> {
        const name = <string> await card.locator(`.catalog-item-regular-desktop__main-info`).locator('a').first().getAttribute('title');

        const priceString = <string> await this.safeFetchText(
            card.locator('.catalog-item-regular-desktop__price')
        );

        const oldPriceString = await this.safeFetchText(
            card.locator('.crossed-old-price-discount span'),
            50
        );

        const href = <string> await card.locator('.catalog-item-regular-desktop__main-info').locator(`a`).first().getAttribute('href');

        const imgUrl = await card.locator('img[class*="pui-img"]').first().getAttribute('src');

        const deliveryDate = await this.safeFetchText(
            card.locator('button[class*="catalog-buy-button__button"]').first(),
        );

        const product = {
            name: name,
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`.split('#')[0],
            imgUrl: imgUrl,
            deliveryDate: deliveryDate?.trim(),
            isAvailable: !!priceString,
            marketplace: "megaMarket",
        }

        return product;
    }

}