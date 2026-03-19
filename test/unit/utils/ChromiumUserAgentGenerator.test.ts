import { ChromiumUserAgentGenerator } from "../../../src/utils/ChromiumUserAgentGenerator";

const generator = ChromiumUserAgentGenerator as any;

describe('ChromiumUserAgentGenerator', () => {
    describe('generate()', () => {
        it('должен возвращать строку', () => {
            const ua = ChromiumUserAgentGenerator.generate();
            expect(typeof ua).toBe('string');
            expect(ua.length).toBeGreaterThan(0);
        });

        it('должен начинаться с Mozilla/5.0', () => {
            const ua = ChromiumUserAgentGenerator.generate();
            expect(ua).toMatch(/^Mozilla\/5\.0/);
        });

        it('должен содержать AppleWebKit и Chrome при вызове без параметров', () => {
            const ua = ChromiumUserAgentGenerator.generate();
            expect(ua).toMatch(/AppleWebKit/);
            expect(ua).toMatch(/Chrome\//);
        });
    });

    describe('generate({ os })', () => {
        it('windows — содержит Windows NT и Win64', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'windows' });
            expect(ua).toMatch(/Windows NT \d+\.\d+; Win64; x64/);
        });

        it('macos — содержит Macintosh и Intel Mac OS X', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'macos' });
            expect(ua).toMatch(/Macintosh; Intel Mac OS X/);
        });

        it('linux — содержит X11 и Linux x86_64', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'linux' });
            expect(ua).toMatch(/X11;.*Linux x86_64/);
        });

        it('desktop UA содержит корректную версию Chrome из списка', () => {
            const validVersions = generator.chromeVersions as string[];
            const ua = ChromiumUserAgentGenerator.generate({ os: 'windows' });
            const match = ua.match(/Chrome\/([\d.]+)/);
            expect(match).not.toBeNull();
            expect(validVersions).toContain(match![1]);
        });

        it('desktop UA заканчивается на Safari/537.36', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'linux' });
            expect(ua).toMatch(/Safari\/537\.36$/);
        });
    });

    describe('generate({ mobile: true })', () => {
        it('должен возвращать мобильный UA', () => {
            const ua = ChromiumUserAgentGenerator.generate({ mobile: true });
            expect(ua).toMatch(/Mobile/);
        });

        it('содержит корректную версию Chrome из списка', () => {
            const validVersions = generator.chromeVersions as string[];
            for (let i = 0; i < 20; i++) {
                const ua = ChromiumUserAgentGenerator.generate({ mobile: true });
                const match = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
                expect(match).not.toBeNull();
                expect(validVersions).toContain(match![1]);
            }
        });
    });

    describe('iOS mobile UA', () => {
        beforeEach(() => {
            // @ts-ignore
            jest.spyOn(generator, 'randomElement').mockImplementation((arr: any[]) => {
                if (arr === generator.mobileDevices) {
                    return { device: 'iPhone; CPU iPhone OS 17_1 like Mac OS X', os: 'iOS' };
                }
                return arr[0];
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('использует WebKit 605.1.15 и CriOS для iOS', () => {
            const ua = ChromiumUserAgentGenerator.generate({ mobile: true });
            expect(ua).toMatch(/AppleWebKit\/605\.1\.15/);
            expect(ua).toMatch(/CriOS\//);
            expect(ua).toMatch(/Safari\/604\.1$/);
        });
    });

    describe('Android mobile UA', () => {
        beforeEach(() => {
            // @ts-ignore
            jest.spyOn(generator, 'randomElement').mockImplementation((arr: any[]) => {
                if (arr === generator.mobileDevices) {
                    return { device: 'Pixel 7', os: 'Android 14' };
                }
                return arr[0];
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('содержит Linux, версию Android и название устройства', () => {
            const ua = ChromiumUserAgentGenerator.generate({ mobile: true });
            expect(ua).toMatch(/Linux; Android 14; Pixel 7/);
            expect(ua).toMatch(/Mobile Safari\/537\.36$/);
        });
    });

    describe('детерминированность через мок randomElement', () => {
        beforeEach(() => {
            // @ts-ignore
            jest.spyOn(generator, 'randomElement').mockImplementation((arr: any[]) => arr[0]);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('windows — возвращает ожидаемый UA', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'windows' });
            expect(ua).toBe(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36',
            );
        });

        it('macos — возвращает ожидаемый UA', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'macos' });
            expect(ua).toBe(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36',
            );
        });

        it('linux — возвращает ожидаемый UA', () => {
            const ua = ChromiumUserAgentGenerator.generate({ os: 'linux' });
            expect(ua).toBe(
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36',
            );
        });

        it('mobile android — возвращает ожидаемый UA', () => {
            const ua = ChromiumUserAgentGenerator.generate({ mobile: true });
            expect(ua).toBe(
                'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Mobile Safari/537.36',
            );
        });
    });

    describe('randomOs() через мок', () => {
        it('при mobile=false и без явного os — вызывает randomOs', () => {
            const spy = jest.spyOn(generator, 'randomOs');
            ChromiumUserAgentGenerator.generate();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

    });

    describe('generate() — вариативность', () => {
        it('при повторных вызовах генерирует хотя бы 2 разных UA (проверка случайности)', () => {
            const results = new Set(Array.from({ length: 30 }, () => ChromiumUserAgentGenerator.generate()));
            expect(results.size).toBeGreaterThan(1);
        });
    });
});