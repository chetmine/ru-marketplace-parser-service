import ProductController from "../controllers/ProductController";
import express from "express";

export default class ProductRoutes {

    private readonly productController: ProductController;

    // @ts-ignore
    constructor({productController}) {
        this.productController = productController;
    }

    public setupRoutes() {
        const router = express.Router();

        router.get("/search"
            , this.productController.searchProducts.bind(this.productController)
        );

        router.get("/fetch"
            , this.productController.getProduct.bind(this.productController)
        );

        return router;
    }
}