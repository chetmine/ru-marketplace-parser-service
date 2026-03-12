import {Locator, Page} from "playwright";
import ProductSearchService from "../ProductSearchService";


export interface ProductPreview {
    name: string;
    brand?: string | null;

    price: number;
    oldPrice?: number;

    link: string;
    imgUrl?: string | null;

    deliveryDate?: string | null;

    isAvailable: boolean;
    marketplace: string;
}

export interface Product {
    name: string;
    brand?: string | null;

    price: number;
    oldPrice?: number;

    link: string;
    imgUrl?: string | null;

    isAvailable: boolean;

    marketplace: string;

    deliveryDate?: string | null;
    scoresInfo?: ScoresInfo;
    features?: ProductFeature[];
}

export interface ScoresInfo {
    average: number;
    count: number;
}

export interface ProductFeature {
    name: string;
    value: string;
}

export abstract class MarketPlaceParser {
    protected name: string;

    constructor(name: string) {
        this.name = name;
    }

    abstract fetchProducts(page: Page, product: string, isPublishResults?: boolean): Promise<ProductPreview[]>;
    abstract fetchProductInfo(page: Page, productPath: string): Promise<Product>;


    public async findProduct(page: Page, productName: string, products?: Product[]): Promise<Product | null> {
        const foundProducts = products || await this.fetchProducts(page, productName, false);

        const matchedProduct = ProductSearchService.search(productName, foundProducts);
        if (!matchedProduct[0]) return null;

        return await this.fetchProductInfo(page, matchedProduct[0].link);
    };

    public getName() {
        return this.name;
    }

    protected async safeFetchText(element: Locator, timeout = 1000) {
        try {
            return await element.textContent({ timeout });
        } catch (e) {
            return null;
        }
    }

    protected async safeGetAttribute(element: Locator, attribute: string, timeout = 1000) {
        try {
            return await element.getAttribute(attribute, { timeout });
        } catch (e) {
            return null;
        }
    }

    protected async randomDelay(min = 1000, max = 3000): Promise<void> {
        const delay = Math.random() * (max - min) + min;

        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(), delay);
        });
    }
}

export class CaptchaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CaptchaError';
    }
}