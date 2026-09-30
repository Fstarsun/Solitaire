/**
 * 本地缓存（wx.storage 兜底，编辑器内用内存）
 */
const memStore: Record<string, string> = {};

export const Storage = {
    set(key: string, value: unknown) {
        const raw = JSON.stringify(value);
        try {
            if (typeof wx !== 'undefined' && wx.setStorageSync) {
                wx.setStorageSync(key, raw);
            } else {
                memStore[key] = raw;
            }
        } catch (e) {
            memStore[key] = raw;
        }
    },

    get<T>(key: string, def: T = null): T {
        let raw = '';
        try {
            if (typeof wx !== 'undefined' && wx.getStorageSync) {
                raw = wx.getStorageSync(key);
            } else {
                raw = memStore[key] || '';
            }
        } catch (e) {
            raw = memStore[key] || '';
        }
        if (!raw) return def;
        try {
            return JSON.parse(raw) as T;
        } catch (e) {
            return def;
        }
    },

    remove(key: string) {
        try {
            if (typeof wx !== 'undefined' && wx.removeStorageSync) wx.removeStorageSync(key);
            delete memStore[key];
        } catch (e) {
            delete memStore[key];
        }
    }
};
