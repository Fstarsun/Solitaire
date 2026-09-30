/**
 * DynamicList：配合标准 ScrollView 使用，用代码动态生成列表项。
 * ScrollView 需为编辑器右键「创建 -> UI 组件 -> ScrollView」的默认结构：
 *   ScrollView/view/content
 *
 * 用法：
 *   const list = new DynamicList(scrollViewNode);
 *   list.setItemHeight(120);
 *   list.setData(items, (itemNode, data) => {
 *       DynamicList.setLabel(itemNode, 'Label', data.text, { color: Color.WHITE });
 *   });
 */
import { Node, Label, UITransform, Color, Vec3, Size, HorizontalTextAlignment, ScrollView } from 'cc';
import { Palette, withAlpha, paintRoundCard } from './Theme';

export type ItemSetup<T> = (itemNode: Node, data: T, index: number) => void;

/** 列表项默认卡片底（半透明纸白） */
const CARD_DEFAULT = withAlpha(Palette.white, 216);

export class DynamicList {
    private scrollNode: Node = null;
    private content: Node = null;
    private scrollView: ScrollView = null;
    private itemHeight = 100;
    private itemWidth = 600;
    private pool: Node[] = [];

    constructor(scrollNode: Node) {
        this.scrollNode = scrollNode;
        this.content =
            scrollNode.getChildByPath('view/content') ||
            scrollNode.getChildByName('content');
        if (!this.content) {
            console.error('[DynamicList] 找不到 content，请确认是默认 ScrollView 结构');
        }
        this.scrollView = scrollNode.getComponent(ScrollView);
    }

    /** 滚动到底部（对战显示最新句） */
    scrollToBottom(animated = false) {
        if (this.scrollView) this.scrollView.scrollToBottom(animated ? 0.2 : 0);
    }

    private reachBottomCb: (() => void) | null = null;

    /** 注册「滚动到底部」回调（无限加载用），距底 30px 内即触发 */
    onReachBottom(cb: () => void) {
        this.reachBottomCb = cb;
        if (this.scrollView) {
            this.scrollView.node.on('scroll-ended', this.emitIfBottom, this);
        }
    }

    private emitIfBottom() {
        if (!this.reachBottomCb || !this.content) return;
        const view = this.scrollNode.getChildByPath('view');
        const viewUT = view && view.getComponent(UITransform);
        const contentUT = this.content.getComponent(UITransform);
        if (!viewUT || !contentUT) return;
        // content 锚点在顶部：完全滚到底时 y = -(contentH - viewH)
        const maxScroll = contentUT.height - viewUT.height;
        if (maxScroll <= 0) return;
        if (this.content.position.y <= -maxScroll + 30) {
            this.reachBottomCb();
        }
    }

    setItemHeight(h: number) {
        this.itemHeight = h;
    }

    /**
     * 渲染列表
     * @param items 数据
     * @param setup 每项内容配置回调
     */
    setData<T>(items: T[], setup: ItemSetup<T>) {
        if (!this.content) return;

        const view = this.scrollNode.getChildByPath('view');
        const viewUT = view && view.getComponent(UITransform);
        if (viewUT) this.itemWidth = viewUT.width;

        this.ensureNodes(items.length);

        for (let i = 0; i < items.length; i++) {
            const node = this.pool[i];
            node.active = true;
            // content 默认锚点 (0.5,1)，自上而下
            node.setPosition(0, -this.itemHeight / 2 - i * this.itemHeight, 0);
            // 默认卡片底；setup 内可用 paintRoundCard 覆盖颜色
            paintRoundCard(node, CARD_DEFAULT, 16, 12, 5);
            setup(node, items[i], i);
        }
        for (let i = items.length; i < this.pool.length; i++) {
            this.pool[i].active = false;
        }

        const contentUT = this.content.getComponent(UITransform);
        contentUT.setContentSize(new Size(this.itemWidth, items.length * this.itemHeight));
    }

    private ensureNodes(count: number) {
        while (this.pool.length < count) {
            const node = new Node('Item');
            node.layer = this.content.layer;
            const ut = node.addComponent(UITransform);
            ut.setContentSize(new Size(this.itemWidth, this.itemHeight));
            ut.setAnchorPoint(0.5, 1);
            this.content.addChild(node);
            this.pool.push(node);
        }
    }

    /** 在 itemNode 下确保有指定名字的 Label，并设置文字/样式 */
    static setLabel(
        itemNode: Node,
        childName: string,
        text: string,
        opt: {
            fontSize?: number;
            color?: Color;
            x?: number;
            y?: number;
            width?: number;
            align?: HorizontalTextAlignment;
            bold?: boolean;
        } = {}
    ): Label {
        let child = itemNode.getChildByName(childName);
        let label: Label;
        if (!child) {
            child = new Node(childName);
            child.layer = itemNode.layer;
            child.addComponent(UITransform);
            label = child.addComponent(Label);
            itemNode.addChild(child);
        } else {
            label = child.getComponent(Label) || child.addComponent(Label);
        }

        label.string = text;
        if (opt.fontSize) {
            label.fontSize = opt.fontSize;
            label.lineHeight = Math.round(opt.fontSize * 1.25);
        }
        if (opt.color) label.color = opt.color;
        if (opt.align !== undefined) label.horizontalAlign = opt.align;
        if (opt.bold !== undefined) label.isBold = opt.bold;

        const ut = child.getComponent(UITransform);
        if (opt.width) ut.setContentSize(new Size(opt.width, ut.height));
        child.setPosition(opt.x || 0, opt.y || 0, 0);
        return label;
    }
}
