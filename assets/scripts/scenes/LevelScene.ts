/**
 * 闯关页：系统给句，玩家接上即过一句。
 * 第 N 关需过 5*N 句；每关 3 次机会，超时/跳过各耗 1 次，用完本关重来。
 * 进度云存（users.levelProgress），退出不丢；句子合法性本地校验。
 */
import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { CountdownTimer } from '../managers/CountdownTimer';
import { SentenceRule, RuleError } from '../managers/SentenceRule';
import { Popup } from '../ui/Popup';
import { Api } from '../net/Api';
import { LevelData } from '../net/Types';
import { WxAdapter } from '../platform/WxAdapter';
import { DynamicList } from '../ui/DynamicList';
import { createVerticalList } from '../ui/ListFactory';
import { Palette, withAlpha, paintRoundCard } from '../ui/Theme';
import { TimeSync } from '../managers/TimeSync';
import { Node, Label, UITransform, Size, Graphics } from 'cc';

const { ccclass } = _decorator;

/** 单句作答时限（秒），与对战回合一致 */
const SENTENCE_SECONDS = 60;

@ccclass('LevelScene')
export class LevelScene extends BaseScene {
    private timer = new CountdownTimer();
    /** 本关剩余句子队列（服务端 start 时抽取） */
    private queue: string[] = [];
    /** 当前要接的系统句 */
    private current = '';
    /** 本关会话内已用句子（含系统句与玩家句），用于查重 */
    private used: string[] = [];
    /** 进度（服务端为准） */
    private progress: LevelData = null;
    private sentenceList: DynamicList = null;
    private endCharHint: Label = null;
    private progressBar: Node = null;
    /** 请求互斥：提交/跳过进行中忽略重复点击 */
    private busy = false;

    protected async onSceneLoad() {
        this.ui.onTap('BtnSubmit', this.onSubmit, this);
        this.ui.onTap('BtnSkip', this.onSkip, this);
        this.ui.onTap('BtnBack', this.onBack, this);

        // 当前系统句卡片（与对战页同款列表，仅一条）
        this.sentenceList = createVerticalList(this.ui.getNode(''), {
            x: 0, y: 230, width: 680, height: 76, name: 'SentenceList'
        });
        this.sentenceList.setItemHeight(68);

        this.createEndCharHint();
        this.createProgressBar();

        Popup.loading();
        try {
            const data = await Api.levelStart();
            this.beginLevel(data);
        } catch (e) {
            Popup.toast(e.message || '加载失败');
            setTimeout(() => SceneNavigator.go(SceneName.LOBBY), 1000);
        } finally {
            Popup.hideLoading();
        }
    }

    /** 「请接「X」」提示，位于卡片下方 */
    private createEndCharHint() {
        const canvas = this.ui.getNode('');
        const node = new Node('EndCharHint');
        node.layer = canvas.layer;
        canvas.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(640, 50));
        node.setPosition(0, 165, 0);
        this.endCharHint = node.addComponent(Label);
        this.endCharHint.fontSize = 34;
        this.endCharHint.lineHeight = 44;
        this.endCharHint.color = Palette.vermilion;
        this.endCharHint.string = '';
    }

    /** 关卡进度条：底槽 + 填充条，按 passed/target 比例填充 */
    private createProgressBar() {
        const canvas = this.ui.getNode('');
        this.progressBar = new Node('ProgressBar');
        this.progressBar.layer = canvas.layer;
        canvas.addChild(this.progressBar);
        const ut = this.progressBar.addComponent(UITransform);
        ut.setContentSize(new Size(420, 20));
        this.progressBar.setPosition(0, 365, 0);

        // 先加底槽（先加的孩子先渲染，垫在填充条下面）
        const bg = new Node('BarBg');
        bg.layer = canvas.layer;
        this.progressBar.addChild(bg);
        bg.addComponent(UITransform).setContentSize(new Size(420, 20));
        const gb = bg.addComponent(Graphics);
        gb.fillColor = withAlpha(Palette.ink, 26);
        gb.roundRect(-210, -10, 420, 20, 10);
        gb.fill();

        const fill = new Node('Fill');
        fill.layer = canvas.layer;
        this.progressBar.addChild(fill);
        fill.addComponent(UITransform).setContentSize(new Size(420, 20));
        const g = fill.addComponent(Graphics);
        g.fillColor = withAlpha(Palette.vermilion, 220);
        g.roundRect(-210, -10, 420, 20, 10);
        g.fill();
    }

    /** 开始/重开一关：渲染进度 + 取第一句 */
    private beginLevel(data: LevelData) {
        this.progress = data;
        this.queue = (data.sentences || []).slice();
        this.used = [];
        this.renderProgress();
        this.nextSentence();
    }

    /** 渲染标题/进度/机会 */
    private renderProgress() {
        if (!this.progress) return;
        this.ui.setText('LevelTitle', `第 ${this.progress.level} 关`);
        this.ui.setText('ProgressText', `进度 ${this.progress.passed} / ${this.progress.target}`);
        this.ui.setText('LivesText', `剩余机会 ${'♥'.repeat(this.progress.lives)}`);

        // 进度条填充比例
        const fill = this.progressBar && this.progressBar.getChildByName('Fill');
        if (fill) {
            const ratio = this.progress.target > 0
                ? Math.min(1, this.progress.passed / this.progress.target)
                : 0;
            const w = Math.max(0, 420 * ratio);
            const g = fill.getComponent(Graphics);
            g.clear();
            g.fillColor = withAlpha(Palette.vermilion, 220);
            if (w > 0) {
                g.roundRect(-210, -10, w, 20, 10);
                g.fill();
            }
        }
    }

    /** 取下一句：队列空则向服务端补抽 */
    private async nextSentence() {
        if (this.queue.length === 0) {
            // 非过关状态下的补抽（过关后 beginLevel 已带新句）
            const data = await Api.levelStart();
            this.progress = data;
            // 过滤本关会话已出现过的句子，避免补抽重复
            this.queue = (data.sentences || []).filter((s) => this.used.indexOf(s) === -1);
            this.renderProgress();
        }
        if (this.queue.length === 0) {
            // 题库为空等异常：回大厅
            Popup.toast('题目暂时不可用');
            setTimeout(() => SceneNavigator.go(SceneName.LOBBY), 1000);
            return;
        }
        this.current = this.queue.shift();
        this.used.push(this.current);
        this.renderSentenceCard();
        this.startTimer();
    }

    /** 展示当前系统句（淡金卡片） */
    private renderSentenceCard() {
        const starterCard = withAlpha(Palette.gold, 45);
        this.sentenceList.setData([this.current], (itemNode, text) => {
            paintRoundCard(itemNode, starterCard, 16, 12, 5);
            DynamicList.setLabel(itemNode, 'Sentence', '系统 ' + text, {
                fontSize: 32, color: Palette.ink, width: 640
            });
        });

        const last = SentenceRule.lastChar(this.current);
        this.endCharHint.string = `请接「${last}」开头的句子`;
        this.ui.setText('SentenceInput', '');
    }

    /** 单句 60 秒倒计时（本地时限，进度云存不受影响） */
    private startTimer() {
        const deadline = TimeSync.now() + SENTENCE_SECONDS * 1000;
        this.timer.start(deadline, (sec) => {
            this.ui.setText('Countdown', String(sec));
            const node = this.ui.getNode('Countdown');
            const label = node && node.getComponent(Label);
            if (label) {
                label.color = sec <= 10 ? Palette.vermilion : Palette.ink;
                label.isBold = true;
            }
        }, () => {
            // 时间到：耗 1 次机会，换下一句
            Popup.toast('时间到');
            this.doFail();
        });
    }

    /** 提交：本地校验通过后调 pass */
    private async onSubmit() {
        if (this.busy || !this.current) return;
        const raw = this.ui.getEditText('SentenceInput');

        const expected = SentenceRule.lastChar(this.current);
        const err = SentenceRule.validate(raw, expected, this.used);
        if (err !== RuleError.None) {
            Popup.toast(SentenceRule.errorText(err));
            return;
        }

        this.busy = true;
        this.timer.stop();
        Popup.loading('提交中');
        try {
            const data = await Api.levelPass();
            this.progress = data;
            this.used.push(SentenceRule.normalize(raw));
            WxAdapter.vibrate();
            if (data.levelUp) {
                Popup.toast(`恭喜过关！进入第 ${data.level} 关`);
                const fresh = await Api.levelStart();
                this.beginLevel(fresh);
            } else {
                this.renderProgress();
                await this.nextSentence();
            }
        } catch (e) {
            Popup.toast(e.message || '提交失败');
            // 失败恢复当前句的倒计时（剩余时间重新计 60 秒，简化处理）
            this.startTimer();
        } finally {
            this.busy = false;
            Popup.hideLoading();
        }
    }

    /** 跳过：二次确认后耗 1 次机会 */
    private async onSkip() {
        if (this.busy || !this.current) return;
        const ok = await Popup.confirm('跳过将消耗 1 次机会，确定吗？');
        if (!ok) return;
        this.timer.stop();
        this.doFail();
    }

    /** 超时/跳过：耗 1 次机会；用完本关重来 */
    private async doFail() {
        if (this.busy) return;
        this.busy = true;
        Popup.loading();
        try {
            const data = await Api.levelFail();
            this.progress = data;
            if (data.restart) {
                Popup.toast('机会用完，本关重来');
                const fresh = await Api.levelStart();
                this.beginLevel(fresh);
            } else {
                this.renderProgress();
                await this.nextSentence();
            }
        } catch (e) {
            Popup.toast(e.message || '操作失败');
            this.startTimer();
        } finally {
            this.busy = false;
            Popup.hideLoading();
        }
    }

    /** 返回大厅：进度已按句云存，直接退出 */
    private onBack() {
        this.timer.stop();
        SceneNavigator.go(SceneName.LOBBY);
    }

    onDestroy() {
        this.timer.stop();
    }
}
