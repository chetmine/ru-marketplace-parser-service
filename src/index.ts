import App from "./App";
import {container, registerContainer} from "./utils/container";

(async () => {

    registerContainer();

    const app: App = container.resolve("app");
    await app.init();
})()
