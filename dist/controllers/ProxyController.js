"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ProxyController {
    // @ts-ignore
    constructor({ proxyService }) {
        this.proxyService = proxyService;
    }
    async getProxies(req, res) {
        try {
            const count = req.query?.count;
            const isActive = req.query?.isActive;
            const proxies = await this.proxyService.getAllProxy(Number(count) || 50, isActive === 'true');
            res.status(200).json({
                message: 'Proxies found',
                data: {
                    proxies,
                },
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    async getProxy(req, res) {
        try {
            const id = Number(req.params.id);
            const isGetData = req.query?.proxyData;
            const proxy = await this.proxyService.getProxyById(id);
            if (!proxy) {
                return res.status(404).json({
                    error: 'Proxy not found',
                });
            }
            const data = {
                proxy: proxy,
            };
            if (isGetData === 'true') {
                const proxyData = await this.proxyService.getProxyData(proxy.proxyDataId);
                // @ts-ignore
                data.proxyData = proxyData;
            }
            res.status(200).json({
                message: 'Proxy found.',
                data
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    async removeProxy(req, res) {
        try {
            const id = Number(req.params.id);
            await this.proxyService.removeProxy(id);
            res.status(200).json({
                message: 'Proxy removed.',
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    async removeAllProxy(req, res) {
        try {
            await this.proxyService.removeAllProxy();
            res.status(200).json({
                message: 'All proxy removed.',
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    async addProxyData(req, res) {
        try {
            const { protocol, host, username, password, } = req.body;
            const existingProxyData = await this.proxyService.getProxiesByHost(host);
            if (existingProxyData.length > 0) {
                const isProxyExist = existingProxyData.some((proxyData) => proxyData.username === username);
                if (username && isProxyExist) {
                    return res.status(409).json({
                        error: 'Proxy with that host already exist.',
                    });
                }
            }
            await this.proxyService.addProxyData({
                protocol: protocol,
                host: host,
                username: username ? username : undefined,
                password: password ? password : undefined,
            });
            res.status(200).json({
                message: 'Proxy added.',
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
}
exports.default = ProxyController;
