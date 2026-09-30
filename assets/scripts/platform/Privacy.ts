/**
 * 隐私保护：微信要求用户同意隐私指引后才能 wx.login / 收集信息
 * 使用 wx.onNeedPrivacyAuthorization + requirePrivacyAuthorize。
 */
declare const wx: any;

export class Privacy {
    /**
     * 确保已同意隐私政策
     * @param agree 非微信环境/开发期本地确认（true 直接通过）
     */
    static ensure(): Promise<boolean> {
        return new Promise((resolve) => {
            if (typeof wx === 'undefined' || !wx.requirePrivacyAuthorize) {
                resolve(true);
                return;
            }

            // 需要在小游戏后台配置《用户隐私保护指引》
            wx.requirePrivacyAuthorize({
                success: () => resolve(true),
                fail: () => resolve(false)
            });
        });
    }

    /**
     * 注册自定义隐私弹窗（场景中有自建弹窗时使用）
     * 未注册时由微信展示默认授权弹窗。
     */
    static registerPopup(onNeed: (resolve: () => void) => void) {
        if (typeof wx === 'undefined' || !wx.onNeedPrivacyAuthorization) return;
        wx.onNeedPrivacyAuthorization((resolve: () => void) => onNeed(resolve));
    }
}
