/**
 * 微信能力适配：登录、分享、震动、音频解锁、剪贴板
 */
declare const wx: any;

export const WxAdapter = {
    isWx(): boolean {
        return typeof wx !== 'undefined';
    },

    login(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.isWx()) return resolve('mock-code');
            wx.login({ success: (r: any) => resolve(r.code), fail: reject });
        });
    },

    /** 短振动（提交/胜负反馈用） */
    vibrate(short = true) {
        if (!this.isWx()) return;
        if (short) wx.vibrateShort && wx.vibrateShort({ type: 'light' });
        else wx.vibrateLong && wx.vibrateLong();
    },

    copy(text: string) {
        if (!this.isWx()) return;
        wx.setClipboardData({ data: text });
    },

    /**
     * 分享房间（好友房等待页调用）
     */
    shareAppMessage(title: string, imageUrl: string, roomId: string) {
        if (!this.isWx()) return;
        wx.showShareMenu && wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] });
        wx.onShareAppMessage &&
            wx.onShareAppMessage(() => ({
                title,
                imageUrl,
                query: `roomId=${roomId}`
            }));
    },

    /** 冷启动参数（如分享卡片携带的 roomId） */
    getLaunchQuery(): Record<string, string> {
        if (!this.isWx()) return {};
        try {
            const res = wx.getLaunchOptionsSync();
            return (res && res.query) || {};
        } catch (e) {
            return {};
        }
    },

    /** 主动调起转发 */
    shareRoom(title: string, imageUrl: string, roomId: string) {
        if (!this.isWx()) return;
        this.shareAppMessage(title, imageUrl, roomId);
        wx.shareAppMessage({ title, imageUrl, query: `roomId=${roomId}` });
    }
};
