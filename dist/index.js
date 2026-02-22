"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const container_1 = require("./utils/container");
(async () => {
    (0, container_1.registerContainer)();
    const app = container_1.container.resolve("app");
    try {
        await app.init();
    }
    catch (e) {
    }
})();
