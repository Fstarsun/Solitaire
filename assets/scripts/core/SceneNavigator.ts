/**
 * 场景切换
 */
import { director } from 'cc';

export const SceneName = {
    BOOT: 'Boot',
    LOBBY: 'Lobby',
    MATCH: 'Match',
    ROOM_WAIT: 'RoomWait',
    JOIN_ROOM: 'JoinRoom',
    BATTLE: 'Battle',
    RESULT: 'Result',
    RANK: 'Rank',
    PROFILE: 'Profile',
    LEVEL: 'Level'
};

export class SceneNavigator {
    static go(scene: string): Promise<void> {
        return new Promise((resolve, reject) => {
            director.loadScene(scene, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}
