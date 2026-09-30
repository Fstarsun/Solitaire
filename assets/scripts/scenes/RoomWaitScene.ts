/**
 * 好友房等待页：展示房间号、分享、等待加入；120s 解散回大厅
 */
import { _decorator } from 'cc';
import { BaseScene } from '../core/BaseScene';
import { SceneNavigator, SceneName } from '../core/SceneNavigator';
import { Api } from '../net/Api';
import { WxAdapter } from '../platform/WxAdapter';
import { Popup } from '../ui/Popup';
import { FlowData } from '../core/FlowData';

const { ccclass } = _decorator;

@ccclass('RoomWaitScene')
export class RoomWaitScene extends BaseScene {
    private roomId = '';
    private handle = 0;

    protected onSceneLoad() {
        this.roomId = FlowData.roomId || '';
        FlowData.roomId = '';

        this.ui.setText('RoomIdLabel', this.roomId);
        this.ui.onTap('BtnShare', this.onShare, this);
        this.ui.onTap('BtnCopy', () => WxAdapter.copy(this.roomId));
        this.ui.onTap('BtnDissolve', this.dissolve, this);

        // 注册右上角菜单分享
        WxAdapter.shareAppMessage('快来和我玩句子接龙', '', this.roomId);

        this.poll();
    }

    /** 每 2s 查询房间状态，guest 加入后服务端自动开局 */
    private poll = async () => {
        try {
            const detail = await Api.roomDetail(this.roomId);
            if (detail.status === 'playing' && detail.battleId) {
                FlowData.battleId = detail.battleId;
                SceneNavigator.go(SceneName.BATTLE);
                return;
            }
            if (detail.status === 'canceled') {
                Popup.toast('房间已解散');
                SceneNavigator.go(SceneName.LOBBY);
                return;
            }
            this.handle = setTimeout(this.poll, 2000) as unknown as number;
        } catch (e) {
            // 120s 后 detail 返回房间不存在
            Popup.toast('房间已解散');
            SceneNavigator.go(SceneName.LOBBY);
        }
    };

    private onShare() {
        WxAdapter.shareRoom('快来和我玩句子接龙', '', this.roomId);
    }

    private async dissolve() {
        if (this.handle) clearTimeout(this.handle);
        try {
            await Api.roomLeave(this.roomId);
        } catch (e) {
            // ignore
        }
        SceneNavigator.go(SceneName.LOBBY);
    }
}
