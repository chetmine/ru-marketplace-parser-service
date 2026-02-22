import ProductSearchService from '../../../src/services/ProductSearchService';
import { ProductPreview } from '../../../src/services/parser/MarketPlaceParser';

describe('ProductSearchService', () => {
    // Helper to create product previews matching the interface
    const createProduct = (id: string, name: string): ProductPreview => ({
        name,
        brand: 'Test Brand',
        price: 100,
        link: `http://example.com/${id}`,
        imgUrl: `http://example.com/${id}.jpg`,
        isAvailable: true,
        marketplace: 'test-market'
    });

    describe('search', () => {
        it('should return products sorted by relevance score', () => {
            const products = [
                createProduct('1', 'iphone case'),
                createProduct('2', 'iphone 13 pro max'),
                createProduct('3', 'samsung galaxy'),
            ];

            const results = ProductSearchService.search('iphone', products);

            expect(results.length).toBe(2);
            // Based on previous calculation logic:
            // "iphone case": +44
            // "iphone 13 pro max": +42
            expect(results[0].name).toBe('iphone case');
            expect(results[1].name).toBe('iphone 13 pro max');
        });

        it('should handle exact full matches with highest priority', () => {
            const products = [
                createProduct('1', 'iphone 13'),
                createProduct('2', 'iphone'),
            ];

            const results = ProductSearchService.search('iphone', products);

            expect(results[0].name).toBe('iphone');
        });

        it('should handle case insensitivity and Russian characters', () => {
            const products = [
                createProduct('1', 'Чайник электрический'),
            ];

            const results = ProductSearchService.search('чайник', products);
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('Чайник электрический');
        });

        it('should normalize "ё" to "е"', () => {
            const products = [
                createProduct('1', 'Мёд'),
            ];

            const results = ProductSearchService.search('мед', products);
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('Мёд');
        });

        it('should handle partial token matches', () => {
            const products = [
                createProduct('1', 'notebook'),
            ];

            // query "note" matches "notebook" partially
            const results = ProductSearchService.search('note', products);
            expect(results.length).toBe(1);
        });

        it('should filter out irrelevant products', () => {
            const products = [
                createProduct('1', 'something unrelated'),
            ];

            const results = ProductSearchService.search('iphone', products);
            expect(results.length).toBe(0);
        });

        it('should reward correct word order', () => {
            const products = [
                createProduct('1', 'case iphone'),
                createProduct('2', 'iphone case'),
            ];

            // query: "iphone case"
            // product 1: "case iphone" -> order incorrect
            // product 2: "iphone case" -> order correct -> +12 points

            const results = ProductSearchService.search('iphone case', products);
            expect(results[0].name).toBe('iphone case');
        });

        it('should penalize extra words', () => {
            const products = [
                createProduct('1', 'iphone 13 pro max super ultra'),
                createProduct('2', 'iphone 13'),
            ];

            const results = ProductSearchService.search('iphone 13', products);
            // "iphone 13" has 0 extra tokens (exact match of tokens).
            // "iphone 13 pro max..." has many extra tokens.
            expect(results[0].name).toBe('iphone 13');
        });

        it('should handle special characters in query and product name', () => {
             const products = [
                createProduct('1', 'Super-Man!'),
            ];

            // "Super-Man!" -> "super man"
            const results = ProductSearchService.search('super man', products);
            expect(results.length).toBe(1);
        });

         it('should handle empty query', () => {
            const products = [
                createProduct('1', 'item'),
            ];

            const results = ProductSearchService.search('', products);
            expect(results.length).toBe(0);
        });
    });
});
