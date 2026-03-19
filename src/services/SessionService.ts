import RedisClient from "../redis/RedisClient";

export default class SessionService {
    private readonly redisClient: RedisClient;
    private readonly MAX_REQUESTS_PER_SESSION = 3;

    private readonly REDIS_KEY = "sessions:";

    // @ts-ignore
    constructor({redisClient, projectConfig}) {

        this.MAX_REQUESTS_PER_SESSION = projectConfig.MAX_REQUESTS_PER_SESSION;

        this.redisClient = redisClient;
    }

    async getUseCount(id: string): Promise<number | null> {
        const instance = this.redisClient.getInstance();

        const isExists = await instance.get(`${this.REDIS_KEY}busy:${id}`);
        if (!isExists) return null;

        return Number(isExists);
    }

    /**
     * If session is already in use at least in one request returns true
     * @param id
     */
    async isBusy(id: string): Promise<boolean> {
        const instance = this.redisClient.getInstance();

        const isExists = await instance.get(`${this.REDIS_KEY}busy:${id}`);
        return !!isExists;
    }

    async isAvailable(id: string): Promise<boolean> {
        const useCount = await this.getUseCount(id);
        if (!useCount) return true;

        return useCount < this.MAX_REQUESTS_PER_SESSION;
    }

    async setAsBusy(id: string): Promise<void> {
        const instance = this.redisClient.getInstance();

        let useCount = await this.getUseCount(id);
        if (!useCount) useCount = 0;

        await instance.setex
        (
            `${this.REDIS_KEY}busy:${id}`
            , 120
            , useCount + 1
        );
    }

    async setAsFree(id: string): Promise<void> {
        const instance = this.redisClient.getInstance();


        let useCount = await this.getUseCount(id);
        if (!useCount) return;

        if (useCount <= 1) {
            await instance.del(`${this.REDIS_KEY}busy:${id}`);
            return;
        }

        await instance.setex
        (
            `${this.REDIS_KEY}busy:${id}`
            , 120
            , useCount - 1
        );
    }
}

export class SessionIsBusyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionIsBusyError';
    }
}