/**
 * 结算页 +「再来一局」协商：
 *  弹框询问是否再来一局：
 *   - 双方都同意 → 自动进入新对局（同一对人）
 *   - 任一方拒绝 / 30 秒不响应 → 提示后回大厅
 *
 * 复用场景现有按钮：BtnAgain=再来一局，BtnBack=不了。
 */
import { _decorator, Color, Label } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { BattleManager } from '../managers/BattleManager';
import { Auth } from '../managers/Auth';
import { AdManager } from '../managers/AdManager';
import { AudioManager } from '../managers/AudioManager';
import { Popup } from '../ui/Popup';
import { Palette } from '../ui/Theme';
import { FlowData } from '../core/FlowData';
import { EventBus, GameEvent } from '../core/EventBus';
import { BattleView, RematchState } from '../net/Types';

const { ccclass } = _decorator;

const REMATCH_POLL = 2000;

@ccclass('ResultScene')
export class ResultScene extends BaseScene {
    private battle: BattleView = null;
    private adShown = false;
    private pollHandle: any = 0;
    private decided = false; // 已得出最终结论，防止重复跳转

    protected onSceneLoad() {
        this.battle = BattleManager.getBattle();
        if (!this.battle) {
            SceneNavigator.go(SceneName.LOBBY);
            return;
        }

        this.renderResult();
        this.showAskingUI();

        this.ui.onTap('BtnAgain', this.onAccept, this);
        this.ui.onTap('BtnBack', this.onDecline, this);

        EventBus.on(GameEvent.REMATCH_UPDATE, this.onRematchUpdate);
        this.startPolling();
    }

    /** 渲染胜负与积分，并刷新本地档案 */
    private renderResult() {
        const myOpenid =
            this.battle.mySide === 'A'
                ? this.battle.playerA.openid
                : this.battle.playerB.openid;
        const iWin = this.battle.winnerOpenid === myOpenid;

        this.ui.setText('Title', iWin ? '胜利' : '失败');
        AudioManager.playSfx(iWin ? 'win' : 'lose');
        this.ui.setText(
            'ScoreDelta',
            this.battle.type === 'random' ? (iWin ? '+10' : '-5') : '不计分'
        );

        // 胜=朱砂红 / 负=黛青，积分变动同色
        const tone = iWin ? Palette.vermilion : Palette.teal;
        this.colorLabel('Title', tone);
        this.colorLabel('ScoreDelta', tone);

        const profile = Auth.getProfile();
        if (profile && this.battle.type === 'random') {
            Auth.updateProfile({
                score: profile.score + (iWin ? 10 : -5),
                win: profile.win + (iWin ? 1 : 0),
                lose: profile.lose + (iWin ? 0 : 1)
            });
        }
    }

    /** 初始询问态：按钮「再来一局 / 不了」 */
    private showAskingUI() {
        this.setButtonText('BtnAgain', '再来一局');
        this.setButtonText('BtnBack', '不了');
    }

    /** 本方已同意，等待对方 */
    private showWaitingUI() {
        this.setButtonText('BtnAgain', '等待对方回应…');
        this.setButtonText('BtnBack', '取消');
        // 等待期间禁用「再来一局」，避免重复点
        this.ui.setInteractable('BtnAgain', false);
    }

    private async onAccept() {
        // 等待态下 BtnBack=取消，这里只在询问态处理同意
        this.ui.setInteractable('BtnAgain', false);
        try {
            const res = await BattleManager.rematchVote(true);
            this.showWaitingUI();
            // 若投票时双方已同意（云函数直接建好）
            if (res.rematch && res.rematch.state === 'accepted') {
                this.handleAccepted(res.rematch);
            }
        } catch (e) {
            Popup.toast(e.message || '操作失败');
            this.ui.setInteractable('BtnAgain', true);
        }
    }

    private async onDecline() {
        try {
            await BattleManager.rematchVote(false);
        } catch (e) {
            // 即使投票失败也继续退出
        }
        this.exit('你选择了离开');
    }

    /** watch 推送协商变化 */
    private onRematchUpdate = (r: RematchState) => {
        if (!r || this.decided) return;
        if (r.state === 'accepted') this.handleAccepted(r);
        else if (r.state === 'declined') this.exit('对方已离开');
    };

    /** 双方同意：进入新对局 */
    private handleAccepted(r: RematchState) {
        if (this.decided || !r.newBattleId) return;
        this.decided = true;
        this.stopPolling();

        // 带新 battleId 进入对战页，由 BattleScene 自己 enter（拉新对局、重建 watch/轮询）
        FlowData.battleId = r.newBattleId;
        SceneNavigator.go(SceneName.BATTLE);
    }

    /** 退出回大厅 */
    private exit(msg: string) {
        if (this.decided) return;
        this.decided = true;
        this.stopPolling();
        Popup.toast(msg);

        if (this.battle.type === 'random' && !this.adShown) {
            this.adShown = true;
            AdManager.showInterstitial();
        }
        BattleManager.leave();
        setTimeout(() => SceneNavigator.go(SceneName.LOBBY), 800);
    }

    private startPolling() {
        this.stopPolling();
        this.pollHandle = setInterval(async () => {
            if (this.decided) return;
            try {
                const r = await BattleManager.rematchState();
                if (!r) return;
                // 本地 deadline 兜底，不硬等定时器
                if (r.state === 'asking' && Date.now() > r.deadline) {
                    this.exit('协商超时，对方未回应');
                    return;
                }
                if (r.state === 'accepted' && !r.newBattleId) {
                    // 对方已抢到创建权、新对局正在创建中：继续等写入；
                    // 超过期限仍没写回（创建方异常）则退出兜底
                    if (Date.now() > r.deadline) {
                        this.exit('再来一局创建失败，请重新匹配');
                        return;
                    }
                    return;
                }
                if (r.state === 'accepted') this.handleAccepted(r);
                else if (r.state === 'declined') this.exit('对方已离开');
            } catch (e) {
                // 单次失败继续轮询
            }
        }, REMATCH_POLL);
    }

    private stopPolling() {
        if (this.pollHandle) {
            clearInterval(this.pollHandle);
            this.pollHandle = 0;
        }
    }

    /** 给指定节点上的 Label 染色 */
    private colorLabel(path: string, color: Color) {
        const node = this.ui.getNode(path);
        const label = node && (node.getComponent(Label) || node.getComponentInChildren(Label));
        if (label) label.color = color;
    }

    /** 修改按钮内子 Label 文字 */
    private setButtonText(btnName: string, text: string) {
        const btnNode = this.ui.getNode(btnName);
        if (!btnNode) return;
        const labelNode = btnNode.getChildByName('Label');
        if (labelNode) {
            const label = labelNode.getComponent(Label);
            if (label) label.string = text;
        }
    }

    onDestroy() {
        this.stopPolling();
        EventBus.off(GameEvent.REMATCH_UPDATE, this.onRematchUpdate);
    }
}
