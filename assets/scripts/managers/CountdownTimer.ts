/**
 * 回合倒计时：显示用。截止时刻来自服务端 turnDeadline，
 * 配合 TimeSync 抵消本地时钟偏差。
 */
import { TimeSync } from './TimeSync';

export class CountdownTimer {
    private deadline = 0;
    private handle = 0;
    private remainingCb: (sec: number) => void = null;
    private endCb: () => void = null;
    private ended = false;

    /**
     * @param turnDeadline 服务端回合截止时间戳
     * @param onTick 每秒剩余秒数（含小数时向下取整）
     * @param onEnd 到点回调（真实胜负仍以云函数/推送为准）
     */
    start(turnDeadline: number, onTick: (sec: number) => void, onEnd: () => void) {
        this.stop();
        this.deadline = turnDeadline;
        this.remainingCb = onTick;
        this.endCb = onEnd;
        this.ended = false;
        this.tick();
    }

    private tick = () => {
        const remainMs = this.deadline - TimeSync.now();
        const sec = Math.max(0, Math.ceil(remainMs / 1000));

        if (this.remainingCb) this.remainingCb(sec);

        if (remainMs <= 0) {
            if (!this.ended) {
                this.ended = true;
                if (this.endCb) this.endCb();
            }
            return;
        }
        // 250ms 刷新一次，保证秒数切换及时
        this.handle = setTimeout(this.tick, 250) as unknown as number;
    };

    stop() {
        if (this.handle) {
            clearTimeout(this.handle);
            this.handle = 0;
        }
    }
}
