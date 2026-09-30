/**
 * 远程贴图加载：从云存储下载图片并转成 SpriteFrame。
 * 入参支持：
 *   - 微信 FileID（cloud://...，无需配域名白名单，推荐）
 *   - https URL（需在小游戏后台配置 downloadFile 合法域名）
 * 下载结果在本次运行内缓存；切换场景不重复下载。
 */
import { assetManager, ImageAsset, SpriteFrame, Texture2D } from 'cc';

declare const wx: any;

export class RemoteTexture {
    private static cache: Record<string, SpriteFrame> = {};

    static async loadSpriteFrame(fileIDOrUrl: string): Promise<SpriteFrame> {
        if (!fileIDOrUrl) return null;
        if (this.cache[fileIDOrUrl]) return this.cache[fileIDOrUrl];

        const localPath = await this.download(fileIDOrUrl);
        if (!localPath) return null;

        const imageAsset = await this.loadRemoteImage(localPath);
        if (!imageAsset) return null;

        const texture = new Texture2D();
        texture.image = imageAsset;
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;

        this.cache[fileIDOrUrl] = spriteFrame;
        return spriteFrame;
    }

    /** 云存储 FileID 走 wx.cloud.downloadFile；https 直接交给引擎 */
    private static download(fileIDOrUrl: string): Promise<string> {
        if (fileIDOrUrl.startsWith('http')) {
            return Promise.resolve(fileIDOrUrl);
        }
        return new Promise((resolve) => {
            if (typeof wx === 'undefined' || !wx.cloud) {
                resolve('');
                return;
            }
            wx.cloud.downloadFile({
                fileID: fileIDOrUrl,
                success: (res: any) => resolve(res.tempFilePath),
                fail: () => resolve('')
            });
        });
    }

    private static loadRemoteImage(path: string): Promise<ImageAsset> {
        return new Promise((resolve) => {
            assetManager.loadRemote<ImageAsset>(path, (err, imageAsset) => {
                resolve(err ? null : imageAsset);
            });
        });
    }
}
