import {Request, Response} from "express";
import BrowserService from "../services/BrowserService";

export default class BrowserController {
    //@ts-ignore

    private readonly browserService: BrowserService;

    // @ts-ignore
    constructor({browserService}) {
        this.browserService = browserService;
    }

    public async testBrowserFingerprint(req: Request, res: Response) {
        try {
            const rawData = await this.browserService.fingerprintTest();
            if (!rawData) {
                return res.status(400).json({
                    error: "'Fingerprint Test failed.'",
                });
            }

            const data = JSON.parse(rawData);

            return res.status(200).json({
                message: `Fingerprint Test successful.`,
                data
            });

        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }
}