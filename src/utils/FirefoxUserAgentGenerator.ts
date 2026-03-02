interface UserAgentOptions {
    os?: 'windows' | 'macos' | 'linux';
    mobile?: boolean;
}

export class FirefoxUserAgentGenerator {
    private static readonly firefoxVersions = [
        '133.0',
        '132.0',
        '131.0',
        '130.0',
        '129.0',
    ];

    private static readonly windowsVersions = [
        'Windows NT 10.0; Win64; x64',
        'Windows NT 10.0; WOW64',
    ];

    private static readonly macVersions = [
        'Macintosh; Intel Mac OS X 10.15',
        'Macintosh; Intel Mac OS X 13.5',
        'Macintosh; Intel Mac OS X 14.1',
    ];

    private static readonly linuxVersions = [
        'X11; Linux x86_64',
        'X11; Ubuntu; Linux x86_64',
    ];

    private static readonly mobileDevices = [
        { device: 'Android 14; Mobile', token: 'Fenix' },
        { device: 'Android 13; Mobile', token: 'Fenix' },
        { device: 'iPhone; CPU iPhone OS 17_1 like Mac OS X', token: 'FxiOS' },
    ];

    static generate(options: UserAgentOptions = {}): string {
        const { os = this.randomOs(), mobile = false } = options;

        if (mobile) {
            return this.generateMobile();
        }

        return this.generateDesktop(os);
    }

    private static generateDesktop(os: 'windows' | 'macos' | 'linux'): string {
        const version = this.randomElement(this.firefoxVersions);

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

        // Firefox не использует AppleWebKit/Chrome токены — только Gecko
        return `Mozilla/5.0 (${platform}; rv:${version}) Gecko/20100101 Firefox/${version}`;
    }

    private static generateMobile(): string {
        const version = this.randomElement(this.firefoxVersions);
        const device = this.randomElement(this.mobileDevices);

        if (device.token === 'FxiOS') {
            // Firefox на iOS использует WebKit под капотом
            return `Mozilla/5.0 (${device.device}) AppleWebKit/605.1.15 (KHTML, like Gecko) ${device.token}/${version} Mobile/15E148 Safari/604.1`;
        }

        // Firefox для Android (Fenix)
        return `Mozilla/5.0 (${device.device}; rv:${version}) Gecko/20100101 Firefox/${version}`;
    }

    private static randomElement<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    private static randomOs(): 'windows' | 'macos' | 'linux' {
        const options: Array<'windows' | 'macos' | 'linux'> = ['windows', 'macos', 'linux'];
        return this.randomElement(options);
    }
}
