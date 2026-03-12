import {MarketPlaceParser, Product, ProductFeature, ProductPreview} from "../MarketPlaceParser";
import {Locator, Page} from "playwright";
import process from "node:process";
import {text} from "express";
import * as url from "node:url";

export default class AliksonParser extends MarketPlaceParser {

    marketplaceUrl = 'https://alikson.ru'

    async fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        await page.goto(productPath, { waitUntil: 'load' });

        await page.waitForSelector(`.product`)

        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-info.png` });

        const productContainer = page.locator(`.product`);

        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-info-loaded.png` });

        return await this.parseProductInfo(page, productContainer);
    }

    private async parseProductInfo(page: Page, productContainer: Locator): Promise<Product> {

        const name = <string> await this.safeFetchText(
            productContainer.locator(`.product__info-title`),
        );

        const priceString = <string> await this.safeFetchText(
            productContainer.locator(`.product-card-price__cost > span`).first(),
        );

        const oldPriceString = await this.safeFetchText(
            productContainer.locator(`.product-card-price__cost .product-card-price__cost--discount`).first(),
        );

        const imgUrl = <string> await productContainer.locator(`.swiper-product__slider-wrapper > div > img`).first().getAttribute("src");

        let deliveryDate;

        const deliveryDateElements = await productContainer.locator(`.product-delivery-info__delivery-item-deliver-when`).all();
        const deliveryDateElement = deliveryDateElements.find(async (element) => {
            const text = await this.safeFetchText(element);
            return text && !text.trim().toLowerCase().includes('нет')
        });

        if (deliveryDateElement) {
            deliveryDate = await this.safeFetchText(
                deliveryDateElement,
            );
        }

        const featureElements = await page.locator(`.product-about__specifications-content dl`).all();

        //await page.waitForSelector(`.product-about .product-about-info section[id="specifications"] dl`)
        //await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/3.png` });

        const features = await Promise.all(featureElements.map(this.parseFeature.bind(this)));

        return {
            name: name,
            price: Number.parseInt(priceString?.trim().replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.trim().replace(/\s/g, "").replace("₽", "")),
            link: page.url(),
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            deliveryDate: deliveryDate,
            features: features,
            marketplace: "alikson"
        }
    }

    private async parseFeature(featureElement: Locator): Promise<ProductFeature> {
        const featureName = <string> await this.safeFetchText(
            featureElement.locator(`dt.specifications__item-prop`).first(),
        );
        const featureValue = <string> await this.safeFetchText(
            featureElement.locator(`dd.specifications__item-value`).first(),
        );

        return {
            name: featureName?.trim(),
            value: featureValue?.trim(),
        };
    }

    async fetchProducts(page: Page, product: string, isPublishResults?: boolean): Promise<ProductPreview[]> {
        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/search/?q=${encoded}`;

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-search.png` });

        await page.waitForSelector(`.category-page-new__products-list`)

        await page.screenshot({ path: `${process.cwd()}/screenshots/alikson/product-loaded.png` });

        const cardsContainer = page.locator(`.category-page-new__products-list`);
        let cards = await cardsContainer.locator(`> div`).all();
        cards.splice(10);

        return await Promise.all(cards.map(this.parseProduct.bind(this)));
    }

    private async parseProduct(productCard: Locator): Promise<ProductPreview> {
        const name = <string> await productCard.locator(`.product-item__title`).getAttribute('title');

        const priceString = <string> await this.safeFetchText(
            productCard.locator(`.product-item__product-prices-values > p`).first(),
        );

        const oldPriceString = await this.safeFetchText(
            productCard.locator(`.product-item__price-value-full`),
        );

        const href = await productCard.locator(`.product-item__title`).getAttribute('href');
        const imgUrl = await productCard.locator(`.product-item__img`).getAttribute('src');

        return {
            name: name,
            price: Number.parseInt(priceString?.trim().replace(/\s/g, "").replace("₽", "")),
            oldPrice: Number.parseInt(<string>oldPriceString?.trim()?.replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`,
            imgUrl: imgUrl,
            isAvailable: !!priceString,
            marketplace: 'alikson'
        }
    }

}