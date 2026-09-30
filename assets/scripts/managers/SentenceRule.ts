/**
 * 接龙规则（客户端即时反馈版，与云函数 common/rules.js 一致）
 * 最终判定以云函数为准。
 */

const SENTENCE_MIN = 5;
const SENTENCE_MAX = 30;

export enum RuleError {
    None = 0,
    Length = 2001,
    Match = 2002,
    Dup = 2003
}

export class SentenceRule {
    /** 过滤标点/空格/emoji/非汉字 */
    static filterHanzi(text: string): string {
        const matched = text.match(/[一-鿿㐀-䶿]/g);
        return matched ? matched.join('') : '';
    }

    /**
     * 归一化：非汉字过滤 + 繁转简
     * 生产环境接入 opencc（如引入 opencc-js 的 wasm 构建），
     * 未接入时仅做过滤，最终由云函数兜底繁简归一。
     */
    static normalize(text: string): string {
        return this.filterHanzi(text);
    }

    static lastChar(text: string): string {
        return text ? text[text.length - 1] : '';
    }

    /**
     * 本地校验
     * @param raw 原始输入
     * @param expectedFirstChar 期望首字（上一句末字）
     * @param used 本局已使用的归一化句子
     */
    static validate(raw: string, expectedFirstChar: string, used: string[]): RuleError {
        const text = this.normalize(raw);

        if (text.length < SENTENCE_MIN || text.length > SENTENCE_MAX) return RuleError.Length;
        if (text[0] !== expectedFirstChar) return RuleError.Match;
        if (used.indexOf(text) !== -1) return RuleError.Dup;
        return RuleError.None;
    }

    static errorText(err: RuleError): string {
        switch (err) {
            case RuleError.Length:
                return '句子需为5-30个汉字';
            case RuleError.Match:
                return '首尾字不匹配';
            case RuleError.Dup:
                return '该句子本局已用过';
            default:
                return '';
        }
    }
}
