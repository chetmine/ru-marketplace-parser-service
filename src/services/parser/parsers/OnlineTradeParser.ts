import {MarketPlaceParser, Product, ProductPreview} from "../MarketPlaceParser";
import {Locator, Page} from "playwright";

export default class OnlineTradeParser extends MarketPlaceParser {

    marketplaceUrl = 'https://www.onlinetrade.ru'

    fetchProductInfo(page: Page, productPath: string): Promise<Product> {
        //@ts-ignore
        return Promise.resolve(undefined);
    }

    async fetchProducts(page: Page, product: string): Promise<ProductPreview[]> {

        await page.goto(this.marketplaceUrl, { waitUntil: 'domcontentloaded' });
        await this.randomDelay();

        const encoded = encodeURI(product);
        const url = `${this.marketplaceUrl}/sitesearch.html?query=${encoded}`;

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.screenshot({ path: `${process.cwd()}/screenshots/online-trade/product-search.png` });

        setTimeout(() => {
            page.screenshot({ path: `${process.cwd()}/screenshots/online-trade/product-search-after-5s.png` });
        }, 5000)

        await page.waitForSelector(`.goods__items`);

        await page.screenshot({ path: `${process.cwd()}/screenshots/online-trade/product-loaded.png` });

        const cardsContainer = page.locator(`.goods__items`);
        let cards = await cardsContainer.locator(`> div`).all();
        cards.splice(30);

        return await Promise.all(cards.map(this.parseProduct.bind(this)));
    }

    private async parseProduct(productCard: Locator): Promise<ProductPreview> {
        const name = <string> await productCard.locator(`.indexGoods__item__name`).getAttribute('title');

        const priceString = <string> await this.safeFetchText(
            productCard.locator(`.price.regular`).first(),
        );

        const href = await productCard.locator(`.indexGoods__item__name`).getAttribute('href');
        const imgUrl = await productCard.locator(`[class*="indexGoods__item__image"]`).getAttribute('src');

        const isAvailable = await productCard.locator(`.button.button[data-handler="buy"]`).count() > 0;

        return {
            name: name,
            price: Number.parseInt(priceString?.trim().replace(/\s/g, "").replace("₽", "")),
            link: `${this.marketplaceUrl}${href}`,
            imgUrl: imgUrl,
            isAvailable: isAvailable,
            marketplace: 'onlineTrade'
        }
    }

}