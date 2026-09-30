/**
 * 服务端时间同步：用云函数返回的 serverNow 校准偏移，
 * 所有倒计时以服务端时间为准，不信任本地时钟。
 */
export class TimeSync {
    private static offset = 0; // serverNow - Date.now()

    /** 用一次请求的往返校准 */
    static calibrate(serverNow: number) {
        if (!serverNow) return;
        this.offset = serverNow - Date.now();
    }

    /** 更精确的往返校准：t0 发起，serverNow 服务端时刻，t1 收到 */
    static calibrateRtt(serverNow: number, t0: number, t1: number) {
        const rtt = t1 - t0;
        // 假设上下行对称，服务端时刻对应本地 t0 + rtt/2
        this.offset = serverNow - (t0 + rtt / 2);
    }

    static now(): number {
        return Date.now() + this.offset;
    }

    static getOffset(): number {
        return this.offset;
    }
}
