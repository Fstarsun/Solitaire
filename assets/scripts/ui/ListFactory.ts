/**
 * ListFactory：在代码中创建一个完整的垂直 ScrollView（含裁剪），
 * 并返回绑定好的 DynamicList。免去在编辑器手动搭建 ScrollView。
 */
import { Node, UITransform, ScrollView, Mask, Color } from 'cc';
import { DynamicList } from './DynamicList';

export interface ListRect {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
}

export function createVerticalList(parent: Node, rect: ListRect): DynamicList {
    // —— ScrollView 根节点 ——
    const svNode = new Node(rect.name || 'List');
    svNode.layer = parent.layer;
    parent.addChild(svNode);
    const svUT = svNode.addComponent(UITransform);
    svUT.setContentSize(rect.width, rect.height);
    svNode.setPosition(rect.x, rect.y, 0);
    const sv = svNode.addComponent(ScrollView);
    sv.horizontal = false;
    sv.vertical = true;
    sv.inertia = true;
    sv.brake = 0.75;

    // —— view（裁剪窗口）——
    const view = new Node('view');
    view.layer = svNode.layer;
    svNode.addChild(view);
    const viewUT = view.addComponent(UITransform);
    viewUT.setContentSize(rect.width, rect.height);
    viewUT.setAnchorPoint(0.5, 1);
    const mask = view.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    mask.color = Color.WHITE;
    // view 顶部对齐 svNode 中心
    view.setPosition(0, rect.height / 2, 0);

    // —— content（列表项容器）——
    const content = new Node('content');
    content.layer = view.layer;
    view.addChild(content);
    const contentUT = content.addComponent(UITransform);
    contentUT.setContentSize(rect.width, 0);
    contentUT.setAnchorPoint(0.5, 1);
    content.setPosition(0, 0, 0);

    sv.content = content;

    return new DynamicList(svNode);
}
