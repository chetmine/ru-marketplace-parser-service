import {asClass, AwilixContainer, createContainer} from "awilix";
import {MarketPlaceParser} from "./MarketPlaceParser";

export default class ParserRegistry {
    private container: AwilixContainer;

    constructor() {
        this.container = createContainer();
    }

    public registerParser(name: string, parserClass: new (...args: any[]) => MarketPlaceParser) {
        this.container.register({
            [name]: asClass(parserClass).singleton(),
        });
    }

    public getParser(name: string): MarketPlaceParser {
        return this.container.resolve<MarketPlaceParser>(name);
    }

    public getAllParsers(): MarketPlaceParser[] {
        return Object.keys(this.container.registrations)
            .map(key => this.container.resolve<MarketPlaceParser>(key));
    }

    public getParserNames(): string[] {
        return Object.keys(this.container.registrations);
    }
}