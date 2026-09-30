/**
 * 加入房间页：输入 6 位房号
 */
import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { Api } from '../net/Api';
import { Popup } from '../ui/Popup';
import { FlowData } from '../core/FlowData';

const { ccclass } = _decorator;

@ccclass('JoinRoomScene')
export class JoinRoomScene extends BaseScene {
    private joining = false;

    protected onSceneLoad() {
        this.ui.onTap('BtnJoin', this.onJoin, this);
        this.ui.onTap('BtnBack', () => SceneNavigator.go(SceneName.LOBBY));
    }

    private async onJoin() {
        const roomId = this.ui.getEditText('RoomIdInput').trim();
        if (!/^\d{6}$/.test(roomId)) {
            Popup.toast('请输入6位房间号');
            return;
        }

        if (this.joining) return;
        this.joining = true;
        Popup.loading('加入房间中...');
        let failed = '';
        try {
            const res = await Api.roomJoin(roomId);
            FlowData.battleId = res.battleId;
            await SceneNavigator.go(SceneName.BATTLE);
        } catch (e) {
            failed = e.message || '加入失败';
        } finally {
            // 先 hide 再 toast，避免 hideLoading 顶掉 toast（微信原生坑）
            Popup.hideLoading();
            this.joining = false;
            if (failed) Popup.toast(failed);
        }
    }
}
