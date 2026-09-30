/**
 * 匹配等待页：自动开始匹配，可取消
 */
import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { MatchManager } from '../managers/MatchManager';
import { AdManager } from '../managers/AdManager';
import { Popup } from '../ui/Popup';
import { FlowData } from '../core/FlowData';

const { ccclass } = _decorator;

@ccclass('MatchScene')
export class MatchScene extends BaseScene {
    private matcher = new MatchManager();

    protected onSceneLoad() {
        AdManager.hideBanner();
        this.ui.onTap('BtnCancel', this.onCancel, this);
        this.start();
    }

    private async start() {
        const result = await this.matcher.start();

        if (result.ok) {
            // 匹配成功，带上 battleId 进对局
            FlowData.battleId = result.battleId;
            SceneNavigator.go(SceneName.BATTLE);
            return;
        }

        // 已在进行中对局（6001）：直接返场进入那局
        if (result.battleId) {
            FlowData.battleId = result.battleId;
            SceneNavigator.go(SceneName.BATTLE);
            return;
        }

        if (result.reason === 'timeout') {
            Popup.toast('匹配超时，请稍后再试');
        } else if (result.reason === 'failed') {
            Popup.toast(result.message || '匹配失败，请稍后再试');
        }
        // canceled：用户主动取消，直接回大厅，不弹提示
        SceneNavigator.go(SceneName.LOBBY);
    }

    private async onCancel() {
        await this.matcher.cancel();
    }
}
