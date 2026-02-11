import ProxyController from "../controllers/ProxyController";
import express from "express";
import AuthMiddleware from "../middleware/AuthMiddleware";

export default class ProxyRoutes {
    private readonly proxyController: ProxyController;

    private readonly authMiddleware: AuthMiddleware;

    // @ts-ignore
    constructor({ proxyController, authMiddleware }) {
        this.proxyController = proxyController;
        this.authMiddleware = authMiddleware;
    }

    public setupRoutes() {
        const router = express.Router();

        router.get(
            "/list"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.proxyController.getProxies.bind(this.proxyController)
        );

        router.get(
            "/:id"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.proxyController.getProxy.bind(this.proxyController)
        );

        router.post(
            "/add"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.proxyController.addProxyData.bind(this.proxyController)
        );

        router.delete(
            "/:id"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.proxyController.removeProxy.bind(this.proxyController)
        );

        router.delete(
            "/"
            , this.authMiddleware.middleware.bind(this.authMiddleware)
            , this.proxyController.removeAllProxy.bind(this.proxyController)
        );

        return router;
    }

}