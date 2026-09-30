/**
 * 对战状态管理：提交、认输、重连、watch 实时推送、轮询兜底、再来一局。
 *
 * 同步策略（双保险）：
 *  - watch 实时推送，断线自动重连（指数退避）
 *  - status=playing 时每 3 秒 reconnect 轮询兜底，watch 正常时只是保险
 */
import { Api } from '../net/Api';
import { BattleView, RematchState } from '../net/Types';
import { CloudError } from '../net/Cloud';
import { EventBus, GameEvent } from '../core/EventBus';
import { TimeSync } from './TimeSync';
import { Logger } from '../core/Logger';

declare const wx: any;

const POLL_INTERVAL = 3000; // playing 全量轮询间隔
const HEARTBEAT_INTERVAL = 5000; // 心跳上报间隔
const ERR_NOT_FOUND = 1003; // 与云端 constants.ERR.NOT_FOUND 对齐

export class BattleManager {
    private static battle: BattleView = null;
    private static rematch: RematchState = null;
    private static watcher: any = null;
    private static battleId = '';

    private static pollHandle: any = 0;
    private static heartbeatHandle: any = 0;
    private static reconnecting = false;
    private static watchRetry = 0;
    private static watchRetryHandle: any = 0;
    private static settledHandled = false; // 结算只处理一次

    /**
     * 判断新状态是否比当前更新（防 watch 与轮询并发导致旧数据覆盖新数据）。
     * 以「句子数 + 状态优先级」比较：settled > playing。
     */
    private static isNewer(next: BattleView): boolean {
        const cur = this.battle;
        if (!cur) return true;
        const rank = (s: string) =>
            s === 'settled' ? 3 : s === 'playing' ? 2 : s === 'waiting' ? 1 : 0;
        if (rank(next.status) !== rank(cur.status)) return rank(next.status) > rank(cur.status);
        if (next.sentences.length !== cur.sentences.length) {
            return next.sentences.length > cur.sentences.length;
        }
        // 同句数：比较当前回合归属是否变化（说明回合推进）
        return next.currentTurn !== cur.currentTurn || next.turnDeadline !== cur.turnDeadline;
    }

    /**
     * 统一应用对局状态：防陈旧 + 广播。
     * 结算事件不再有 wasPlaying 前置条件 —— 只要 settled 就广播，杜绝死锁。
     */
    private static applyBattle(next: BattleView, rematch?: RematchState) {
        const wasSettled = this.battle && this.battle.status === 'settled';

        // 房间已被对方销毁：通知当前页面退出，不再当作有效对局
        if (next.status === 'destroyed') {
            this.battle = next;
            this.stopAllTimers();
            EventBus.emit(GameEvent.BATTLE_DESTROYED, next);
            return;
        }

        // settled 强制接受；playing 按 isNewer 防陈旧
        if (next.status === 'settled' || this.isNewer(next)) {
            this.battle = next;
            EventBus.emit(GameEvent.BATTLE_UPDATE, next);
        }

        if (rematch) {
            this.rematch = rematch;
            EventBus.emit(GameEvent.REMATCH_UPDATE, rematch);
        }

        // 关键修复：只要进入 settled（且此前未处理过结算），无条件广播
        if (next.status === 'settled' && !wasSettled && !this.settledHandled) {
            this.settledHandled = true;
            EventBus.emit(GameEvent.BATTLE_SETTLED, next);
        }
    }

    /** 进入对局：先拉全量状态，再开 watch + 轮询 */
    static async enter(battleId: string): Promise<BattleView> {
        this.stopAllTimers();
        this.leaveWatcher();
        this.battleId = battleId;
        this.settledHandled = false;
        // 关键：进入新对局前清空旧对局状态。否则 isNewer 的「settled(3) > playing(2)」
        // 会把新局首次 BATTLE_UPDATE 判为陈旧而吞掉，页面停留在占位文案/旧数据。
        this.battle = null;
        this.rematch = null;

        // 首拉全量：网络抖动 / 云函数冷启动失败 ≠ 对局不存在。
        // 第二局起云函数实例多已被回收、冷启动更慢，给足重试窗口再判死
        let lastErr: any = null;
        for (let i = 0; i < 5; i++) {
            try {
                await this.refreshFromCloud();
                lastErr = null;
                break;
            } catch (e) {
                lastErr = e;
                // 服务端明确回 1003：对局真的不存在，无需重试
                if (e instanceof CloudError && e.code === ERR_NOT_FOUND) break;
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        if (lastErr) throw lastErr;

        this.openWatcher(battleId);
        this.startPolling();
        this.startHeartbeat();
        return this.battle;
    }

    static getBattle(): BattleView {
        return this.battle;
    }

    static getRematch(): RematchState {
        return this.rematch;
    }

    /** 从云函数拉一次全量状态，经统一入口应用（防陈旧/保证结算广播） */
    private static async refreshFromCloud() {
        const res = await Api.battleReconnect(this.battleId);
        TimeSync.calibrate(res.serverNow);
        this.applyBattle(res.battle, res.rematch);
    }

    static async submit(text: string): Promise<BattleView> {
        const res = await Api.battleSubmit(this.battleId, text);
        TimeSync.calibrate(res.serverNow);
        this.applyBattle(res.battle);
        return this.battle;
    }

    static async surrender(): Promise<BattleView> {
        const res = await Api.battleSurrender(this.battleId);
        TimeSync.calibrate(res.serverNow);
        this.applyBattle(res.battle);
        return this.battle;
    }

    // ============ 再来一局 ============
    static async rematchVote(accept: boolean) {
        const res = await Api.battleRematchVote(this.battleId, accept);
        if (res.rematch) {
            this.rematch = res.rematch;
            EventBus.emit(GameEvent.REMATCH_UPDATE, this.rematch);
        }
        return res;
    }

    static async rematchState() {
        const res = await Api.battleRematchState(this.battleId);
        if (res.rematch) {
            this.rematch = res.rematch;
            EventBus.emit(GameEvent.REMATCH_UPDATE, this.rematch);
        }
        return res.rematch;
    }

    // ============ watch ============
    private static openWatcher(battleId: string) {
        if (typeof wx === 'undefined' || !wx.cloud) return;
        try {
            const db = wx.cloud.database();
            this.watcher = db
                .collection('battles')
                .doc(battleId)
                .watch({
                    onChange: (snapshot: any) => {
                        // watch 正常收到数据：重置重连退避
                        this.watchRetry = 0;
                        const docs = snapshot.docs || [];
                        if (docs.length === 0) return;
                        const raw = docs[0];
                        const view = this.docToView(raw);
                        // 统一入口：防陈旧 + 结算无条件广播（不再依赖 wasPlaying）
                        this.applyBattle(view, raw.rematch);
                    },
                    onError: (err: any) => {
                        Logger.error('BattleManager', 'watch error', err);
                        this.scheduleWatchReconnect();
                    }
                });
        } catch (e) {
            Logger.error('BattleManager', 'open watcher failed', e);
            this.scheduleWatchReconnect();
        }
    }

    /** watch 断线重连：指数退避（1,2,4,8,10秒封顶）；连续失败超限后放弃，靠轮询兜底 */
    private static scheduleWatchReconnect() {
        this.leaveWatcher();
        if (this.watchRetryHandle) clearTimeout(this.watchRetryHandle);

        // 连续失败过多（如环境不支持实时推送/权限限制）：不再重试，
        // 3 秒轮询已能保证状态同步，避免无限重连刷日志
        if (this.watchRetry >= 6) {
            Logger.warn('BattleManager', 'watch 不可用，改用轮询同步');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.watchRetry), 10000);
        this.watchRetry += 1;

        this.watchRetryHandle = setTimeout(async () => {
            this.watchRetryHandle = 0;
            // 重连前先拉全量，补上断线期间漏掉的变更
            try {
                await this.refreshFromCloud();
            } catch (e) {
                // 拉取失败也继续尝试重开 watch
            }
            if (this.battleId) this.openWatcher(this.battleId);
        }, delay) as unknown as number;
    }

    // ============ 轮询兜底 ============
    private static startPolling() {
        if (this.pollHandle) clearInterval(this.pollHandle);
        const tick = async () => {
            const b = this.battle;
            // 对局结束：停止 playing 轮询（协商由 ResultScene 负责）
            if (b && b.status !== 'playing') {
                if (this.pollHandle) {
                    clearInterval(this.pollHandle);
                    this.pollHandle = 0;
                }
                return;
            }
            if (!b || this.reconnecting) return;
            this.reconnecting = true;
            try {
                await this.refreshFromCloud();
            } catch (e) {
                Logger.warn('BattleManager', 'poll refresh failed', e);
            } finally {
                this.reconnecting = false;
            }
        };
        this.pollHandle = setInterval(tick, POLL_INTERVAL);
    }

    // ============ 心跳 ============
    private static startHeartbeat() {
        this.stopHeartbeat();
        const send = async () => {
            // 仅对局进行中需要心跳
            if (!this.battle || this.battle.status !== 'playing') return;
            try {
                await Api.battleHeartbeat(this.battleId);
            } catch (e) {
                // 单次失败忽略，下一轮继续（掉线判活有 120 秒容忍）
            }
        };
        send(); // 进入立即上报一次
        this.heartbeatHandle = setInterval(send, HEARTBEAT_INTERVAL);
    }

    private static stopHeartbeat() {
        if (this.heartbeatHandle) {
            clearInterval(this.heartbeatHandle);
            this.heartbeatHandle = 0;
        }
    }

    private static stopAllTimers() {
        if (this.pollHandle) {
            clearInterval(this.pollHandle);
            this.pollHandle = 0;
        }
        this.stopHeartbeat();
        if (this.watchRetryHandle) {
            clearTimeout(this.watchRetryHandle);
            this.watchRetryHandle = 0;
        }
        this.watchRetry = 0;
    }

    static leaveWatcher() {
        if (this.watcher) {
            try {
                this.watcher.close();
            } catch (e) {
                // ignore
            }
            this.watcher = null;
        }
    }

    /**
     * 彻底清理（退出回大厅）。
     * 同时通知云端把房间置 destroyed（退出即销毁，对方会被带出房间）。
     * 云端销毁不阻塞本地清理。
     */
    static leave() {
        const id = this.battleId;
        this.stopAllTimers();
        this.leaveWatcher();
        this.battle = null;
        this.rematch = null;
        this.battleId = '';
        if (id) {
            Api.battleLeave(id).catch((e) => Logger.warn('BattleManager', 'leave destroy failed', e));
        }
    }

    /** watch 数据库原始文档 -> BattleView */
    private static docToView(raw: any): BattleView {
        const myOpenid = (this.battle &&
            (this.battle.mySide === 'A'
                ? this.battle.playerA.openid
                : this.battle.playerB.openid)) || '';
        const meA = raw.playerA.openid === myOpenid;
        return {
            battleId: raw._id,
            type: raw.type,
            playerA: raw.playerA,
            playerB: raw.playerB,
            starter: raw.starter,
            firstTurn: raw.firstTurn,
            currentTurn: raw.currentTurn,
            sentences: raw.sentences || [],
            status: raw.status,
            winnerOpenid: raw.winnerOpenid,
            endReason: raw.endReason,
            turnDeadline: raw.turnDeadline,
            createTime: raw.createTime,
            endTime: raw.endTime,
            mySide: meA ? 'A' : 'B'
        };
    }
}
