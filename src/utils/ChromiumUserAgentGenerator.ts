interface UserAgentOptions {
    os?: 'windows' | 'macos' | 'linux';
    mobile?: boolean;
}

export class ChromiumUserAgentGenerator {
    private static readonly chromeVersions = [
        '131.0.6778.86',
        '131.0.6778.108',
        '130.0.6723.116',
        '130.0.6723.92',
        '129.0.6668.100',
    ];

    private static readonly windowsVersions = [
        'Windows NT 10.0; Win64; x64',
        'Windows NT 11.0; Win64; x64',
    ];

    private static readonly macVersions = [
        'Macintosh; Intel Mac OS X 10_15_7',
        'Macintosh; Intel Mac OS X 13_5_1',
        'Macintosh; Intel Mac OS X 14_1_0',
    ];

    private static readonly linuxVersions = [
        'X11; Linux x86_64',
    ];

    private static readonly mobileDevices = [
        { device: 'Pixel 7', os: 'Android 14' },
        { device: 'SM-G998B', os: 'Android 13' },
        { device: 'iPhone; CPU iPhone OS 17_1 like Mac OS X', os: 'iOS' },
    ];

    static generate(options: UserAgentOptions = {}): string {
        const { os = this.randomOs(), mobile = false } = options;

        if (mobile) {
            return this.generateMobile();
        }

        return this.generateDesktop(os);
    }

    private static generateDesktop(os: 'windows' | 'macos' | 'linux'): string {
        const version = this.randomElement(this.chromeVersions);
        const majorVersion = version.split('.')[0];

        let platform: string;
        switch (os) {
            case 'windows':
                platform = this.randomElement(this.windowsVersions);
                break;
            case 'macos':
                platform = this.randomElement(this.macVersions);
                break;
            case 'linux':
                platform = this.randomElement(this.linuxVersions);
                break;
        }

        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }

    private static generateMobile(): string {
        const version = this.randomElement(this.chromeVersions);
        const device = this.randomElement(this.mobileDevices);

        if (device.os === 'iOS') {
            return `Mozilla/5.0 (${device.device}) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${version} Mobile/15E148 Safari/604.1`;
        }

        return `Mozilla/5.0 (Linux; ${device.os}; ${device.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Mobile Safari/537.36`;
    }

    private static randomElement<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    private static randomOs(): 'windows' | 'macos' | 'linux' {
        const options: Array<'windows' | 'macos' | 'linux'> = ['windows', 'macos', 'linux'];
        return this.randomElement(options);
    }
}