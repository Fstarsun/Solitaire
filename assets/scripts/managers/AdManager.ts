/**
 * 广告管理：Banner / 插屏 / 激励视频
 * 广告位 ID 来自 getConfig 云配置；拉取失败不发奖励、不卡死。
 */
import { Api } from '../net/Api';
import { RemoteConfig } from '../net/Types';
import { Logger } from '../core/Logger';
import { Popup } from '../ui/Popup';

declare const wx: any;

export class AdManager {
    private static cfg: RemoteConfig = {};
    private static rewardedAd: any = null;
    private static interstitialAd: any = null;
    private static bannerAd: any = null;

    static async loadConfig() {
        try {
            const res = await Api.getConfig();
            this.cfg = res.config || {};
        } catch (e) {
            Logger.warn('AdManager', 'load config failed', e);
        }
    }

    // ————— Banner —————
    static showBanner() {
        if (typeof wx === 'undefined' || !this.cfg.ad_banner_id) return;
        this.hideBanner();
        try {
            const info = wx.getSystemInfoSync();
            this.bannerAd = wx.createBannerAd({
                adUnitId: this.cfg.ad_banner_id,
                style: { left: 0, top: info.windowHeight - 100, width: info.windowWidth }
            });
            this.bannerAd.onError((e: any) => Logger.warn('AdManager', 'banner error', e));
            this.bannerAd.show().catch(() => {});
        } catch (e) {
            Logger.warn('AdManager', 'show banner failed', e);
        }
    }

    static hideBanner() {
        if (this.bannerAd) {
            try {
                this.bannerAd.destroy();
            } catch (e) {
                // ignore
            }
            this.bannerAd = null;
        }
    }

    // ————— 插屏 —————
    static showInterstitial() {
        if (typeof wx === 'undefined' || !this.cfg.ad_interstitial_id) return;
        try {
            if (!this.interstitialAd) {
                this.interstitialAd = wx.createInterstitialAd({
                    adUnitId: this.cfg.ad_interstitial_id
                });
                this.interstitialAd.onError((e: any) => Logger.warn('AdManager', 'interstitial error', e));
            }
            this.interstitialAd.show().catch(() => {});
        } catch (e) {
            Logger.warn('AdManager', 'show interstitial failed', e);
        }
    }

    // ————— 激励视频 —————
    /**
     * 展示激励视频
     * @returns true 完整播放应发奖励；false 未播完/拉取失败，不发奖励
     */
    showRewardedAd(): Promise<boolean> {
        return new Promise((resolve) => {
            if (typeof wx === 'undefined' || !this.cfg.ad_rewarded_id) {
                Popup.toast('广告暂不可用');
                resolve(false);
                return;
            }

            const finish = (reward: boolean) => resolve(reward);

            try {
                if (!this.rewardedAd) {
                    this.rewardedAd = wx.createRewardedVideoAd({
                        adUnitId: this.cfg.ad_rewarded_id
                    });
                    this.rewardedAd.onError((e: any) => {
                        Logger.warn('AdManager', 'rewarded error', e);
                        Popup.toast('广告暂不可用');
                        finish(false);
                    });
                }

                let rewarded = false;
                this.rewardedAd.offClose && this.rewardedAd.offClose();
                this.rewardedAd.onClose((res: any) => {
                    // isEnded=true 完整播放
                    if (res && res.isEnded) rewarded = true;
                    finish(rewarded);
                });

                this.rewardedAd.show().catch(() => {
                    // 拉取失败：重新加载后再展示一次
                    this.rewardedAd
                        .load()
                        .then(() => this.rewardedAd.show())
                        .catch(() => {
                            Popup.toast('广告暂不可用');
                            finish(false);
                        });
                });
            } catch (e) {
                Logger.warn('AdManager', 'rewarded failed', e);
                Popup.toast('广告暂不可用');
                finish(false);
            }
        });
    }
}
