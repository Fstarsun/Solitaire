/**
 * 轻量提示：toast / 确认框（依赖场景中放置对应节点，未放置时降级 wx 原生）
 */
declare const wx: any;

export const Popup = {
    toast(title: string) {
        if (typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({ title, icon: 'none', duration: 1800 });
        } else {
            console.log('[toast]', title);
        }
    },

    loading(title = '加载中...') {
        if (typeof wx !== 'undefined' && wx.showLoading) wx.showLoading({ title, mask: true });
    },

    hideLoading() {
        if (typeof wx !== 'undefined' && wx.hideLoading) wx.hideLoading();
    },

    confirm(content: string, title = '提示'): Promise<boolean> {
        return new Promise((resolve) => {
            if (typeof wx !== 'undefined' && wx.showModal) {
                wx.showModal({
                    title,
                    content,
                    success: (r: any) => resolve(!!r.confirm)
                });
            } else {
                resolve(window.confirm(content));
            }
        });
    }
};
