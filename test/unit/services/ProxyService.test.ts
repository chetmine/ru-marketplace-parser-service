import ProxyService from '../../../src/services/proxy/ProxyService';
import { ProxyStatus } from '@prisma-app/client';

// Mock p-limit
jest.mock('p-limit', () => () => (fn: any) => fn());

// Mock loggerFactory
jest.mock('../../../src/utils/logger', () => ({
    loggerFactory: jest.fn().mockReturnValue({
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn()
    })
}));

describe('ProxyService', () => {
    let proxyService: ProxyService;
    let mockProxyRepo: any;
    let mockProxyDataRepo: any;
    let mockEventBus: any;

    beforeEach(() => {
        mockProxyRepo = {
            findBySessionId: jest.fn(),
            findFreeOptimistic: jest.fn(),
            upsert: jest.fn(),
            findAll: jest.fn(),
            delete: jest.fn(),
            deleteAll: jest.fn(),
            updateMany: jest.fn(),
            transaction: jest.fn(),
            findById: jest.fn(),
            findByDataId: jest.fn(),
            findFree: jest.fn(),
            create: jest.fn(),
        };

        mockProxyDataRepo = {
            findById: jest.fn(),
            findByHost: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
            deleteAll: jest.fn(),
        };

        mockEventBus = {
            emit: jest.fn(),
            on: jest.fn(),
        };

        proxyService = new ProxyService({
            proxyDataRepo: mockProxyDataRepo,
            proxyRepo: mockProxyRepo,
            eventBus: mockEventBus
        });
    });

    describe('attachProxy', () => {
        it('should return existing proxy if session already has one', async () => {
            const sessionId = 'session-123';
            const existingProxy = { id: 1, proxyDataId: 10, sessionId };
            const proxyData = { id: 10, host: '127.0.0.1' };

            mockProxyRepo.findBySessionId.mockResolvedValue(existingProxy);
            mockProxyDataRepo.findById.mockResolvedValue(proxyData);

            const result = await proxyService.attachProxy(sessionId);

            expect(mockProxyRepo.findBySessionId).toHaveBeenCalledWith(sessionId);
            expect(mockProxyDataRepo.findById).toHaveBeenCalledWith(10);
            expect(result).toEqual(proxyData);
            expect(mockProxyRepo.findFreeOptimistic).not.toHaveBeenCalled();
        });

        it('should successfully attach a free proxy on first try', async () => {
            const sessionId = 'session-123';
            const freeProxy = { id: 2, proxyDataId: 20, sessionId: null };
            const proxyData = { id: 20, host: '1.2.3.4' };

            mockProxyRepo.findBySessionId.mockResolvedValue(null);
            mockProxyRepo.findFreeOptimistic.mockResolvedValue(freeProxy);
            mockProxyRepo.upsert.mockResolvedValue({ ...freeProxy, sessionId });
            mockProxyDataRepo.findById.mockResolvedValue(proxyData);

            const result = await proxyService.attachProxy(sessionId);

            expect(mockProxyRepo.findFreeOptimistic).toHaveBeenCalledTimes(1);
            expect(mockProxyRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
                id: 2,
                sessionId: sessionId
            }));
            expect(result).toEqual(proxyData);
        });

        it('should retry on optimistic lock failure and succeed', async () => {
            const sessionId = 'session-123';
            const freeProxy = { id: 2, proxyDataId: 20, sessionId: null };
            const proxyData = { id: 20, host: '1.2.3.4' };

            mockProxyRepo.findBySessionId.mockResolvedValue(null);

            // First attempt fails with Optimistic lock failed
            // Second attempt succeeds
            mockProxyRepo.findFreeOptimistic
                .mockRejectedValueOnce(new Error('Optimistic lock failed'))
                .mockResolvedValueOnce(freeProxy);

            mockProxyRepo.upsert.mockResolvedValue({ ...freeProxy, sessionId });
            mockProxyDataRepo.findById.mockResolvedValue(proxyData);

            const result = await proxyService.attachProxy(sessionId);

            expect(mockProxyRepo.findFreeOptimistic).toHaveBeenCalledTimes(2);
            expect(result).toEqual(proxyData);
        });

        it('should throw error after max retries of optimistic lock failure', async () => {
            const sessionId = 'session-123';

            mockProxyRepo.findBySessionId.mockResolvedValue(null);
            // Always fail
            mockProxyRepo.findFreeOptimistic.mockRejectedValue(new Error('Optimistic lock failed'));

            await expect(proxyService.attachProxy(sessionId))
                .rejects.toThrow('Optimistic lock failed');

            // Max retries is 5
            expect(mockProxyRepo.findFreeOptimistic).toHaveBeenCalledTimes(5);
        });

        it('should return undefined if no free proxy is found', async () => {
            const sessionId = 'session-123';

            mockProxyRepo.findBySessionId.mockResolvedValue(null);
            mockProxyRepo.findFreeOptimistic.mockRejectedValue(new Error('Free proxy Not Found'));

            const result = await proxyService.attachProxy(sessionId);

            expect(result).toBeUndefined();
        });
    });

    describe('replaceProxyById', () => {
        it('should throw error if current proxy not found for session', async () => {
            const sessionId = 'session-123';
            mockProxyRepo.findBySessionId.mockResolvedValue(null);

            await expect(proxyService.replaceProxyById(sessionId))
                .rejects.toThrow('Proxy not found.');
        });

        it('should successfully replace proxy', async () => {
            const sessionId = 'session-123';
            const oldProxy = { id: 1, proxyDataId: 10, sessionId, status: ProxyStatus.ACTIVE };
            const freeProxy = { id: 2, proxyDataId: 20, sessionId: null };
            const newProxyData = { id: 20, host: '1.2.3.4' };

            mockProxyRepo.findBySessionId.mockResolvedValue(oldProxy);
            mockProxyRepo.findFreeOptimistic.mockResolvedValue(freeProxy);
            mockProxyDataRepo.findById.mockResolvedValue(newProxyData);

            const result = await proxyService.replaceProxyById(sessionId);

            // Verify old proxy suspended
            expect(mockProxyRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
                id: 1,
                status: ProxyStatus.SUSPENDED,
                sessionId: null
            }));

            // Verify new proxy assigned
            expect(mockProxyRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
                id: 2,
                sessionId: sessionId
            }));

            expect(result).toEqual(newProxyData);
        });

        it('should retry on optimistic lock failure during replacement', async () => {
            const sessionId = 'session-123';
            const oldProxy = { id: 1, proxyDataId: 10, sessionId, status: ProxyStatus.ACTIVE };
            const freeProxy = { id: 2, proxyDataId: 20, sessionId: null };
            const newProxyData = { id: 20, host: '1.2.3.4' };

            mockProxyRepo.findBySessionId.mockResolvedValue(oldProxy);

            mockProxyRepo.findFreeOptimistic
                .mockRejectedValueOnce(new Error('Optimistic lock failed'))
                .mockResolvedValueOnce(freeProxy);

            mockProxyDataRepo.findById.mockResolvedValue(newProxyData);

            const result = await proxyService.replaceProxyById(sessionId);

            expect(mockProxyRepo.findFreeOptimistic).toHaveBeenCalledTimes(2);
            expect(result).toEqual(newProxyData);
        });

        it('should throw error if free proxy not found during replacement', async () => {
             const sessionId = 'session-123';
             const oldProxy = { id: 1, proxyDataId: 10, sessionId, status: ProxyStatus.ACTIVE };

             mockProxyRepo.findBySessionId.mockResolvedValue(oldProxy);
             mockProxyRepo.findFreeOptimistic.mockResolvedValue(null); // Or throws "Proxy Not Found" depending on implementation?
             // Implementation: if (!freeProxy) throw new Error("Proxy Not Found");

             await expect(proxyService.replaceProxyById(sessionId))
                 .rejects.toThrow('Proxy Not Found');
        });
    });
});
