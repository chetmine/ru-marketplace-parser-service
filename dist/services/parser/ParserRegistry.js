"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const awilix_1 = require("awilix");
class ParserRegistry {
    // @ts-ignore
    constructor({ config }) {
        this.container = (0, awilix_1.createContainer)();
        this.config = config;
    }
    registerParser(name, parserClass) {
        this.container.register({
            [name]: (0, awilix_1.asClass)(parserClass).inject(() => ({ config: this.config })).singleton(),
        });
    }
    getParser(name) {
        return this.container.resolve(name);
    }
    getAllParsers() {
        return Object.keys(this.container.registrations)
            .map(key => this.container.resolve(key));
    }
    getParserNames() {
        return Object.keys(this.container.registrations);
    }
}
exports.default = ParserRegistry;
