/**
 * 前后端共用数据结构（与云函数返回对应）
 */

export interface UserProfile {
    openid: string;
    nickName: string;
    avatarUrl: string;
    score: number;
    win: number;
    lose: number;
}

export type BattleStatus = 'waiting' | 'playing' | 'settled' | 'canceled';
export type BattleType = 'friend' | 'random';
export type EndReason = '' | 'timeout' | 'surrender' | 'disconnect';

export interface BattlePlayer {
    openid: string;
    nickName: string;
}

export interface BattleSentence {
    seq: number;
    openid: string;
    text: string;
    time: number;
}

export interface BattleView {
    battleId: string;
    type: BattleType;
    playerA: BattlePlayer;
    playerB: BattlePlayer;
    starter: string;
    firstTurn: string;
    currentTurn: string;
    sentences: BattleSentence[];
    status: BattleStatus;
    winnerOpenid: string;
    endReason: EndReason;
    turnDeadline: number;
    createTime: number;
    endTime: number;
    mySide: 'A' | 'B';
}

export interface RankItem {
    rank: number;
    openid: string;
    nickName: string;
    avatarUrl: string;
    score: number;
}

export interface RankData {
    topList: RankItem[];
    myRank: number;
    me: { nickName: string; avatarUrl: string; score: number } | null;
    serverNow: number;
}

export type MatchPoll =
    | { status: 'waiting'; serverNow: number; deadline: number }
    | { status: 'matched'; battleId: string }
    | { status: 'timeout' }
    | { status: 'idle' };

export interface RoomDetail {
    roomId: string;
    ownerOpenid: string;
    guestOpenid: string;
    status: BattleStatus;
    battleId: string;
    deadline: number;
    serverNow: number;
}

export interface BattleRecord {
    battleId: string;
    type: BattleType;
    opponentName: string;
    win: boolean;
    scoreDelta: number;
    reason: EndReason;
    time: number;
}

export type RematchVoteValue = 'pending' | 'accepted' | 'declined';
export type RematchStateValue = 'asking' | 'accepted' | 'declined';

export interface RematchState {
    state: RematchStateValue;
    a: RematchVoteValue;
    b: RematchVoteValue;
    deadline: number;
    newBattleId: string;
}

/** 闯关模式：关卡进度（users.levelProgress） */
export interface LevelData {
    level: number;
    passed: number;
    lives: number;
    target: number;
    /** start：本关剩余句子（服务端随机抽取） */
    sentences?: string[];
    /** pass：过满 target 句，已自动进入下一关 */
    levelUp?: boolean;
    /** fail：机会耗尽，本关重来 */
    restart?: boolean;
}

export interface RemoteConfig {
    match_enabled?: boolean;
    ad_banner_id?: string;
    ad_interstitial_id?: string;
    ad_rewarded_id?: string;
    [key: string]: unknown;
}
