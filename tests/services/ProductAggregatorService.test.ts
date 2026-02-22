
import { expect, test, describe } from "bun:test";
import ProductAggregatorService from "../../src/services/ProductAggregatorService";
import ParserRegistry from "../../src/services/parser/ParserRegistry";

describe("ProductAggregatorService", () => {
    const mockContext: any = {
        newPage: async () => ({
            close: async () => {}
        })
    };

    test("searchProductDetailed should not crash when no products are found", async () => {
        const parserRegistry = new ParserRegistry();
        const service = new ProductAggregatorService({ parserRegistry });

        const result = await service.searchProductDetailed(mockContext, 'test query');

        expect(result).toBeDefined();
        expect(result.product).toBeUndefined();
        expect(result.prices).toEqual([]);
    });

    test("searchProductDetailed should handle a single product", async () => {
        const parserRegistry = new ParserRegistry();
        const mockParser = {
            findProduct: async () => ({
                name: "Test Product",
                price: 100,
                marketplace: "test-market",
                features: [{ name: "Color", value: "Red" }]
            })
        };
        // @ts-ignore
        parserRegistry.getAllParsers = () => [mockParser];

        const service = new ProductAggregatorService({ parserRegistry });
        const result = await service.searchProductDetailed(mockContext, 'test query');

        expect(result.product).toBeDefined();
        expect(result.product?.name).toBe("Test Product");
        expect(result.prices).toHaveLength(1);
        expect(result.prices[0]["test-market"]).toBeDefined();
    });

    test("searchProductDetailed should pick the product with most features", async () => {
        const parserRegistry = new ParserRegistry();
        const mockParser1 = {
            findProduct: async () => ({
                name: "Product 1",
                price: 100,
                marketplace: "market-1",
                features: [{ name: "F1", value: "V1" }]
            })
        };
        const mockParser2 = {
            findProduct: async () => ({
                name: "Product 2",
                price: 110,
                marketplace: "market-2",
                features: [{ name: "F1", value: "V1" }, { name: "F2", value: "V2" }]
            })
        };
        // @ts-ignore
        parserRegistry.getAllParsers = () => [mockParser1, mockParser2];

        const service = new ProductAggregatorService({ parserRegistry });
        const result = await service.searchProductDetailed(mockContext, 'test query');

        expect(result.product).toBeDefined();
        expect(result.product?.name).toBe("Product 2");
        expect(result.prices).toHaveLength(2);
    });
});
