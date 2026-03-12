import {asClass, AwilixContainer, createContainer} from "awilix";
import {MarketPlaceParser} from "./MarketPlaceParser";

export default class ParserRegistry {
    private container: AwilixContainer;
    private readonly config;

    // @ts-ignore
    constructor({config}) {
        this.container = createContainer();

        this.config = config;
    }

    public registerParser(name: string, parserClass: new (...args: any[]) => MarketPlaceParser) {
        this.container.register({
            [name]: asClass(parserClass).inject(() => ({ config: this.config, name })).singleton(),
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