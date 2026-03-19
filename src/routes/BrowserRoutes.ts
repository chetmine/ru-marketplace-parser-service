import express from "express";
import BrowserController from "../controllers/BrowserController";
import AuthMiddleware from "../middleware/AuthMiddleware";

export default class BrowserRoutes {

    private readonly browserController: BrowserController;
    private readonly authMiddleware: AuthMiddleware;

    // @ts-ignore
    constructor({browserController, authMiddleware}) {
        this.browserController = browserController;
        this.authMiddleware = authMiddleware;
    }

    public setupRoutes() {
        const router = express.Router();

        router.post("/test/fp"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.browserController.testBrowserFingerprint.bind(this.browserController)
        );

        router.post("/test/webgl"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.browserController.testBrowserWebGL.bind(this.browserController)
        );

        return router;
    }
}