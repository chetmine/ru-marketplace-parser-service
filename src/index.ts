import App from "./App";
import {container, registerContainer} from "./utils/container";
import {loggerFactory} from "./utils/logger";

(async () => {

    registerContainer();

    const logger = loggerFactory(this)
    const app: App = container.resolve("app");

    try {
        await app.init();
    } catch (e: any) {
        logger.error(`Failed to start app. Reason: ${e.message}`);
    }


})()
