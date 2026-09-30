/**
 * 云函数调用封装
 * 要求：在 Cocos 构建面板勾选微信小游戏，并在游戏启动时调用 Cloud.init(envId)
 */
import { Logger } from '../core/Logger';

export interface ApiResult<T = any> {
    code: number;
    msg: string;
    data: T;
}

export class CloudError extends Error {
    code: number;
    data: any;
    constructor(code: number, msg: string, data: any = null) {
        super(msg);
        this.code = code;
        this.data = data;
    }
}

declare const wx: any;

export class Cloud {
    private static inited = false;

    static init(envId: string) {
        if (this.inited) return;
        if (typeof wx === 'undefined' || !wx.cloud) {
            Logger.warn('Cloud', 'wx.cloud 不存在（编辑器预览/非微信环境），调用将走本地桩');
            return;
        }
        wx.cloud.init({ env: envId, traceUser: true });
        this.inited = true;
    }

    /**
     * 调用云函数
     * @param name 函数名
     * @param data 事件参数
     * @param mock 非微信环境（编辑器）下的桩数据，便于先调 UI
     */
    static async call<T = any>(name: string, data: Record<string, any> = {}, mock?: T): Promise<T> {
        if (typeof wx === 'undefined' || !wx.cloud) {
            if (mock !== undefined) return mock;
            throw new CloudError(1000, '当前环境不支持云调用');
        }

        const res = await wx.cloud.callFunction({ name, data });
        const result = res.result as ApiResult<T>;

        if (!result || typeof result.code !== 'number') {
            throw new CloudError(1000, '返回格式错误');
        }
        if (result.code !== 0) {
            throw new CloudError(result.code, result.msg, result.data);
        }
        return result.data;
    }
}
