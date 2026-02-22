"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
class ProxyRoutes {
    // @ts-ignore
    constructor({ proxyController, authMiddleware }) {
        this.proxyController = proxyController;
        this.authMiddleware = authMiddleware;
    }
    setupRoutes() {
        const router = express_1.default.Router();
        router.get("/list", this.authMiddleware.middleware.bind(this.authMiddleware), this.proxyController.getProxies.bind(this.proxyController));
        router.get("/:id", this.authMiddleware.middleware.bind(this.authMiddleware), this.proxyController.getProxy.bind(this.proxyController));
        router.post("/add", this.authMiddleware.middleware.bind(this.authMiddleware), this.proxyController.addProxyData.bind(this.proxyController));
        router.delete("/:id", this.authMiddleware.middleware.bind(this.authMiddleware), this.proxyController.removeProxy.bind(this.proxyController));
        router.delete("/", this.authMiddleware.middleware.bind(this.authMiddleware), this.proxyController.removeAllProxy.bind(this.proxyController));
        return router;
    }
}
exports.default = ProxyRoutes;
