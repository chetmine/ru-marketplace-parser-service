import {Product, ProductPreview} from "./parser/MarketPlaceParser";

export default class ProductSearchService {
    constructor() {}

    public static search(query: string, products: ProductPreview[]): ProductPreview[] {
        const normalizedQuery = this.normalizeSearchQuery(query);
        const tokens = this.tokenize(normalizedQuery);

        return products
            .map(product => ({
                product,
                score: this.calculateScore(product, tokens)
            }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .map(({ product }) => product);
    }

    private static normalizeSearchQuery(query: string): string {
        return query
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^\wа-яА-Я\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static tokenize(text: string): string[] {
        return text.split(' ').filter(t => t.length > 1);
    }

    private static calculateScore(product: ProductPreview, queryTokens: string[]): number {
        const productText = this.normalizeSearchQuery(product.name);
        const productTokens = this.tokenize(productText);

        let score = 0;

        for (const queryToken of queryTokens) {
            if (productTokens.includes(queryToken)) {
                score += 10;
            }

            const partialMatch = productTokens.find(pt =>
                pt.includes(queryToken) || queryToken.includes(pt)
            );
            if (partialMatch) {
                score += 5;
            }
        }

        const allFound = queryTokens.every(qt =>
            productTokens.some(pt => pt.includes(qt) || qt.includes(pt))
        );
        if (allFound) {
            score += 20;
        }

        return score;
    }
}