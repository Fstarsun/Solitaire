/**
 * 启动场景：
 * 同意隐私政策 → 初始化云开发 → 拉配置 → 登录
 *  → 若由房间分享卡片冷启动，直接加入房间进对局；否则进大厅
 */
import { _decorator, dynamicAtlasManager } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { Cloud } from '../net/Cloud';
import { Auth } from '../managers/Auth';
import { AdManager } from '../managers/AdManager';
import { Privacy } from '../platform/Privacy';
import { WxAdapter } from '../platform/WxAdapter';
import { Api } from '../net/Api';
import { FlowData } from '../core/FlowData';
import { Popup } from '../ui/Popup';
import { Logger } from '../core/Logger';

const { ccclass } = _decorator;

// TODO: 替换为你的 TCB 环境 ID
const TCB_ENV_ID = 'cloud1-d7gm5vvlsd102999c';

@ccclass('BootScene')
export class BootScene extends BaseScene {
    protected async onSceneLoad() {
        // 关闭动态图集：sliced 九宫格图进动态图集后在微信端 UV 错乱（按钮渲染成黑块），
        // 本项目 UI 图少图小，无需动态图集收益
        dynamicAtlasManager.enabled = false;

        try {
            const agreed = await Privacy.ensure();
            if (!agreed) {
                Popup.toast('需同意隐私政策后才能开始游戏');
                return;
            }

            Cloud.init(TCB_ENV_ID);
            await AdManager.loadConfig();
            await Auth.login();

            await this.handleLaunchQuery();
        } catch (e) {
            Logger.error('BootScene', 'boot failed', e);
            Popup.toast('网络异常，请重新进入');
        }
    }

    /** 分享卡片冷启动：query 中带 roomId 时直接尝试加入 */
    private async handleLaunchQuery() {
        const query = WxAdapter.getLaunchQuery();
        const roomId = query.roomId || '';

        if (/^\d{6}$/.test(roomId)) {
            try {
                const res = await Api.roomJoin(roomId);
                FlowData.battleId = res.battleId;
                SceneNavigator.go(SceneName.BATTLE);
                return;
            } catch (e) {
                Popup.toast(e.message || '房间已解散');
            }
        }

        SceneNavigator.go(SceneName.LOBBY);
    }
}
