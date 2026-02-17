import {Product, ProductPreview} from "./parser/MarketPlaceParser";

export default class ProductSearchService {

    private static readonly MIN_SCORE: number = 0;

    constructor() {}

    public static search(query: string, products: ProductPreview[]): ProductPreview[] {
        const normalizedQuery = this.normalizeSearchQuery(query);
        const tokens = this.tokenize(normalizedQuery);


        const productsWithScores = products
            .map(product => ({
                product,
                score: this.calculateScore(product, tokens)
            }))

        return productsWithScores
            .filter(({ score }) => score > ProductSearchService.MIN_SCORE)
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

        if (productText === queryTokens.join(' ')) {
            return 1000;
        }

        let exactMatches = 0;
        for (const queryToken of queryTokens) {
            if (productTokens.includes(queryToken)) {
                score += 10;
                exactMatches++;
            }
        }

        for (const queryToken of queryTokens) {
            const partialMatch = productTokens.find(pt =>
                pt.includes(queryToken) || queryToken.includes(pt)
            );
            if (partialMatch && !productTokens.includes(queryToken)) {
                score += 3;
            }
        }

        const allFound = queryTokens.every(qt =>
            productTokens.some(pt => pt.includes(qt) || qt.includes(pt))
        );
        if (allFound) {
            score += 15;
        }

        const extraTokensCount = productTokens.length - queryTokens.length;
        if (extraTokensCount > 0) {
            score -= extraTokensCount * 1;
        }

        if (this.tokensInSameOrder(queryTokens, productTokens)) {
            score += 12;
        }

        if (productTokens[0] && queryTokens[0] &&
            productTokens[0].startsWith(queryTokens[0])) {
            score += 8;
        }

        return Math.max(0, score);
    }

    private static tokensInSameOrder(queryTokens: string[], productTokens: string[]): boolean {
        let productIndex = 0;

        for (const queryToken of queryTokens) {
            const foundIndex = productTokens.slice(productIndex).findIndex(pt =>
                pt.includes(queryToken) || queryToken.includes(pt)
            );

            if (foundIndex === -1) return false;
            productIndex += foundIndex + 1;
        }

        return true;
    }
}