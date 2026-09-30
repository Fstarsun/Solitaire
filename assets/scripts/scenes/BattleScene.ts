/**
 * 对局页（好友/随机对战复用）
 * 职责：渲染双方信息与句子序列、我的回合输入提交、倒计时、认输；
 * 收到 settled 后跳结算页。
 */
import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { BattleManager } from '../managers/BattleManager';
import { CountdownTimer } from '../managers/CountdownTimer';
import { SentenceRule, RuleError } from '../managers/SentenceRule';
import { Popup } from '../ui/Popup';
import { FlowData } from '../core/FlowData';
import { EventBus, GameEvent } from '../core/EventBus';
import { BattleView, BattleSentence } from '../net/Types';
import { Api } from '../net/Api';
import { Logger } from '../core/Logger';
import { WxAdapter } from '../platform/WxAdapter';
import { DynamicList } from '../ui/DynamicList';
import { createVerticalList } from '../ui/ListFactory';
import { Palette, withAlpha, paintRoundCard } from '../ui/Theme';
import { Node, Label, UITransform, Size } from 'cc';

const { ccclass } = _decorator;

@ccclass('BattleScene')
export class BattleScene extends BaseScene {
    private timer = new CountdownTimer();
    private battleId = '';
    private sentenceList: DynamicList = null;
    private turnHintLabel: Label = null;

    protected async onSceneLoad() {
        this.battleId = FlowData.battleId || '';
        FlowData.battleId = '';

        this.ui.onTap('BtnSubmit', this.onSubmit, this);
        this.ui.onTap('BtnSurrender', this.onSurrender, this);

        // 运行时创建「当前句子」卡片（无需编辑器搭建 ScrollView）
        this.sentenceList = createVerticalList(this.ui.getNode(''), {
            x: 0, y: 290, width: 680, height: 76, name: 'SentenceList'
        });
        this.sentenceList.setItemHeight(68);

        // 「轮到谁」状态提示（运行时节点：轮到你了 / 等待对方…）
        this.createTurnHint();

        EventBus.on(GameEvent.BATTLE_UPDATE, this.onUpdate);
        EventBus.on(GameEvent.BATTLE_SETTLED, this.onSettled);
        // 对方退出导致房间销毁：本方立即退出回大厅
        EventBus.on(GameEvent.BATTLE_DESTROYED, this.onRoomDestroyed);

        Popup.loading();
        try {
            const battle = await BattleManager.enter(this.battleId);
            // 兜底直接渲染：进局后主动画一次，不依赖 BATTLE_UPDATE 事件的触发时序，
            // 杜绝「再来一局 / 偶发进局」时页面停留在占位文案（对手 / 起始句 / Label / 我）。
            if (battle) this.render(battle);
        } catch (e) {
            // 记录真实原因（错误码）：1003=对局不存在 1002=登录态 1000=云函数异常
            Logger.error('BattleScene', 'enter failed', e);
            // 自愈：向服务端确认我当前真正所在的随机对局并重进（最多 2 轮）。
            // 覆盖两类问题：拿到旧/错 battleId；云函数冷启动等瞬态失败（重进即恢复）
            let recovered = false;
            for (let i = 0; i < 2 && !recovered; i++) {
                try {
                    const poll = await Api.matchPoll();
                    const bid = poll && poll.status === 'matched' ? poll.battleId : '';
                    if (!bid) break; // 服务端确认不在任何对局中，无需再试
                    this.battleId = bid;
                    const battle = await BattleManager.enter(bid);
                    if (battle) {
                        this.render(battle);
                        recovered = true;
                    }
                } catch (e2) {
                    Logger.warn('BattleScene', 'recover failed', e2);
                    await new Promise((r) => setTimeout(r, 1500));
                }
            }
            if (recovered) return;
            const code = e && e.code ? `(${e.code})` : '';
            Popup.toast('对局不存在或已结束' + code);
            setTimeout(() => SceneNavigator.go(SceneName.LOBBY), 1000);
        } finally {
            Popup.hideLoading();
        }
    }

    /** 更新轮次提示；warn=true 时用朱砂红提示（如对方掉线） */
    private setTurnHint(text: string, warn: boolean) {
        if (!this.turnHintLabel) return;
        this.turnHintLabel.string = text;
        this.turnHintLabel.color = warn ? Palette.vermilion : Palette.ink;
    }

    /** 创建轮次状态提示 Label，位于句子列表下方 */
    private createTurnHint() {
        const canvas = this.ui.getNode('');
        const node = new Node('TurnHint');
        node.layer = canvas.layer;
        canvas.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(640, 60));
        node.setPosition(0, 140, 0);
        this.turnHintLabel = node.addComponent(Label);
        this.turnHintLabel.fontSize = 40;
        this.turnHintLabel.lineHeight = 50;
        this.turnHintLabel.color = Palette.ink;
        // 新建 Label 的默认文字是字面量 "label"，render 未跑到时会裸露出来，先清空
        this.turnHintLabel.string = '';
    }

    /** 状态刷新（enter / 提交返回 / watch 推送都会触发） */
    private onUpdate = (battle: BattleView) => {
        if (!battle || battle.battleId !== this.battleId) return;
        this.render(battle);
    };

    private render(battle: BattleView) {
        const me = battle.mySide === 'A' ? battle.playerA : battle.playerB;
        const opp = battle.mySide === 'A' ? battle.playerB : battle.playerA;

        // 「轮到谁」提示下方不再显示自己的用户名，只保留顶部对手名
        this.ui.setVisible('MyName', false);
        this.ui.setText('OppName', opp.nickName);
        // 起始句已在句子列表首项中展示，隐藏静态标签避免重叠
        this.ui.setVisible('StarterLabel', false);
        this.ui.setVisible('LastSentence', false);

        this.renderSentenceList(battle);

        const myTurn = battle.status === 'playing' && battle.currentTurn === me.openid;
        this.ui.setInteractable('BtnSubmit', myTurn);

        // 轮到谁：明确提示当前能否输入
        if (battle.status === 'playing') {
            this.setTurnHint(myTurn ? '轮到你了，请输入' : '等待对方作答…', false);
        }

        // 倒计时（服务端截止时间）—— 每次状态变化都重建，避免重连后停在旧数字
        this.timer.start(battle.turnDeadline, (sec) => {
            this.updateCountdown(sec);
        }, () => {
            // 本地显示到点；真实胜负以服务端/推送为准，不在这里跳页
        });
    }

    /** 倒计时展示：最后 5 秒转朱砂红提醒 */
    private updateCountdown(sec: number) {
        this.ui.setText('Countdown', String(sec));
        const node = this.ui.getNode('Countdown');
        const label = node && node.getComponent(Label);
        if (label) {
            label.color = sec <= 5 ? Palette.vermilion : Palette.ink;
            label.isBold = true;
        }
    }

    /** 只渲染「当前要接的一句」：末句（首回合为起始句），卡片底色区分归属 */
    private renderSentenceList(battle: BattleView) {
        const meOpenid =
            battle.mySide === 'A' ? battle.playerA.openid : battle.playerB.openid;

        // 只显示当前要接的一句，不展示历史
        const current: BattleSentence | { starter: true; text: string } =
            battle.sentences.length > 0
                ? battle.sentences[battle.sentences.length - 1]
                : { starter: true, text: battle.starter };
        const items: Array<BattleSentence | { starter: true; text: string }> = [current];

        // 卡片底色：起始句淡金 / 我方淡黛青 / 对方默认纸白
        const starterCard = withAlpha(Palette.gold, 45);
        const mineCard = withAlpha(Palette.teal, 34);

        this.sentenceList.setData(items, (itemNode, data) => {
            const isStarter = (data as any).starter;
            const text = (data as any).text;
            const byMe = !isStarter && (data as BattleSentence).openid === meOpenid;

            if (isStarter) paintRoundCard(itemNode, starterCard, 16, 12, 5);
            else if (byMe) paintRoundCard(itemNode, mineCard, 16, 12, 5);

            // 文字统一墨黑，仅用前缀区分归属
            const prefix = isStarter ? '系统 ' : byMe ? '我 ' : '对手 ';

            DynamicList.setLabel(itemNode, 'Sentence', prefix + text, {
                fontSize: 32, color: Palette.ink, width: 640
            });
        });
        this.sentenceList.scrollToBottom();
    }

    private async onSubmit() {
        const battle = BattleManager.getBattle();
        if (!battle) return;
        const raw = this.ui.getEditText('SentenceInput');

        // 非本方回合直接拦截（服务端亦会校验，这里给更及时的提示）
        const me = battle.mySide === 'A' ? battle.playerA : battle.playerB;
        if (battle.status !== 'playing' || battle.currentTurn !== me.openid) {
            Popup.toast('还没轮到你');
            return;
        }

        // 本地即时校验（最终以云函数为准）
        const expected =
            battle.sentences.length === 0
                ? SentenceRule.lastChar(battle.starter)
                : SentenceRule.lastChar(battle.sentences[battle.sentences.length - 1].text);
        const used = battle.sentences.map((s) => s.text);
        const err = SentenceRule.validate(raw, expected, used);
        if (err !== RuleError.None) {
            Popup.toast(SentenceRule.errorText(err));
            return;
        }

        Popup.loading('提交中');
        try {
            await BattleManager.submit(raw);
            this.ui.setText('SentenceInput', ''); // 提交成功清空输入
            WxAdapter.vibrate();
        } catch (e) {
            Popup.toast(e.message || '提交失败');
        } finally {
            Popup.hideLoading();
        }
    }

    private async onSurrender() {
        const ok = await Popup.confirm('确定要认输吗？');
        if (!ok) return;
        try {
            await BattleManager.surrender();
        } catch (e) {
            Popup.toast(e.message || '操作失败');
        }
    }

    /** 对局结束：超时/掉线先明确提示，再进结算页 */
    private onSettled = (battle: BattleView) => {
        if (!battle || battle.battleId !== this.battleId) return;
        this.timer.stop();
        FlowData.battleId = battle.battleId;

        const myOpenid =
            battle.mySide === 'A' ? battle.playerA.openid : battle.playerB.openid;
        const iWin = battle.winnerOpenid === myOpenid;

        let hint = '';
        if (battle.endReason === 'timeout') {
            hint = iWin ? '对方超时，你赢了' : '时间到，你输了';
        } else if (battle.endReason === 'disconnect') {
            hint = iWin ? '对方已掉线，你赢了' : '你掉线太久，判负';
        }

        if (hint) {
            Popup.toast(hint);
            setTimeout(() => SceneNavigator.go(SceneName.RESULT), 900);
        } else {
            SceneNavigator.go(SceneName.RESULT);
        }
    };

    /** 对方退出、房间已销毁：提示后回大厅，不在旧房间等待 */
    private onRoomDestroyed = () => {
        this.timer.stop();
        Popup.toast('对方已离开，房间已关闭');
        BattleManager.leave();
        setTimeout(() => SceneNavigator.go(SceneName.LOBBY), 900);
    };

    onDestroy() {
        this.timer.stop();
        EventBus.off(GameEvent.BATTLE_UPDATE, this.onUpdate);
        EventBus.off(GameEvent.BATTLE_SETTLED, this.onSettled);
        EventBus.off(GameEvent.BATTLE_DESTROYED, this.onRoomDestroyed);
        // 仅离开场景但不跳结算时清理；跳结算时保留 BattleManager 数据供结算页读取
    }
}
