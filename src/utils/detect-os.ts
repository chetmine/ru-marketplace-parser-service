import os from 'os';

export function detectOS(): 'windows' | 'macos' | 'linux' {
    const platform = os.platform();

    const map: Record<string, string> = {
        win32: 'windows',
        darwin: 'macos',
        linux: 'linux',
    };

    // @ts-ignore
    return map[platform] ?? 'linux';
}