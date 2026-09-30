/**
 * 日志：编辑器/开发版打印，发布版静默
 */
export class Logger {
    static enabled = true;

    static info(tag: string, ...args: unknown[]) {
        if (this.enabled) console.log(`%c[${tag}]`, 'color:#3E5C6E', ...args);
    }

    static warn(tag: string, ...args: unknown[]) {
        if (this.enabled) console.warn(`[${tag}]`, ...args);
    }

    static error(tag: string, ...args: unknown[]) {
        if (this.enabled) console.error(`[${tag}]`, ...args);
    }
}
