/**
 * 登录态管理
 */
import { Api } from '../net/Api';
import { UserProfile } from '../net/Types';
import { Storage } from '../core/Storage';
import { EventBus, GameEvent } from '../core/EventBus';
import { Logger } from '../core/Logger';

const PROFILE_KEY = 'user_profile';

export class Auth {
    private static profile: UserProfile = null;

    static async login(): Promise<UserProfile> {
        try {
            const res = await Api.login();
            this.profile = res.profile;
            Storage.set(PROFILE_KEY, this.profile);
            EventBus.emit(GameEvent.LOGIN_SUCCESS, this.profile);
            return this.profile;
        } catch (e) {
            Logger.error('Auth', 'login failed', e);
            throw e;
        }
    }

    static getProfile(): UserProfile {
        if (!this.profile) this.profile = Storage.get<UserProfile>(PROFILE_KEY, null);
        return this.profile;
    }

    static get openid(): string {
        return this.getProfile() ? this.getProfile().openid : '';
    }

    static isLoggedIn(): boolean {
        return !!this.getProfile();
    }

    /** 更新本地档案（如结算后） */
    static updateProfile(patch: Partial<UserProfile>) {
        if (!this.profile) return;
        this.profile = { ...this.profile, ...patch };
        Storage.set(PROFILE_KEY, this.profile);
    }

    static logout() {
        this.profile = null;
        Storage.remove(PROFILE_KEY);
    }
}
