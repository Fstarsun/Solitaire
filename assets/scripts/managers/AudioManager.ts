/**
 * 音频管理（自包含）：
 * 首次调用时自动创建常驻节点与两个 AudioSource，无需在编辑器搭建。
 * 音效文件放入 resources/audio/，用文件名（不含扩展名）调用：
 *   AudioManager.playSfx('btn');
 *   AudioManager.playBgm('bgm_main');
 *
 * 微信小游戏需在用户首次触摸后才能出声，首次点击后自动解锁。
 */
import { AudioSource, AudioClip, resources, Node, director, Layers } from 'cc';
import { Storage } from '../core/Storage';

const SETTING_KEY = 'audio_setting';

interface AudioSetting {
    bgmOn: boolean;
    sfxOn: boolean;
}

export class AudioManager {
    private static bgmSource: AudioSource = null;
    private static sfxSource: AudioSource = null;
    private static clips: Record<string, AudioClip> = {};
    private static loading: Record<string, Promise<AudioClip>> = {};
    private static setting: AudioSetting = Storage.get(SETTING_KEY, {
        bgmOn: true,
        sfxOn: true
    });

    /** 懒初始化常驻音频节点 */
    private static ensureInit() {
        if (this.bgmSource) return;

        const root = new Node('AudioRoot');
        root.layer = Layers.Enum.DEFAULT;
        director.addPersistRootNode(root);

        const bgmNode = new Node('BgmSource');
        const sfxNode = new Node('SfxSource');
        root.addChild(bgmNode);
        root.addChild(sfxNode);

        this.bgmSource = bgmNode.addComponent(AudioSource);
        this.sfxSource = sfxNode.addComponent(AudioSource);
    }

    /** 按名加载（并发去重）；文件不存在只告警不报错 */
    private static loadClip(name: string): Promise<AudioClip> {
        if (this.clips[name]) return Promise.resolve(this.clips[name]);
        if (!this.loading[name]) {
            this.loading[name] = new Promise((resolve) => {
                resources.load(`audio/${name}`, AudioClip, (err, clip) => {
                    delete this.loading[name];
                    if (err) {
                        console.warn('[AudioManager] 缺少音频文件 resources/audio/' + name);
                        resolve(null);
                        return;
                    }
                    this.clips[name] = clip;
                    resolve(clip);
                });
            });
        }
        return this.loading[name];
    }

    static async playSfx(name: string) {
        if (!this.setting.sfxOn) return;
        this.ensureInit();
        const clip = await this.loadClip(name);
        if (clip) this.sfxSource.playOneShot(clip, 1);
    }

    static async playBgm(name: string, loop = true) {
        this.ensureInit();
        if (!this.setting.bgmOn) return;
        const clip = await this.loadClip(name);
        if (!clip) return;
        this.bgmSource.clip = clip;
        this.bgmSource.loop = loop;
        this.bgmSource.play();
    }

    static stopBgm() {
        this.bgmSource && this.bgmSource.stop();
    }

    static setBgmOn(on: boolean) {
        this.setting.bgmOn = on;
        this.persist();
        if (!on) this.stopBgm();
    }

    static setSfxOn(on: boolean) {
        this.setting.sfxOn = on;
        this.persist();
    }

    static getSetting(): AudioSetting {
        return { ...this.setting };
    }

    private static persist() {
        Storage.set(SETTING_KEY, this.setting);
    }
}
