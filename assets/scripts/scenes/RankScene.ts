/**
 * 排行榜页：总榜前 10 名（竖版卷轴背景内） + 我的排名
 */
import { _decorator, HorizontalTextAlignment } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { Api } from '../net/Api';
import { Popup } from '../ui/Popup';
import { RankData, RankItem } from '../net/Types';
import { DynamicList } from '../ui/DynamicList';
import { createVerticalList } from '../ui/ListFactory';
import { Palette, withAlpha, paintRoundCard } from '../ui/Theme';

const { ccclass } = _decorator;

@ccclass('RankScene')
export class RankScene extends BaseScene {
    private rankList: DynamicList = null;

    protected onSceneLoad() {
        this.ui.onTap('BtnBack', () => SceneNavigator.go(SceneName.LOBBY));

        // 榜单列表（运行时创建，落在卷轴宣纸区内）
        this.rankList = createVerticalList(this.ui.getNode(''), {
            x: 0, y: 60, width: 400, height: 780, name: 'RankList'
        });
        this.rankList.setItemHeight(78);

        this.load();
    }

    private async load() {
        Popup.loading();
        try {
            const data = (await Api.rankList()) as RankData;

            this.renderTopList(data.topList);
        } catch (e) {
            Popup.toast(e.message || '加载失败');
        } finally {
            Popup.hideLoading();
        }
    }

    /** 渲染前 10 名：格式「名次 · 用户名」，积分靠右；前三名淡金卡片 */
    private renderTopList(topList: RankItem[]) {
        const podiumCard = withAlpha(Palette.gold, 52);

        this.rankList.setData(topList.slice(0, 10), (itemNode, item) => {
            const isTop3 = item.rank <= 3;
            if (isTop3) paintRoundCard(itemNode, podiumCard, 16, 12, 5);

            DynamicList.setLabel(itemNode, 'RankName', `${item.rank} · ${item.nickName}`, {
                fontSize: 30,
                color: isTop3 ? Palette.vermilion : Palette.ink,
                bold: isTop3,
                align: HorizontalTextAlignment.CENTER,
                x: -50, width: 260
            });
            DynamicList.setLabel(itemNode, 'Score', String(item.score), {
                fontSize: 28,
                color: Palette.teal,
                align: HorizontalTextAlignment.CENTER,
                x: 145, width: 100
            });
        });
    }
}
