/**
 * 个人中心：昵称卡片 + 三格数据卡（总积分/胜/负） + 对局记录（滚动 + 无限加载）
 */
import { _decorator, Node, UITransform, Label, HorizontalTextAlignment } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { Api } from '../net/Api';
import { Auth } from '../managers/Auth';
import { Popup } from '../ui/Popup';
import { BattleRecord } from '../net/Types';
import { DynamicList } from '../ui/DynamicList';
import { createVerticalList } from '../ui/ListFactory';
import { Palette, withAlpha, paintRoundCard } from '../ui/Theme';

declare const wx: any;

const { ccclass } = _decorator;

/** 卡片底色：浅宣纸，与页面背景同色系、略浅一档 */
const CARD_SOFT = withAlpha(Palette.paperLight, 235);

@ccclass('ProfileScene')
export class ProfileScene extends BaseScene {
    private page = 1;
    private total = 0;
    private hasMore = false;
    private loadingMore = false;
    private readonly pageSize = 20;
    private allRecords: BattleRecord[] = [];
    private recordList: DynamicList = null;
    /** 三格数据卡的数值 Label */
    private statLabels: Record<string, Label> = {};

    protected onSceneLoad() {
        this.ui.onTap('BtnBack', () => SceneNavigator.go(SceneName.LOBBY));
        this.ui.onTap('BtnEdit', this.onEdit, this);

        this.createStatCards();
        this.createSectionTitle();

        // 对局记录列表：数据卡与小节标题下方、修改昵称按钮上方的全部空位
        this.recordList = createVerticalList(this.ui.getNode(''), {
            x: 0, y: -55, width: 680, height: 400, name: 'RecordList'
        });
        this.recordList.setItemHeight(74);
        // 无限滚动：滚到底部自动加载下一页
        this.recordList.onReachBottom(() => this.loadMoreIfNeeded());

        this.renderSummary();
        this.loadRecords(true);
    }

    /** 三张数据小卡并排：总积分（墨）/ 胜场（朱砂）/ 负场（黛青） */
    private createStatCards() {
        const parent = this.ui.getNode('');
        const defs = [
            { key: 'score', title: '总积分', x: -215, color: Palette.ink },
            { key: 'win', title: '胜场', x: 0, color: Palette.vermilion },
            { key: 'lose', title: '负场', x: 215, color: Palette.teal }
        ];
        for (const d of defs) {
            const card = new Node('Stat_' + d.key);
            card.layer = parent.layer;
            parent.addChild(card);
            card.setPosition(d.x, 265, 0);
            const ut = card.addComponent(UITransform);
            ut.setContentSize(200, 110);
            paintRoundCard(card, CARD_SOFT, 16, 0, 0);

            DynamicList.setLabel(card, 'Title', d.title, {
                fontSize: 24, color: Palette.inkGray, y: 28,
                width: 200, align: HorizontalTextAlignment.CENTER
            });
            this.statLabels[d.key] = DynamicList.setLabel(card, 'Value', '0', {
                fontSize: 44, color: d.color, bold: true, y: -16,
                width: 200, align: HorizontalTextAlignment.CENTER
            });
        }
    }

    /** 「对局记录」小节标题 */
    private createSectionTitle() {
        const parent = this.ui.getNode('');
        const node = new Node('SectionTitle');
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(0, 160, 0);
        DynamicList.setLabel(node, 'Label', '— 对局记录 —', {
            fontSize: 30, color: Palette.ink, bold: true,
            width: 400, align: HorizontalTextAlignment.CENTER
        });
    }

    private renderSummary() {
        const p = Auth.getProfile();
        if (!p) return;
        this.ui.setText('NickName', p.nickName);
        if (this.statLabels.score) this.statLabels.score.string = String(p.score);
        if (this.statLabels.win) this.statLabels.win.string = String(p.win);
        if (this.statLabels.lose) this.statLabels.lose.string = String(p.lose);
    }

    private async loadRecords(reset: boolean) {
        if (reset) {
            this.page = 1;
            this.allRecords = [];
        }
        Popup.loading();
        try {
            const res = await Api.profileRecords(this.page, this.pageSize);
            this.total = res.total;
            this.allRecords.push(...res.items);
            this.renderRecords();
            this.hasMore = this.page * this.pageSize < this.total;
        } catch (e) {
            Popup.toast(e.message || '加载失败');
        } finally {
            Popup.hideLoading();
        }
    }

    /** 渲染全部已加载战绩：左侧圆形胜负徽章 + 对手 + 积分变动 */
    private renderRecords() {
        this.recordList.setData(this.allRecords, (itemNode, r) => {
            const ut = itemNode.getComponent(UITransform);
            if (ut) ut.setContentSize(616, 70);
            paintRoundCard(itemNode, CARD_SOFT, 16, 12, 5);

            // 左侧圆形胜负徽章（朱砂=胜 / 黛青=负）
            let badge = itemNode.getChildByName('Badge');
            if (!badge) {
                badge = new Node('Badge');
                badge.layer = itemNode.layer;
                const but = badge.addComponent(UITransform);
                but.setContentSize(56, 56);
                itemNode.addChild(badge);
            }
            badge.setPosition(-258, 0, 0);
            const badgeColor = r.win ? Palette.vermilion : Palette.teal;
            paintRoundCard(badge, badgeColor, 28, 0, 0);
            DynamicList.setLabel(badge, 'Char', r.win ? '胜' : '负', {
                fontSize: 26, color: Palette.white, bold: true, y: 0,
                width: 56, align: HorizontalTextAlignment.CENTER
            });

            DynamicList.setLabel(itemNode, 'Opponent', '对手：' + r.opponentName, {
                fontSize: 32, color: Palette.ink, x: -30, width: 330
            });
            DynamicList.setLabel(
                itemNode,
                'Delta',
                r.type === 'random' ? (r.scoreDelta > 0 ? '+' + r.scoreDelta : String(r.scoreDelta)) : '不计分',
                {
                    fontSize: 32,
                    color: r.type === 'random' ? badgeColor : Palette.inkGray,
                    x: 235, width: 120, align: HorizontalTextAlignment.CENTER
                }
            );
        });
    }

    /** 滚动到底部时自动翻页（无更多/加载中则跳过） */
    private loadMoreIfNeeded() {
        if (this.loadingMore || !this.hasMore) return;
        this.loadingMore = true;
        this.loadMore().finally(() => {
            this.loadingMore = false;
        });
    }

    private async loadMore() {
        this.page += 1;
        await this.loadRecords(false);
    }

    /** 修改昵称 */
    private async onEdit() {
        const nickName = await this.askNickName();
        if (!nickName) return;
        try {
            const res = await Api.profileUpdate(nickName);
            Auth.updateProfile(res.profile);
            this.renderSummary();
            Popup.toast('已更新');
        } catch (e) {
            Popup.toast(e.message || '更新失败');
        }
    }

    private askNickName(): Promise<string> {
        return new Promise((resolve) => {
            if (typeof wx !== 'undefined' && wx.showModal) {
                wx.showModal({
                    title: '修改昵称',
                    editable: true,
                    placeholderText: '请输入新昵称',
                    success: (r: any) => resolve(r.confirm ? r.content : '')
                });
            } else {
                resolve('');
            }
        });
    }
}
