import {Request, Response} from 'express';
import ProxyService from "../services/ProxyService";

export default class ProxyController {

    private readonly proxyService: ProxyService;

    // @ts-ignore
    constructor({proxyService}) {
        this.proxyService = proxyService;
    }

    public async getProxies(req: Request, res: Response) {
        try {

            const count = req.query?.count;
            const isActive = req.query?.isActive;

            const proxies = await this.proxyService.getAllProxy(
                Number(count) || 50,
                isActive === 'true',
            );

            res.status(200).json({
                message: 'Proxies found',
                data: {
                    proxies,
                },
            });

        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }

    public async getProxy(req: Request, res: Response) {
        try {

            const id = Number(req.params.id);
            const isGetData = req.query?.proxyData;

            const proxy = await this.proxyService.getProxyById(id);
            if (!proxy) {
                return res.status(404).json({
                    error: 'Proxy not found',
                })
            }

            const data = {
                proxy: proxy,
            }
            if (isGetData === 'true') {
                const proxyData = await this.proxyService.getProxyData(
                    proxy.proxyDataId
                );
                // @ts-ignore
                data.proxyData = proxyData;
            }

            res.status(200).json({
                message: 'Proxy found.',
                data
            });

        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }

    public async removeProxy(req: Request, res: Response) {
        try {

            const id = Number(req.params.id);

            await this.proxyService.removeProxy(id);

            res.status(200).json({
                message: 'Proxy removed.',
            });
        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }

    public async removeAllProxy(req: Request, res: Response) {
        try {
            await this.proxyService.removeAllProxy();

            res.status(200).json({
                message: 'All proxy removed.',
            });
        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }

    public async addProxyData(req: Request, res: Response) {
        try {

            const {
                protocol,
                host,
                username,
                password,
            } = req.body;

            const existingProxyData = await this.proxyService.getProxyDataByHost(host);
            if (existingProxyData) {
                res.status(409).json({
                    error: 'Proxy with that host already exist.',
                })
            }

            await this.proxyService.addProxyData(
                {
                    protocol: <string> protocol,
                    host: <string> host,
                    username: username ? <string> username : undefined,
                    password: password ? <string> password : undefined,
                }
            )

            res.status(200).json({
                message: 'Proxy added.',
            });

        } catch (e: any) {
            res.status(500).json({error: e.message});
        }
    }
}