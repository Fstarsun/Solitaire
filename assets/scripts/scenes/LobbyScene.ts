/**
 * 主菜单：五个模式入口；底部 Banner。
 * 背景/Logo 由场景静态节点承载（tools/restyle-ui.js 已统一按钮样式），代码只管业务。
 */
import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { AdManager } from '../managers/AdManager';
import { Api } from '../net/Api';
import { CloudError } from '../net/Cloud';
import { Popup } from '../ui/Popup';
import { FlowData } from '../core/FlowData';

const { ccclass } = _decorator;

// 与云端 constants.ERR.IN_BATTLE 对齐
const ERR_IN_BATTLE = 6001;

@ccclass('LobbyScene')
export class LobbyScene extends BaseScene {
    private creating = false;

    protected onSceneLoad() {
        this.bindUI();
        AdManager.showBanner();
    }

    private bindUI() {
        // —— 好友房间：先创建，再进等待页（云函数耗时，期间 loading + 防重复点击）——
        this.ui.onTap('BtnFriend', async () => {
            if (this.creating) return;
            this.creating = true;
            Popup.loading('创建房间中...');
            let failed = '';
            let next: { scene: string; data: string } = null;
            try {
                const res = await Api.roomCreate();
                FlowData.roomId = res.roomId;
                await SceneNavigator.go(SceneName.ROOM_WAIT);
            } catch (e) {
                // 6001 已有对局/房间：直接返场，而不是只报错
                if (e instanceof CloudError && e.code === ERR_IN_BATTLE && e.data) {
                    if (e.data.battleId) {
                        next = { scene: SceneName.BATTLE, data: e.data.battleId };
                    } else if (e.data.roomId) {
                        next = { scene: SceneName.ROOM_WAIT, data: e.data.roomId };
                    }
                }
                if (!next) failed = e.message || '创建失败';
            } finally {
                // 先 hide 再 toast，避免 hideLoading 顶掉 toast（微信原生坑）
                Popup.hideLoading();
                this.creating = false;
                if (failed) Popup.toast(failed);
            }
            if (next) {
                if (next.scene === SceneName.BATTLE) FlowData.battleId = next.data;
                else FlowData.roomId = next.data;
                SceneNavigator.go(next.scene);
            }
        });

        // —— 加入房间 ——
        this.ui.onTap('BtnJoinRoom', () => SceneNavigator.go(SceneName.JOIN_ROOM));

        // —— 快速匹配 ——
        this.ui.onTap('BtnMatch', () => SceneNavigator.go(SceneName.MATCH));

        // —— 排行榜 ——
        this.ui.onTap('BtnRank', () => SceneNavigator.go(SceneName.RANK));

        // —— 个人中心 ——
        this.ui.onTap('BtnProfile', () => SceneNavigator.go(SceneName.PROFILE));

        // —— 闯关模式 ——
        this.ui.onTap('BtnLevel', () => SceneNavigator.go(SceneName.LEVEL));
    }
}
