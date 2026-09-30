/**
 * 「宣纸墨趣」全局样式（对应《美术风格与AI生图提示词.md》五色板）。
 * 场景静态样式已由 tools/restyle-ui.js 批量写入场景 JSON；
 * 此处供运行时动态节点（列表项、状态变色等）使用，勿再散落硬编码色值。
 */
import { Color, Graphics, Node, UITransform } from 'cc';

export const Palette = {
    /** 宣纸米白 #F7F1E3（背景基底） */
    paper: new Color(247, 241, 227),
    /** 墨黑 #2B2B2B（正文） */
    ink: new Color(43, 43, 43),
    /** 朱砂红 #C8443A（主按钮 / 强调 / 胜负） */
    vermilion: new Color(200, 68, 58),
    /** 黛青 #3E5C6E（次按钮 / 标题） */
    teal: new Color(62, 92, 110),
    /** 鎏金 #C9A24B（点缀 / 前三名） */
    gold: new Color(201, 162, 75),
    /** 竹青 #7FA68C（点缀） */
    bamboo: new Color(127, 166, 140),
    /** 纸白（卡片 / ghost 按钮底） */
    white: new Color(255, 255, 255),
    /** 浅宣纸 #FFFCF2（比页面背景 #FEF9EB 略浅的卡片底，融入背景不扎眼） */
    paperLight: new Color(255, 252, 242),
    /** 墨灰（危险弱化按钮底） */
    inkGray: new Color(90, 90, 90)
};

/** 派生同色不同透明的颜色 */
export function withAlpha(c: Color, a: number): Color {
    return new Color(c.r, c.g, c.b, a);
}

/** 按压态：颜色变暗 */
export function darken(c: Color, f = 0.82): Color {
    return new Color(Math.round(c.r * f), Math.round(c.g * f), Math.round(c.b * f), c.a);
}

/**
 * 在节点上绘制（或重绘）一个居中的圆角卡片底。
 * 用于 DynamicList 列表项；重复调用为覆盖重绘。
 * @param padX 水平两侧各留白像素
 * @param padY 垂直上下各留白像素
 */
export function paintRoundCard(node: Node, fill: Color, radius = 16, padX = 0, padY = 0): Graphics {
    let g = node.getComponent(Graphics);
    if (!g) g = node.addComponent(Graphics);
    g.clear();

    const ut = node.getComponent(UITransform);
    const w = (ut ? ut.width : node.width) - padX * 2;
    const h = (ut ? ut.height : node.height) - padY * 2;
    if (w <= 0 || h <= 0) return g;

    g.fillColor = fill;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    return g;
}
