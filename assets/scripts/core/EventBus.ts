/**
 * 全局事件总线
 */
type Handler = (payload?: any) => void;

export class EventBus {
    private static map: Record<string, Handler[]> = {};

    static on(event: string, handler: Handler) {
        (this.map[event] ||= []).push(handler);
    }

    static off(event: string, handler: Handler) {
        const list = this.map[event];
        if (!list) return;
        const i = list.indexOf(handler);
        if (i >= 0) list.splice(i, 1);
    }

    static emit(event: string, payload?: any) {
        const list = this.map[event];
        if (!list) return;
        list.slice().forEach((h) => {
            try {
                h(payload);
            } catch (e) {
                console.error('[EventBus]', event, e);
            }
        });
    }
}

/** 全局事件名 */
export const GameEvent = {
    LOGIN_SUCCESS: 'login_success',
    BATTLE_UPDATE: 'battle_update',
    BATTLE_SETTLED: 'battle_settled',
    REMATCH_UPDATE: 'rematch_update',
    BATTLE_DESTROYED: 'battle_destroyed',
    MATCH_STATUS: 'match_status'
};
