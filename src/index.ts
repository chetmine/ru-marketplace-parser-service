import App from "./App";
import {container, registerContainer} from "./utils/container";

(async () => {

    registerContainer();

    const app: App = container.resolve("app");

    try {
        await app.init();
    } catch (e: any) {

    }


})()
