/**
 * 后端 API 汇总：与 cloud/README.md 接口契约一一对应
 */
import { Cloud } from './Cloud';
import {
    UserProfile,
    BattleView,
    RankData,
    LevelData,
    RemoteConfig,
    MatchPoll,
    RoomDetail,
    BattleRecord,
    RematchState
} from './Types';

export const Api = {
    // —— 登录 ——
    login(nickName?: string, avatarUrl?: string) {
        return Cloud.call<{ profile: UserProfile }>('login', { nickName, avatarUrl });
    },

    // —— 好友房 ——
    roomCreate() {
        return Cloud.call<{ roomId: string; deadline: number }>('room', { action: 'create' });
    },
    roomJoin(roomId: string) {
        return Cloud.call<{ battleId: string }>('room', { action: 'join', roomId });
    },
    roomLeave(roomId: string) {
        return Cloud.call<{}>('room', { action: 'leave', roomId });
    },
    roomDetail(roomId: string) {
        return Cloud.call<RoomDetail>('room', { action: 'detail', roomId });
    },

    // —— 随机匹配 ——
    matchEnqueue() {
        return Cloud.call<{ deadline: number }>('match', { action: 'enqueue' });
    },
    matchCancel() {
        return Cloud.call<{}>('match', { action: 'cancel' });
    },
    matchPoll() {
        return Cloud.call<MatchPoll>('match', { action: 'poll' });
    },

    // —— 对局 ——
    battleSubmit(battleId: string, text: string) {
        return Cloud.call<{ battle: BattleView; serverNow: number }>('battle', {
            action: 'submit',
            battleId,
            text
        });
    },
    battleSurrender(battleId: string) {
        return Cloud.call<{ battle: BattleView; serverNow: number }>('battle', {
            action: 'surrender',
            battleId
        });
    },
    battleReconnect(battleId: string) {
        return Cloud.call<{
            battle: BattleView;
            rematch?: RematchState;
            serverNow: number;
        }>('battle', {
            action: 'reconnect',
            battleId
        });
    },

    // —— 心跳 ——
    battleHeartbeat(battleId: string) {
        return Cloud.call<{ ok: boolean; serverNow: number }>('battle', {
            action: 'heartbeat',
            battleId
        });
    },

    // —— 退出即销毁 ——
    battleLeave(battleId: string) {
        return Cloud.call<{ status: string }>('battle', {
            action: 'leave',
            battleId
        });
    },

    // —— 再来一局协商 ——
    battleRematchVote(battleId: string, accept: boolean) {
        return Cloud.call<{ rematch: RematchState; newBattleId?: string }>('battle', {
            action: 'rematchVote',
            battleId,
            accept
        });
    },
    battleRematchState(battleId: string) {
        return Cloud.call<{ rematch: RematchState; serverNow: number }>('battle', {
            action: 'rematchState',
            battleId
        });
    },

    // —— 排行榜 ——
    rankList() {
        return Cloud.call<RankData>('rank', { action: 'list' });
    },

    // —— 闯关模式 ——
    levelStart() {
        return Cloud.call<LevelData>('level', { action: 'start' });
    },
    levelPass() {
        return Cloud.call<LevelData>('level', { action: 'pass' });
    },
    levelFail() {
        return Cloud.call<LevelData>('level', { action: 'fail' });
    },

    // —— 个人中心 ——
    profileRecords(page = 1, pageSize = 20) {
        return Cloud.call<{ items: BattleRecord[]; total: number; page: number; pageSize: number }>(
            'profile',
            { action: 'records', page, pageSize }
        );
    },
    profileUpdate(nickName?: string, avatarUrl?: string) {
        return Cloud.call<{ profile: UserProfile }>('profile', {
            action: 'update',
            nickName,
            avatarUrl
        });
    },

    // —— 配置 ——
    getConfig() {
        return Cloud.call<{ config: RemoteConfig; serverNow: number }>('getConfig', {});
    }
};
