/**
 * 场景控制器基类（挂在场景根节点）
 */
import { _decorator, Component } from 'cc';
import { UIBase } from '../ui/UIBase';

const { ccclass } = _decorator;

@ccclass('BaseScene')
export abstract class BaseScene extends Component {
    protected ui: UIBase;

    onLoad() {
        this.ui = new UIBase(this.node);
        this.onSceneLoad();
    }

    protected abstract onSceneLoad(): void;
}
