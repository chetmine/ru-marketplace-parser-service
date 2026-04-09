import {CaptchaError, MarketPlaceParser, Product, ProductFeature, ProductPreview} from "../MarketPlaceParser";
import playwright, {Locator, Page, Response} from "playwright";

export default class MegaMarketParser extends MarketPlaceParser {

    marketplaceUrl: string = "https://megamarket.ru";

    private readonly isSaveScreenshots: boolean;
    private readonly notRequiredTimeout: number;

    // @ts-ignore
    constructor({config, name}) {
        super(name);

        this.isSaveScreenshots = config.SAVE_SCREENSHOTS;
        this.notRequiredTimeout = config.NOT_REQUIRED_TIMEOUT;
    }


    async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        await this.disableIntegrityCheckRequests(page);

        const cleanup = this.setupCaptchaInterceptor(page);
        const captchaRace = (page as any).__captchaPromise;

        try {
            await Promise.race([
                this.doFetchProductInfo(page, productPath),
                captchaRace,
            ]);

            return await this.doFetchProductInfo(page, productPath);
        } finally {
            cleanup();
        }
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
            this.notRequiredTimeout
        );

        const imgUrl = await this.safeGetAttribute(
            productContainer.locator('img[class*="base-gallery-slide__inner-image-zoom-slide"]').first(),
            "src",
            this.notRequiredTimeout
        )

        const deliveryDate = await this.safeFetchText(
            productContainer.locator(`.sales-block-delivery-type__date`),
            this.notRequiredTimeout
        );

        let scoresInfo;

        const averageString = await this.safeFetchText(
            productContainer.locator(`.pui-rating-display__narrow-text`),
            this.notRequiredTimeout
        );

        const countString = await this.safeFetchText(
            productContainer.locator(`.pui-rating-display__text-bullet`),
            this.notRequiredTimeout
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
            marketplace: this.getName(),
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
        // const cleanup = this.setupCaptchaInterceptor(page);
        const captchaRace = (page as any).__captchaPromise;

        try {
            // await Promise.race([
            //     this.doFetchProducts(page, product),
            //         // captchaRace,
            // ]);

            return await this.doFetchProducts(page, product);
        } finally {
            // cleanup();
        }
    }

    protected async doFetchProductInfo(page: Page, productPath: string): Promise<Product> {
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

    private async doFetchProducts(page: Page, product: string): Promise<ProductPreview[]> {

        await page.goto(this.marketplaceUrl, { waitUntil: 'load' });
        // await this.disableIntegrityCheckRequests(page);

        const openSearchTabElement = page.locator(`div[class*="desktop-navigation-tabs__item_search"]`);
        await openSearchTabElement.focus();
        await this.randomDelay(10, 40)
        await openSearchTabElement.click();

        const textArea = page.locator(`textarea[class*="search-input__textarea"]`);

        await this.randomDelay(400, 1100);
        await textArea.focus();
        await this.randomDelay(200, 500);
        await textArea.fill(product);

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/input-filled.png` });

        await this.randomDelay(50, 200);
        await page.keyboard.press("Enter");

        if (this.isSaveScreenshots) await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/search-started.png` });

        await page.waitForSelector(`.catalog-items-list__container`)
        await page.waitForSelector(`.catalog-items-list__container > div`)

        if (this.isSaveScreenshots) {
            await page.screenshot({ path: `${process.cwd()}/screenshots/megaMarket/search-finished.png` });
        }

        // const productCards = await page.locator(`.catalog-items-list__container > div`).all();

        // await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });
        //
        // await page.goto(`https://megamarket.ru/catalog/?q=${encodeURI(product)}`, { waitUntil: 'domcontentloaded' });
        // await this.interceptParse(page);
        //
        // await page.waitForSelector('.catalog-items-list__container');
        // await page.waitForSelector('.catalog-items-list__container > div');



        const productCards = await page
            .locator('.catalog-items-list__container div[data-test="product-item"]')
            .all();
        productCards.splice(10);

        return Promise.all(productCards.map(card => this.parseProduct(card)));
    }

    private async interceptParse(page: Page) {
        await page.route('**/parse', async (route, request) => {
            try {
                await route.continue();

                await page.waitForTimeout(500);
                await page.evaluate(() => window.stop()).catch(() => {});
                await page.reload({ waitUntil: 'domcontentloaded' });
            } catch (e) {

            }
        });
    }

    private setupCaptchaInterceptor(page: Page): () => void {
        let rejectFn: ((err: Error) => void) | null = null;

        const captchaPromise = new Promise<never>((_, reject) => {
            rejectFn = reject;
        });

        const handler = async (response: Response) => {
            const url = response.url();

            const isCaptcha =
                url.includes('xpvnsulc')
            ;

            if (isCaptcha) {
                rejectFn?.(new CaptchaError(`Captcha detected!`));
            }
        };

        page.on('response', handler);

        (page as any).__captchaPromise = captchaPromise;

        return () => page.off('response', handler);
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

    private async parseProduct(card: Locator): Promise<ProductPreview> {
        const name = <string> await this.safeGetAttribute(
            card.locator(`[class*="catalog-item-regular-desktop__main-info"]`).locator('a').first(),
            'title',
            this.notRequiredTimeout
        );

        const priceString = <string> await this.safeFetchText(
            card.locator('.catalog-item-regular-desktop__price')
        );

        const oldPriceString = await this.safeFetchText(
            card.locator('.crossed-old-price-discount span'),
            this.notRequiredTimeout
        );

        const href = <string> await this.safeGetAttribute(
            card.locator('a').first(),
            'href',
        );

        const imgUrl = await this.safeGetAttribute(
            card.locator('img[class*="pui-img"]').first(),
            'src',
            this.notRequiredTimeout
        )

        const deliveryDate = await this.safeFetchText(
            card.locator('button[class*="catalog-buy-button__button"]').first(),
            this.notRequiredTimeout
        );

        const isAvailableText = !(await this.safeGetAttribute(
            card.locator(`[class*="catalog-item-image-block_out-of-stock"]`),
            'class',
            this.notRequiredTimeout
        ));

        const product = {
            name: name,
            price: Number.parseInt(priceString?.replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`.split('#')[0],
            imgUrl: imgUrl,
            deliveryDate: deliveryDate?.trim(),
            isAvailable: isAvailableText,
            marketplace: this.getName()
        }

        return product;
    }

}