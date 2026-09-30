/**
 * UI 组件基类：节点查找与事件绑定
 */
import { Node, Label, Button, EditBox, Sprite } from 'cc';

export class UIBase {
    protected node: Node = null;

    constructor(node: Node) {
        this.node = node;
    }

    find(path: string): Node {
        return findNode(this.node, path);
    }

    /** 获取节点（供列表等组件使用） */
    getNode(path: string): Node {
        return this.find(path);
    }

    setText(path: string, text: string) {
        const n = this.find(path);
        if (n) {
            const label = n.getComponent(Label) || n.getComponentInChildren(Label);
            if (label) label.string = text;
        }
    }

    onTap(path: string, cb: () => void, target?: unknown) {
        const n = this.find(path);
        if (!n) return;
        n.off(Button.EventType.CLICK);
        n.on(Button.EventType.CLICK, cb, target || this);
    }

    setVisible(path: string, visible: boolean) {
        const n = this.find(path);
        if (n) n.active = visible;
    }

    setInteractable(path: string, val: boolean) {
        const n = this.find(path);
        if (n) {
            const btn = n.getComponent(Button);
            if (btn) btn.interactable = val;
        }
    }

    getEditText(path: string): string {
        const n = this.find(path);
        const eb = n && n.getComponent(EditBox);
        return eb ? eb.string : '';
    }
}

/** 按 'a/b/c' 路径查找 */
export function findNode(root: Node, path: string): Node {
    if (!path) return root;
    let cur: Node = root;
    for (const seg of path.split('/')) {
        if (!cur) return null;
        cur = cur.getChildByName(seg);
    }
    return cur;
}

export { Label, Button, EditBox, Sprite };
