/**
 * 随机匹配流程：入队 → 轮询 → 成功/超时/失败
 */
import { Api } from '../net/Api';
import { CloudError } from '../net/Cloud';
import { Logger } from '../core/Logger';

// 与云端 constants.ERR.IN_BATTLE 对齐
const ERR_IN_BATTLE = 6001;

export type MatchResult =
    | { ok: true; battleId: string }
    | { ok: false; reason: 'timeout' | 'failed' | 'canceled'; message?: string; battleId?: string };

export class MatchManager {
    private polling = false;
    private canceled = false;
    private handle = 0;
    // 配对写入是多次异步 DB 操作，期间对方 poll 可能短暂拿到 idle：
    // 给予重试宽限而不是立刻判失败
    private idleRetries = 0;
    private static MAX_IDLE_RETRIES = 3;

    /** 开始匹配，直到出结果（resolve） */
    start(): Promise<MatchResult> {
        this.canceled = false;
        return (async () => {
            try {
                await Api.matchEnqueue();
            } catch (e) {
                // 透传服务端文案，区分 6001「你已有进行中的对局」/ 5002「匹配失败」/ 其他
                Logger.warn('MatchManager', 'enqueue failed', e);
                // 6001 已在进行中对局：带上 battleId 供前端直接返场
                if (e instanceof CloudError && e.code === ERR_IN_BATTLE && e.data && e.data.battleId) {
                    return {
                        ok: false,
                        reason: 'failed',
                        message: e.message,
                        battleId: e.data.battleId
                    };
                }
                const message = e instanceof CloudError ? e.message : '匹配失败，请稍后再试';
                return { ok: false, reason: 'failed', message };
            }
            return this.loop();
        })();
    }

    private loop(): Promise<MatchResult> {
        this.polling = true;

        return new Promise<MatchResult>((resolve) => {
            const step = async () => {
                if (this.canceled) {
                    this.polling = false;
                    resolve({ ok: false, reason: 'canceled' });
                    return;
                }

                let poll: any;
                try {
                    poll = await Api.matchPoll();
                } catch (e) {
                    // 单次轮询出错，稍后重试，直到 180s 由服务端超时
                    this.handle = setTimeout(step, 2000) as unknown as number;
                    return;
                }

                if (poll.status === 'matched') {
                    this.polling = false;
                    resolve({ ok: true, battleId: poll.battleId });
                    return;
                }
                if (poll.status === 'timeout') {
                    this.polling = false;
                    resolve({ ok: false, reason: 'timeout' });
                    return;
                }
                if (poll.status === 'idle') {
                    // 短暂 idle（配对进行中）稍后重查；多次仍 idle 才算失败
                    if (this.idleRetries < MatchManager.MAX_IDLE_RETRIES) {
                        this.idleRetries += 1;
                        this.handle = setTimeout(step, 1500) as unknown as number;
                        return;
                    }
                    this.polling = false;
                    resolve({ ok: false, reason: 'failed' });
                    return;
                }
                // waiting：2s 后继续
                this.handle = setTimeout(step, 2000) as unknown as number;
            };
            step();
        });
    }

    async cancel(): Promise<void> {
        this.canceled = true;
        if (this.handle) {
            clearTimeout(this.handle);
            this.handle = 0;
        }
        if (this.polling) {
            try {
                await Api.matchCancel();
            } catch (e) {
                // ignore
            }
        }
        this.polling = false;
    }
}
