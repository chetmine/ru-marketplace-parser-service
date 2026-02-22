"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionIsBusyError = void 0;
class SessionService {
    // @ts-ignore
    constructor({ redisClient, projectConfig }) {
        this.MAX_REQUESTS_PER_SESSION = 3;
        this.REDIS_KEY = "sessions:";
        this.MAX_REQUESTS_PER_SESSION = projectConfig.MAX_REQUESTS_PER_SESSION;
        this.redisClient = redisClient;
    }
    async getUseCount(id) {
        const instance = this.redisClient.getInstance();
        const isExists = await instance.get(`${this.REDIS_KEY}busy:${id}`);
        if (!isExists)
            return null;
        return Number(isExists);
    }
    /**
     * If session is already in use at least in one request returns true
     * @param id
     */
    async isBusy(id) {
        const instance = this.redisClient.getInstance();
        const isExists = await instance.get(`${this.REDIS_KEY}busy:${id}`);
        return !!isExists;
    }
    async isAvailable(id) {
        const useCount = await this.getUseCount(id);
        if (!useCount)
            return true;
        return useCount < this.MAX_REQUESTS_PER_SESSION;
    }
    async setAsBusy(id) {
        const instance = this.redisClient.getInstance();
        let useCount = await this.getUseCount(id);
        if (!useCount)
            useCount = 0;
        await instance.setex(`${this.REDIS_KEY}busy:${id}`, 120, useCount + 1);
    }
    async setAsFree(id) {
        const instance = this.redisClient.getInstance();
        let useCount = await this.getUseCount(id);
        if (!useCount)
            return;
        if (useCount <= 1) {
            await instance.del(`${this.REDIS_KEY}busy:${id}`);
            return;
        }
        await instance.setex(`${this.REDIS_KEY}busy:${id}`, 120, useCount - 1);
    }
}
exports.default = SessionService;
class SessionIsBusyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SessionIsBusyError';
    }
}
exports.SessionIsBusyError = SessionIsBusyError;
