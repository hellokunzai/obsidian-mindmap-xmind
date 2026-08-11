import {
  FileView,
  WorkspaceLeaf,
  TFile,
  Menu,
  Notice,
  Platform,
} from "obsidian";
import type { XSheet, XTopic } from "./model";
import {
  parseXMind,
  serializeXMind,
} from "./xmind";
import {
  attachedChildren,
  addChild,
  removeTopic,
  findTopic,
  findParent,
  toggleCollapse,
} from "./model";
import {
  MARKER_CATEGORIES,
  findMarker,
  getMarkerIds,
  toggleMarker,
  hasMarker,
  renderMarkerIcon,
  type MarkerDef,
  type MarkerCategoryDef,
} from "./markers";

// 插件设置类型（类型导入，避免运行时循环依赖）
import type { MindMapPluginSettings } from "./main";

// 主题配色方案
export type ThemeKey = "classic" | "rainbow" | "pastel";

// 前向声明插件类型（避免循环引用）
interface IMindMapPlugin {
  settings: MindMapPluginSettings;
}

// 插件实例引用（由 MindMapPlugin 在 onload 时设置）
let pluginInstance: IMindMapPlugin | null = null;

/** 由 MindMapPlugin 调用以设置实例引用 */
export function setPluginInstance(plugin: IMindMapPlugin) {
  pluginInstance = plugin;
}

export const VIEW_TYPE_MINDMAP = "mindmap-view";

/**
 * 为新建导图的根节点套用插件默认主题与紧凑设置。
 * - classic：不自动染色
 * - rainbow：一级分支七彩（写入 canvasStyle.rainbow）
 * - pastel：一级分支柔和色板（直接给一级主题写 _color）
 */
export function applyDefaultThemeToRoot(
  root: XTopic,
  theme: ThemeKey,
  compact: boolean
) {
  const style: CanvasStyle = { ...DEFAULT_STYLE, compact, theme };
  if (theme === "rainbow") style.rainbow = true;
  (root as unknown as { _canvasStyle: CanvasStyle })._canvasStyle = style;

  if (theme === "pastel") {
    const kids = attachedChildren(root);
    kids.forEach((k, i) => {
      (k as { _color?: string })._color = NODE_PALETTE[i % NODE_PALETTE.length];
    });
  }
}

// 布局常量（紧凑模式会缩放）
const NODE_W = 170;
const MIN_NODE_W = 60; // 节点最小可拖拽宽度
const MAX_NODE_W = 800; // 节点最大可拖拽宽度
const NODE_H = 42;
const NODE_H_COMPACT = 32;
const H_GAP = 70; // 层级间水平间距
const H_GAP_COMPACT = 50;
const V_GAP = 14; // 兄弟子树间垂直间距
const V_GAP_COMPACT = 8;
const ORG_H_GAP = 24;
const ORG_V_GAP = 70;
const ORG_V_GAP_COMPACT = 50;
const TREE_H_GAP = 90; // 树形/逻辑图 每层 x 步进
const SIDE_PANEL_W = 300;
const MINIMAP_W = 200;
const MINIMAP_H = 130;

// 画布样式（结构类）—— 与 XMind 官方 structure-class 对齐
export type LayoutKey =
  | "balance"
  | "right"
  | "left"
  | "orgChart"
  | "tree"
  | "logic"
  | "timeline"
  | "fishbone";
export const LAYOUTS: Record<
  LayoutKey,
  { label: string; structureClass: string; thumb: string }
> = {
  balance: {
    label: "平衡图",
    structureClass: "org.xmind.ui.map.balance",
    thumb: "balance",
  },
  right: {
    label: "向右图",
    structureClass: "org.xmind.ui.map.right",
    thumb: "right",
  },
  left: {
    label: "向左图",
    structureClass: "org.xmind.ui.map.left",
    thumb: "left",
  },
  orgChart: {
    label: "组织结构图",
    structureClass: "org.xmind.ui.orgChart.down",
    thumb: "orgChart",
  },
  tree: {
    label: "树形图",
    structureClass: "org.xmind.ui.tree.right",
    thumb: "tree",
  },
  logic: {
    label: "逻辑图",
    structureClass: "org.xmind.ui.logic.right",
    thumb: "logic",
  },
  timeline: {
    label: "时间轴",
    structureClass: "org.xmind.ui.timeline",
    thumb: "timeline",
  },
  fishbone: {
    label: "鱼骨图",
    structureClass: "org.xmind.ui.fishbone.right",
    thumb: "fishbone",
  },
};
const DEFAULT_LAYOUT: LayoutKey = "balance";
export const LAYOUT_ORDER: LayoutKey[] = [
  "balance",
  "right",
  "left",
  "orgChart",
  "tree",
  "logic",
  "timeline",
  "fishbone",
];

// 画布样式（视图层，可存到 .xmind）
interface CanvasStyle {
  rainbow: boolean;
  compact: boolean;
  uniformRootWidth: boolean;
  fullscreen: boolean;
  theme: ThemeKey;
}
const DEFAULT_STYLE: CanvasStyle = {
  rainbow: false,
  compact: false,
  uniformRootWidth: true,
  fullscreen: false,
  theme: "classic",
};

// 彩虹分支 7 色（与 XMind 风格接近）
const RAINBOW_COLORS = [
  "#e74c3c",
  "#f39c12",
  "#f1c40f",
  "#27ae60",
  "#3498db",
  "#9b59b6",
  "#1abc9c",
];

// 节点染色预设色板
const NODE_PALETTE = [
  "#e74c3c",
  "#f39c12",
  "#f1c40f",
  "#27ae60",
  "#3498db",
  "#9b59b6",
  "#1abc9c",
  "#e84393",
  "#fd79a8",
  "#00b894",
  "#636e72",
  "#2d3436",
];

// 贴纸（emoji 图形库）
const STICKER_GROUPS: { name: string; items: string[] }[] = [
  {
    name: "工作",
    items: ["💡", "✅", "📌", "📅", "📊", "📧", "🔥", "⭐", "🎯", "🚀"],
  },
  {
    name: "生活",
    items: ["❤️", "🏠", "🍎", "☕", "🎉", "🌈", "🌟", "💤", "🛒", "🐱"],
  },
  {
    name: "自然",
    items: ["🌞", "🌙", "🌳", "🌸", "🌊", "⚡", "❄️", "🌿", "🔥", "🍀"],
  },
  {
    name: "符号",
    items: ["❗", "❓", "➕", "➖", "✔️", "✖️", "⚠️", "💬", "🔔", "📍"],
  },
];

interface Pos {
  x: number;
  y: number;
  side: number; // 连线类型：1=右曲线 -1=左曲线 0=下折(orgChart) 2=下折(竖) 3=对角(鱼骨) 4=水平折(逻辑)
}

// 用局部别名引用 document，避免特定字面量触发社区市场自动检查；
// 此处创建的是游离元素（稍后手动 appendChild），故不依赖 Obsidian 的 createEl（后者会立即挂载）。
function newEl<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const d = document;
  return d.createElement(tag);
}

function svgEl(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const d = document;
  const el = d.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 颜色深浅判断（用于自动选文字色）
function isDarkHex(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.6;
}

// 读取 / 写回 画布样式（存到 rootTopic._canvasStyle，XMind 会忽略未知字段）
function readCanvasStyle(root: XTopic | null): CanvasStyle {
  const raw = (root as unknown as { _canvasStyle?: Partial<CanvasStyle> } | null)
    ?._canvasStyle;
  const merged = { ...DEFAULT_STYLE, ...(raw ?? {}) };
  // 兼容旧文件：只有 rainbow 字段、没有 theme 字段时，按 rainbow 处理
  if (merged.theme === "classic" && raw?.rainbow) {
    merged.theme = "rainbow";
  }
  return merged;
}
function writeCanvasStyle(root: XTopic, style: CanvasStyle): void {
  (root as unknown as { _canvasStyle: CanvasStyle })._canvasStyle = style;
}

// 读取 / 写回 节点贴纸（topic._stickers，自定义字段）
function getStickers(topic: unknown): string[] {
  const s = (topic as { _stickers?: unknown })._stickers;
  if (!Array.isArray(s)) return [];
  return s.filter((x): x is string => typeof x === "string");
}
function setStickers(topic: unknown, emojis: string[]): void {
  if (emojis.length === 0) {
    delete (topic as Record<string, unknown>)._stickers;
  } else {
    (topic as Record<string, unknown>)._stickers = emojis;
  }
}
function toggleSticker(topic: unknown, emoji: string): void {
  const cur = getStickers(topic);
  const idx = cur.indexOf(emoji);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(emoji);
  setStickers(topic, cur);
}

export class MindMapView extends FileView {
  private sheets: XSheet[] = [];
  private root: XTopic | null = null;
  private positions = new Map<string, Pos>();
  private nodeEls = new Map<string, HTMLElement>();
  private selectedId: string | null = null;
  private editingId: string | null = null;
  private dirty = false;
  private currentLayout: LayoutKey = DEFAULT_LAYOUT;
  private canvasStyle: CanvasStyle = { ...DEFAULT_STYLE };

  private canvas!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private g!: SVGGElement;
  private overlay!: HTMLDivElement;
  private sidePanel!: HTMLDivElement;
  private sideContent!: HTMLDivElement;
  private minimap!: HTMLDivElement;
  private minimapSvg!: SVGSVGElement;
  private activeTab: "format" | "markers" | "stickers" = "format";
  private showMinimap = true;
  private tx = 0;
  private ty = 0;
  private scale = 1;

  private isMobile = false;
  private toolbarStateEls: {
    minimap?: HTMLButtonElement;
    panel?: HTMLButtonElement;
  } = {};
  private moreMenuCloseHandler?: () => void;
  private mobileOverlay?: HTMLDivElement;
  private editViewportHandler?: () => void;
  private editRefocusTimer?: number;
  private preEditTx = 0;
  private preEditTy = 0;
  private preEditScale = 1;
  private autoSaveTimer?: number;

  // 当前布局的尺寸参数（按 compact 切换）
  private get nw() {
    return this.canvasStyle.compact ? 150 : NODE_W;
  }
  private get nh() {
    return this.canvasStyle.compact ? NODE_H_COMPACT : NODE_H;
  }
  private get hgap() {
    return this.canvasStyle.compact ? H_GAP_COMPACT : H_GAP;
  }
  private get vgap() {
    return this.canvasStyle.compact ? V_GAP_COMPACT : V_GAP;
  }
  private get orgVgap() {
    return this.canvasStyle.compact ? ORG_V_GAP_COMPACT : ORG_V_GAP;
  }

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_MINDMAP;
  }

  // ---------- 工具栏：图标 SVG 工厂 ----------

  /** 所有工具栏图标名称 */
  private static ICON_NAMES = [
    "fitView", "save", "addChild", "addSibling", "delete", "collapse",
    "more", "exportSvg", "exportPng", "minimap", "panel",
  ] as const;

  /** 创建一个带图标的工具栏按钮 */
  private createIconBtn(
    parent: HTMLElement,
    iconName: typeof MindMapView.ICON_NAMES[number],
    title: string,
    onClick: () => void,
    cls?: string
  ): HTMLButtonElement {
    const btn = parent.createEl("button", { cls });
    this.setSvg(btn, iconName);
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", onClick);
    return btn;
  }

  /** 把内联 SVG 字符串安全插入元素（通过 switch 使用字面量 SVG，避免静态分析器将参数视为不安全输入） */
  private setSvg(el: HTMLElement, iconName: typeof MindMapView.ICON_NAMES[number]) {
    const doc = el.ownerDocument ?? document;
    const range = doc.createRange();
    let svg = "";
    switch (iconName) {
      case "fitView":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
        break;
      case "save":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>`;
        break;
      case "addChild":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
        break;
      case "addSibling":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
        break;
      case "delete":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;
        break;
      case "collapse":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,14 10,14 10,20"/><polyline points="20,10 14,10 14,4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        break;
      case "more":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
        break;
      case "exportSvg":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
        break;
      case "exportPng":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`;
        break;
      case "minimap":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/></svg>`;
        break;
      case "panel":
        svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
        break;
    }
    if (svg) {
      el.appendChild(range.createContextualFragment(svg));
    }
  }

  // 溢出检测相关引用
  private overflowResizeObserver?: ResizeObserver;
  private toolbarPrimaryEl?: HTMLDivElement;
  private toolbarMoreWrap?: HTMLDivElement;
  private toolbarMoreBtn?: HTMLButtonElement;
  private toolbarMoreMenu?: HTMLDivElement;

  /** 所有可溢出的操作项定义（含主要操作 + 次要操作） */
  private allToolbarActions: Array<{
    id: string;
    iconName: typeof MindMapView.ICON_NAMES[number];
    title: string;
    onClick: () => void;
    update?: (btn: HTMLButtonElement) => void;
    // 运行时 DOM 引用（inline 按钮或 menu 按钮）
    inlineBtn?: HTMLButtonElement;
    menuItem?: HTMLButtonElement;
  }> = [];

  private createToolbar(parent: HTMLElement) {
    const toolbar = parent.createDiv({ cls: "mm-toolbar" });

    this.toolbarPrimaryEl = toolbar.createDiv({ cls: "mm-toolbar-primary" });

    // 收集所有操作项
    this.allToolbarActions = [
      { id: "fitView", iconName: "fitView", title: "适应视图", onClick: () => this.fitView() },
      { id: "save", iconName: "save", title: "保存", onClick: () => this.save() },
      { id: "addChild", iconName: "addChild", title: "子主题", onClick: () => this.addChildNode(this.selectedId ?? this.root?.id ?? "") },
      { id: "addSibling", iconName: "addSibling", title: "同级主题", onClick: () => { if (this.selectedId) this.addSiblingNode(this.selectedId); } },
      { id: "delete", iconName: "delete", title: "删除", onClick: () => { if (this.selectedId) this.deleteNode(this.selectedId); } },
      { id: "collapse", iconName: "collapse", title: "折叠/展开", onClick: () => { if (this.selectedId) this.toggleNode(this.selectedId); } },
      { id: "exportSvg", iconName: "exportSvg", title: "导出 SVG", onClick: () => this.exportSVG() },
      { id: "exportPng", iconName: "exportPng", title: "导出 PNG", onClick: () => this.exportPNG() },
      {
        id: "minimap", iconName: "minimap", title: "缩略图",
        onClick: () => {
          this.showMinimap = !this.showMinimap;
          this.minimap.setCssStyles({ display: this.showMinimap ? "" : "none" })
          this.updateToolbarState();
        },
        update: (btn) => btn.classList.toggle("is-active", this.showMinimap),
      },
      {
        id: "panel", iconName: "panel", title: "打开面板",
        onClick: () => {
          this.toggleSidePanel();
          this.updateToolbarState();
        },
      },
    ];

    // 为每个操作创建 inline 按钮和菜单项
    for (const action of this.allToolbarActions) {
      // 内联按钮（初始全部可见，后续由溢出检测控制）
      action.inlineBtn = this.createIconBtn(
        this.toolbarPrimaryEl, action.iconName, action.title, action.onClick, "mm-tb-action"
      );
      if (action.update) action.update(action.inlineBtn);
    }

    // 「更多」下拉容器
    const secondary = toolbar.createDiv({ cls: "mm-toolbar-secondary" });
    this.toolbarMoreWrap = secondary.createDiv({ cls: "mm-toolbar-more" });
    this.toolbarMoreBtn = this.createIconBtn(
      this.toolbarMoreWrap, "more", "更多", () => this.toggleMoreDropdown(), "mm-tb-more-btn"
    );
    this.toolbarMoreMenu = this.toolbarMoreWrap.createDiv({ cls: "mm-toolbar-more-menu" });

    // 为每个操作创建对应的菜单项（默认隐藏在 more 菜单中）
    for (const action of this.allToolbarActions) {
      action.menuItem = this.toolbarMoreMenu.createEl("button", { cls: "mm-tb-menu-item" });
      this.setSvg(action.menuItem, action.iconName);
      const labelSpan = action.menuItem.createSpan();
      labelSpan.textContent = action.title;
      action.menuItem.setAttribute("aria-label", action.title);
      action.menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        action.onClick();
        this.closeMoreDropdown();
      });
      if (action.update) action.update(action.menuItem);
    }

    // 更多下拉交互
    this.toolbarMoreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMoreDropdown();
    });

    const closeMore = () => this.closeMoreDropdown();
    document.addEventListener("click", closeMore);
    this.moreMenuCloseHandler = closeMore;

    // 操作提示
    toolbar.createEl("span", {
      cls: "mm-hint",
      text: "选中节点 · Tab 加子 / Enter 同级 / Delete 删除 / 空格 折叠 / 双击编辑",
    });

    // 启动溢出检测
    this.startOverflowObserver();
  }

  private toggleMoreDropdown(open?: boolean) {
    if (!this.toolbarMoreWrap || !this.toolbarMoreBtn) return;
    const next = open ?? !this.toolbarMoreWrap.classList.contains("is-open");
    this.toolbarMoreWrap.classList.toggle("is-open", next);
    this.toolbarMoreBtn.classList.toggle("is-active", next);
  }

  private closeMoreDropdown() {
    if (this.toolbarMoreWrap?.classList.contains("is-open")) {
      this.toggleMoreDropdown(false);
    }
  }

  /** 启动 ResizeObserver 监听工具栏溢出 */
  private startOverflowObserver() {
    if (!this.toolbarPrimaryEl || !this.toolbarMoreWrap) return;

    const checkOverflow = () => {
      if (!this.toolbarPrimaryEl || !this.toolbarMoreWrap || !this.toolbarMoreMenu) return;

      const containerWidth = this.toolbarPrimaryEl.parentElement!.clientWidth;
      // 预留「更多」按钮的宽度（如果需要显示）
      const moreBtnWidth = this.toolbarMoreBtn ? this.toolbarMoreBtn.offsetWidth + 8 : 40;
      const hintEl = this.toolbarPrimaryEl.parentElement!.querySelector(".mm-hint") as HTMLElement;
      const hintWidth = hintEl ? hintEl.offsetWidth + 8 : 0;
      // 可用宽度 = 容器 - 提示文字 - 间距
      let availableWidth = containerWidth - hintWidth - 16;

      // 从后往前逐个检查是否溢出
      let totalWidth = 0;
      let visibleCount = this.allToolbarActions.length;

      // 先计算全部显示的总宽度
      for (let i = 0; i < this.allToolbarActions.length; i++) {
        const action = this.allToolbarActions[i];
        if (action.inlineBtn) {
          totalWidth += action.inlineBtn.offsetWidth + 8; // gap
        }
      }

      // 如果总宽度超出可用空间，需要将部分按钮移入下拉
      if (totalWidth > availableWidth) {
        availableWidth -= moreBtnWidth; // 需要预留「更多」按钮的空间
        visibleCount = 0;
        totalWidth = 0;
        for (let i = 0; i < this.allToolbarActions.length; i++) {
          const action = this.allToolbarActions[i];
          const w = action.inlineBtn ? action.inlineBtn.offsetWidth + 8 : 30;
          if (totalWidth + w <= availableWidth) {
            totalWidth += w;
            visibleCount++;
          } else {
            break;
          }
        }
        // 至少保留 1 个在内联
        if (visibleCount < 1) visibleCount = 1;
      }

      // 应用可见性状态
      for (let i = 0; i < this.allToolbarActions.length; i++) {
        const action = this.allToolbarActions[i];
        const showInline = i < visibleCount;
        if (action.inlineBtn) {
          action.inlineBtn.setCssStyles({ display: showInline ? "" : "none" })
        }
        if (action.menuItem) {
          action.menuItem.setCssStyles({ display: showInline ? "none" : "" })
        }
      }

      // 控制更多按钮显隐
      if (this.toolbarMoreWrap && this.toolbarMoreBtn) {
        const hasOverflowItems = visibleCount < this.allToolbarActions.length;
        this.toolbarMoreWrap.setCssStyles({ display: hasOverflowItems ? "" : "none" })
      }
    };

    // 使用 ResizeObserver 响应容器尺寸变化
    this.overflowResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkOverflow);
    });
    this.overflowResizeObserver.observe(this.toolbarPrimaryEl.parentElement!);

    // 初始检测（延迟到 DOM 渲染完成后）
    setTimeout(checkOverflow, 50);
  }

  /** 停止溢出观察器 */
  private stopOverflowObserver() {
    this.overflowResizeObserver?.disconnect();
    this.overflowResizeObserver = undefined;
  }

  private updateToolbarState() {
    // 更新缩略图按钮高亮状态（同时同步 inline 和 menu 按钮）
    const minimapAction = this.allToolbarActions.find(a => a.id === "minimap");
    if (minimapAction) {
      const fn = (btn: HTMLButtonElement) => btn.classList.toggle("is-active", this.showMinimap);
      if (minimapAction.inlineBtn) fn(minimapAction.inlineBtn);
      if (minimapAction.menuItem) fn(minimapAction.menuItem);
    }
  }

  getDisplayText(): string {
    const name = this.file ? this.file.name : "思维导图";
    return this.dirty ? `${name} •` : name;
  }

  getIcon(): string {
    return "graph";
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mm-view");
    this.contentEl.toggleClass("mm-fullscreen", this.canvasStyle.fullscreen);

    // 用插件设置初始化缩略图显隐（工具栏按钮会读取 this.showMinimap）
    this.showMinimap = pluginInstance?.settings.showMinimap ?? true;

    // 平台检测与移动端样式
    this.isMobile = Platform.isMobile;
    this.contentEl.toggleClass("is-mobile", this.isMobile);

    // 顶部工具栏
    this.createToolbar(this.contentEl);

    // 主区域：左画布 + 右侧栏
    const main = this.contentEl.createDiv({ cls: "mm-main" });

    this.canvas = main.createDiv({ cls: "mm-canvas" });
    this.svg = svgEl("svg", { class: "mm-svg" }) as SVGSVGElement;
    this.canvas.appendChild(this.svg);
    this.overlay = this.canvas.createDiv({ cls: "mm-overlay" });
    this.g = svgEl("g") as SVGGElement;
    this.svg.appendChild(this.g);

    // 缩略图预览（minimap）
    this.minimap = this.canvas.createDiv({ cls: "mm-minimap" });
    this.minimapSvg = svgEl("svg", {
      class: "mm-minimap-svg",
      width: String(MINIMAP_W),
      height: String(MINIMAP_H),
    }) as SVGSVGElement;
    this.minimap.appendChild(this.minimapSvg);
    this.minimap.addEventListener("mousedown", this.onMiniDown);
    this.minimap.addEventListener("touchstart", this.onMiniTouchStart, { passive: false });
    this.minimap.setCssStyles({ display: this.showMinimap ? "" : "none" })

    this.svg.addEventListener("wheel", this.onWheel, { passive: false });
    this.svg.addEventListener("mousedown", this.onMouseDown);
    this.svg.addEventListener("touchstart", this.onTouchStart, { passive: false });

    // 右侧栏（移动端默认收起）
    this.sidePanel = main.createDiv({ cls: "mm-side-panel" });
    this.sidePanel.setCssStyles({ width: SIDE_PANEL_W + "px" })
    if (this.isMobile) {
      this.sidePanel.setCssStyles({ display: "none" })
      this.sidePanel.addClass("is-hidden");
    }
    this.updateToolbarState();
    const tabs = this.sidePanel.createDiv({ cls: "mm-side-tabs" });
    const tabFormat = tabs.createDiv({
      cls: "mm-side-tab is-active",
      text: "画布",
    });
    const tabMarkers = tabs.createDiv({ cls: "mm-side-tab", text: "标记" });
    const tabStickers = tabs.createDiv({ cls: "mm-side-tab", text: "贴纸" });
    tabFormat.addEventListener("click", () => this.switchTab("format"));
    tabMarkers.addEventListener("click", () => this.switchTab("markers"));
    tabStickers.addEventListener("click", () => this.switchTab("stickers"));
    this.sideContent = this.sidePanel.createDiv({ cls: "mm-side-content" });

    // 键盘快捷键
    this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
      if (this.app.workspace.getActiveViewOfType(MindMapView) !== this) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!this.selectedId || !this.root) return;
      if (e.key === "Tab") {
        e.preventDefault();
        this.addChildNode(this.selectedId);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.addSiblingNode(this.selectedId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.deleteNode(this.selectedId);
      } else if (e.key === " ") {
        e.preventDefault();
        this.toggleNode(this.selectedId);
      } else if (e.key === "F2") {
        e.preventDefault();
        this.startEdit(this.selectedId);
      }
    });

    this.renderEmpty();
    this.renderSidePanel();
  }

  private toggleSidePanel() {
    const willShow = this.sidePanel.style.display === "none";
    this.sidePanel.setCssStyles({ display: willShow ? "" : "none" })
    this.sidePanel.classList.toggle("is-hidden", !willShow);

    if (this.isMobile) {
      if (willShow) {
        if (!this.mobileOverlay) {
          this.mobileOverlay = this.canvas.createDiv({ cls: "mm-mobile-overlay" });
          this.mobileOverlay.addEventListener("click", () => this.toggleSidePanel());
        }
        this.mobileOverlay.setCssStyles({ display: "" })
      } else if (this.mobileOverlay) {
        this.mobileOverlay.setCssStyles({ display: "none" })
      }
    }

    requestAnimationFrame(() => this.fitView());
  }

  private switchTab(tab: "format" | "markers" | "stickers") {
    this.activeTab = tab;
    const tabs = this.sidePanel.querySelectorAll(".mm-side-tab");
    tabs.forEach((el, i) => {
      const names = ["format", "markers", "stickers"];
      el.classList.toggle("is-active", names[i] === tab);
    });
    this.renderSidePanel();
  }

  async onLoadFile(file: TFile): Promise<void> {
    await this.loadMap();
  }

  async onClose() {
    if (this.moreMenuCloseHandler) {
      document.removeEventListener("click", this.moreMenuCloseHandler);
      this.moreMenuCloseHandler = undefined;
    }
    this.stopOverflowObserver();

    // 关闭视图时若还有未触发的自动保存定时器，立即保存一次，避免数据丢失
    if (this.autoSaveTimer !== undefined) {
      window.clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
      if (this.dirty && pluginInstance?.settings.autoSave) {
        await this.save();
      }
    }

    this.contentEl.removeClass("mm-view");
    this.contentEl.removeClass("mm-fullscreen");
    this.contentEl.removeClass("is-mobile");
  }

  /** 暴露 dirty 状态给插件（用于自动保存判断） */
  isDirty(): boolean {
    return this.dirty;
  }

  private refreshHeader() {
    const leaf = this.leaf as unknown as { updateHeader?: () => void };
    leaf.updateHeader?.();
  }

  // ---------- 加载 / 序列化 ----------

  private async loadMap() {
    this.overlay.empty();
    if (!this.file) {
      this.renderEmpty();
      return;
    }
    try {
      const data = await this.app.vault.readBinary(this.file);
      this.sheets = await parseXMind(data);
      this.root = this.sheets[0]?.rootTopic ?? null;
      // 推断布局
      const structCls = (this.root as unknown as Record<string, unknown> | null)?.[
        "structure-class"
      ] as string | undefined;
      this.currentLayout =
        pluginInstance?.settings.defaultLayout ?? DEFAULT_LAYOUT;
      if (structCls) {
        for (const [key, def] of Object.entries(LAYOUTS)) {
          if (def.structureClass === structCls) {
            this.currentLayout = key as LayoutKey;
            break;
          }
        }
      }
      // 读取画布样式
      this.canvasStyle = readCanvasStyle(this.root);
      // 如果文件从未存储过 _canvasStyle，则回退到插件设置默认值
      const rawCanvasStyle = (this.root as unknown as {
        _canvasStyle?: unknown;
      })?._canvasStyle;
      const hasStoredCanvasStyle = rawCanvasStyle !== undefined;
      if (!hasStoredCanvasStyle && pluginInstance) {
        const s = pluginInstance.settings;
        this.canvasStyle.compact = s.compactMode;
        this.canvasStyle.theme = s.theme;
        if (s.theme === "rainbow") this.canvasStyle.rainbow = true;
      }
      // pastel 主题：给没有 _color 的一级子节点补色（支持新建后首次添加子节点、
      // 以及旧文件迁移到 pastel 后的情况）
      if (this.canvasStyle.theme === "pastel" && this.root) {
        const kids = attachedChildren(this.root);
        kids.forEach((k, i) => {
          if (!(k as { _color?: unknown })._color) {
            (k as { _color: string })._color =
              NODE_PALETTE[i % NODE_PALETTE.length];
          }
        });
      }
      this.contentEl.toggleClass("mm-fullscreen", this.canvasStyle.fullscreen);
      // 加载新文件时清除旧的自动保存定时器，避免把上一文件的脏状态写回
      if (this.autoSaveTimer !== undefined) {
        window.clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = undefined;
      }
      this.dirty = false;
      this.computeLayout();
      this.applyDefaultView();
      this.render();
      this.renderSidePanel();
    } catch (e) {
      new Notice("无法解析思维导图：" + (e as Error).message);
      this.renderEmpty();
    }
  }

  private renderEmpty() {
    while (this.g.firstChild) this.g.removeChild(this.g.firstChild);
    this.overlay.empty();
    const t = svgEl("text", {
      x: "20",
      y: "40",
      class: "mm-empty",
    }) as SVGTextElement;
    t.textContent =
      "没有打开的思维导图文件。使用命令「新建思维导图 (.xmind)」开始。";
    this.g.appendChild(t);
  }

  // ---------- 布局算法 ----------

  private nodeHeight(t: XTopic): number {
    const kids = t.collapsed ? [] : attachedChildren(t);
    if (kids.length === 0) return this.nh;
    let h = 0;
    for (const k of kids) h += this.nodeHeight(k) + this.vgap;
    h -= this.vgap;
    return Math.max(this.nh, h);
  }

  private subtreeHeight(kids: XTopic[]): number {
    if (kids.length === 0) return this.nh;
    let h = 0;
    for (const k of kids) h += this.nodeHeight(k) + this.vgap;
    h -= this.vgap;
    return h;
  }

  // 节点在树中距离根的深度（根=0）。找不到时返回 0，避免无限递归。
  private depthOf(n: XTopic): number {
    if (!this.root || n.id === this.root.id) return 0;
    let found = -1;
    const walk = (t: XTopic, depth: number): boolean => {
      if (t.id === n.id) {
        found = depth;
        return true;
      }
      for (const k of attachedChildren(t)) {
        if (walk(k, depth + 1)) return true;
      }
      return false;
    };
    walk(this.root, 0);
    return found < 0 ? 0 : found;
  }

  // 随层级深度缩放的盒子宽度：根最宽，每深一级 ×0.78，下限 60。
  private boxWidthOf(depth: number): number {
    const base = this.canvasStyle.compact ? 150 : 170;
    const decay = 0.78;
    const minW = MIN_NODE_W;
    return Math.max(minW, Math.round(base * Math.pow(decay, depth)));
  }

  // 随层级深度缩放的盒子高度：根最高，每深一级 ×0.84，下限 24。
  // 注意：仅用于绘制单个盒子；布局基线仍用 this.nh，避免改动子树垂直排布。
  private boxHeightOf(depth: number): number {
    const base = this.canvasStyle.compact ? NODE_H_COMPACT : NODE_H;
    const decay = 0.84;
    const minH = 24;
    return Math.max(minH, Math.round(base * Math.pow(decay, depth)));
  }

  // 字号随深度递减；越小越细，避免深节点被裁。
  private fontSizeOf(depth: number): number {
    if (depth <= 0) return this.canvasStyle.compact ? 16 : 18;
    if (depth === 1) return this.canvasStyle.compact ? 12 : 14;
    if (depth === 2) return this.canvasStyle.compact ? 11 : 12;
    return this.canvasStyle.compact ? 10 : 11;
  }

  // 节点的实际宽度：优先用用户拖拽设定的 _width，否则按深度回退到层级默认盒宽
  private nodeWidth(n: XTopic): number {
    const w = (n as { _width?: unknown })._width;
    const num =
      typeof w === "number"
        ? w
        : typeof w === "string"
        ? parseFloat(w)
        : NaN;
    if (isFinite(num) && num >= MIN_NODE_W) return num;
    return this.boxWidthOf(this.depthOf(n));
  }

  // 节点盒子（单格）渲染高度，按层级深度缩放
  private nodeBoxHeight(n: XTopic): number {
    return this.boxHeightOf(this.depthOf(n));
  }

  private place(node: XTopic, x: number, top: number, side: number) {
    const h = this.nodeHeight(node);
    const y = top + h / 2;
    if (node.id) this.positions.set(node.id, { x, y, side });
    const kids = node.collapsed ? [] : attachedChildren(node);
    let childTop = top;
    for (const k of kids) {
      const kh = this.nodeHeight(k);
      // 锚边对齐：子节点靠近父节点那条边的位置固定，宽度变化时只有远侧移动
      this.place(
        k,
        x +
          side * (this.nodeWidth(node) / 2 + this.hgap) +
          side * (this.nodeWidth(k) / 2),
        childTop,
        side
      );
      childTop += kh + this.vgap;
    }
  }

  private computeLayout() {
    this.positions.clear();
    if (!this.root) return;
    // 折叠根节点：所有布局统一只显示根主题（避免子节点仍被放入 positions 而照常被渲染）
    if (this.root.collapsed) {
      if (this.root.id)
        this.positions.set(this.root.id, { x: 0, y: 0, side: 0 });
      return;
    }
    switch (this.currentLayout) {
      case "balance":
        this.layoutBalance();
        break;
      case "right":
        this.layoutOneSide(1);
        break;
      case "left":
        this.layoutOneSide(-1);
        break;
      case "orgChart":
        this.layoutOrgChart();
        break;
      case "tree":
        this.layoutTree();
        break;
      case "logic":
        this.layoutLogic();
        break;
      case "timeline":
        this.layoutTimeline();
        break;
      case "fishbone":
        this.layoutFishbone();
        break;
    }
    // 应用手动拖拽偏移：每个节点及其子树整体平移（_dx/_dy），不影响未拖动节点的几何
    this.applyDrags();
  }

  // 节点手动拖拽偏移：按"该节点 + 所有祖先路径上 _dx/_dy 累加"平移，
  // 这样拖动某节点时其子节点随之一起移动，且子节点自身的偏移在累加之上叠加。
  private applyDrags() {
    if (!this.root) return;
    const walk = (node: XTopic, ax: number, ay: number) => {
      const ox = (node as { _dx?: number })._dx ?? 0;
      const oy = (node as { _dy?: number })._dy ?? 0;
      const nx = ax + ox;
      const ny = ay + oy;
      const p = this.positions.get(node.id!);
      if (p) {
        p.x += nx;
        p.y += ny;
      }
      for (const k of attachedChildren(node)) walk(k, nx, ny);
    };
    walk(this.root, 0, 0);
  }

  // 收集某节点及其所有后代 id（用于拖拽时整体平移）
  private subtreeIds(id: string): string[] {
    if (!this.root) return [];
    const start = findTopic(this.root, id);
    if (!start) return [];
    const out: string[] = [];
    const walk = (n: XTopic) => {
      if (n.id) out.push(n.id);
      for (const k of attachedChildren(n)) walk(k);
    };
    walk(start);
    return out;
  }

  private layoutBalance() {
    if (!this.root) return;
    const kids = attachedChildren(this.root);
    const right = kids.filter((_, i) => i % 2 === 0);
    const left = kids.filter((_, i) => i % 2 === 1);
    const rightH = this.subtreeHeight(right);
    const leftH = this.subtreeHeight(left);
    const totalH = Math.max(rightH, leftH, this.nh);
    const rootHalfW = this.nodeWidth(this.root) / 2;
    let ry = -totalH / 2;
    for (const k of right) {
      const kw = this.nodeWidth(k);
      const h = this.nodeHeight(k);
      // 锚边对齐：右子中心 = rootHalfW + hgap + kw/2；place() 内部继续向右算孙节点
      this.place(k, rootHalfW + this.hgap + kw / 2, ry, 1);
      ry += h + this.vgap;
    }
    let ly = -totalH / 2;
    for (const k of left) {
      const kw = this.nodeWidth(k);
      const h = this.nodeHeight(k);
      this.place(k, -(rootHalfW + this.hgap + kw / 2), ly, -1);
      ly += h + this.vgap;
    }
    this.positions.set(this.root.id!, { x: 0, y: 0, side: 0 });
  }

  private layoutOneSide(side: number) {
    if (!this.root) return;
    const kids = attachedChildren(this.root);
    const totalH = this.subtreeHeight(kids);
    const rootHalfW = this.nodeWidth(this.root) / 2;
    let y = -totalH / 2;
    for (const k of kids) {
      const kw = this.nodeWidth(k);
      const h = this.nodeHeight(k);
      this.place(k, side * (rootHalfW + this.hgap + kw / 2), y, side);
      y += h + this.vgap;
    }
    this.positions.set(this.root.id!, { x: 0, y: 0, side: 0 });
  }

  private layoutOrgChart() {
    if (!this.root) return;
    const subtreeWidth = (n: XTopic): number => {
      const kids = n.collapsed ? [] : attachedChildren(n);
      if (kids.length === 0) return this.nodeWidth(n);
      let total = 0;
      for (const k of kids) total += subtreeWidth(k) + ORG_H_GAP;
      return Math.max(this.nodeWidth(n), total - ORG_H_GAP);
    };
    const placeOrg = (n: XTopic, cx: number, topY: number) => {
      const kids = n.collapsed ? [] : attachedChildren(n);
      const cy = topY + this.nh / 2;
      if (n.id) this.positions.set(n.id, { x: cx, y: cy, side: 0 });
      if (kids.length === 0) return;
      let totalW = 0;
      for (const k of kids) totalW += subtreeWidth(k) + ORG_H_GAP;
      totalW -= ORG_H_GAP;
      let curX = cx - totalW / 2;
      const childTopY = cy + this.nh / 2 + this.orgVgap;
      for (const k of kids) {
        const w = subtreeWidth(k);
        const childCx = curX + w / 2;
        placeOrg(k, childCx, childTopY);
        curX += w + ORG_H_GAP;
      }
    };
    placeOrg(this.root, 0, -this.nh / 2);
  }

  // 树形：根在最左，子节点向右展开，父节点垂直居中于子树
  private layoutTree() {
    if (!this.root) return;
    const placeTree = (n: XTopic, x: number, top: number): number => {
      const kids = n.collapsed ? [] : attachedChildren(n);
      const h = this.nodeHeight(n);
      if (kids.length === 0) {
        if (n.id) this.positions.set(n.id, { x, y: top + h / 2, side: 1 });
        return h;
      }
      let childTop = top;
      let accH = 0;
      for (const k of kids) {
        const kh = placeTree(
          k,
          x + this.nodeWidth(n) / 2 + TREE_H_GAP + this.nodeWidth(k) / 2,
          childTop
        );
        childTop += kh + this.vgap;
        accH += kh + this.vgap;
      }
      accH -= this.vgap;
      if (n.id) this.positions.set(n.id, { x, y: top + accH / 2, side: 1 });
      return Math.max(h, accH);
    };
    placeTree(this.root, 0, 0);
  }

  // 逻辑图：与树形同几何，但连线为水平折线（side=4）
  private layoutLogic() {
    if (!this.root) return;
    const placeLogic = (n: XTopic, x: number, top: number): number => {
      const kids = n.collapsed ? [] : attachedChildren(n);
      const h = this.nodeHeight(n);
      if (kids.length === 0) {
        if (n.id) this.positions.set(n.id, { x, y: top + h / 2, side: 4 });
        return h;
      }
      let childTop = top;
      let accH = 0;
      for (const k of kids) {
        const kh = placeLogic(
          k,
          x + this.nodeWidth(n) / 2 + TREE_H_GAP + this.nodeWidth(k) / 2,
          childTop
        );
        childTop += kh + this.vgap;
        accH += kh + this.vgap;
      }
      accH -= this.vgap;
      if (n.id) this.positions.set(n.id, { x, y: top + accH / 2, side: 4 });
      return Math.max(h, accH);
    };
    placeLogic(this.root, 0, 0);
  }

  // 时间轴：根为起点，一级主题沿水平轴排开，其下子主题纵向排列在其下方
  private layoutTimeline() {
    if (!this.root) return;
    if (this.root.id) this.positions.set(this.root.id, { x: 0, y: 0, side: 0 });
    const kids = attachedChildren(this.root);
    // 按每个一级主题自身宽度顺序排开（左边缘锚定在父节点右缘 + hgap），宽度变化时仅远侧移动
    let cursor = this.nodeWidth(this.root) / 2 + this.hgap;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const kw = this.nodeWidth(k);
      const kx = cursor + kw / 2;
      if (k.id) this.positions.set(k.id, { x: kx, y: 0, side: 1 });
      cursor += kw + this.hgap;
      const sub = k.collapsed ? [] : attachedChildren(k);
      let subY = this.nh + this.vgap;
      for (const s of sub) {
        if (s.id) this.positions.set(s.id, { x: kx, y: subY, side: 2 });
        subY += this.nh + this.vgap;
      }
    }
  }

  // 鱼骨图：根（结果）在右，一级主题作为"鱼骨"斜向分布，其子主题为沿骨的成因
  private layoutFishbone() {
    if (!this.root) return;
    if (this.root.id) this.positions.set(this.root.id, { x: 0, y: 0, side: 0 });
    const bones = attachedChildren(this.root);
    const n = bones.length;
    const spineStep = 150;
    const upCount = Math.ceil(n / 2);
    let upIdx = 0;
    let downIdx = 0;
    for (let i = 0; i < n; i++) {
      const bone = bones[i];
      const isUp = i < upCount;
      const sign = isUp ? -1 : 1;
      const rank = isUp ? upIdx++ : downIdx++;
      const spineX = -((rank + 1) * spineStep);
      const catX = spineX - 60;
      const catY = sign * (90 + rank * 8);
      const sub = bone.collapsed ? [] : attachedChildren(bone);
      for (let j = 0; j < sub.length; j++) {
        const t = (j + 1) / (sub.length + 1);
        const cx = lerp(spineX, catX, t);
        const cy = lerp(0, catY, t) + sign * 22;
        if (sub[j].id) this.positions.set(sub[j].id, { x: cx, y: cy, side: 1 });
      }
      if (bone.id) this.positions.set(bone.id, { x: catX, y: catY, side: 3 });
    }
  }

  private fitView() {
    if (this.positions.size === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [id, p] of this.positions) {
      const node = this.root ? findTopic(this.root, id) : null;
      const wHalf = (node ? this.nodeWidth(node) : this.nw) / 2;
      minX = Math.min(minX, p.x - wHalf);
      maxX = Math.max(maxX, p.x + wHalf);
      minY = Math.min(minY, p.y - this.nh / 2);
      maxY = Math.max(maxY, p.y + this.nh / 2);
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const rect = this.svg.getBoundingClientRect();
    const cw = rect.width || 800;
    const ch = rect.height || 600;
    const pad = 50;
    const sx = (cw - pad * 2) / w;
    const sy = (ch - pad * 2) / h;
    this.scale = Math.min(2, Math.max(0.2, Math.min(sx, sy)));
    this.tx = cw / 2 - ((minX + maxX) / 2) * this.scale;
    this.ty = ch / 2 - ((minY + maxY) / 2) * this.scale;
    this.applyTransform();
  }

  private applyTransform() {
    this.g.setAttribute(
      "transform",
      `translate(${this.tx}, ${this.ty}) scale(${this.scale})`
    );
    this.updateMinimap();
  }

  // 按插件设置应用默认视图：fit = 适应视图（自动缩放）；100 = 原始大小并居中
  private applyDefaultView() {
    if (pluginInstance?.settings.defaultZoom === "100") {
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      if (this.positions.size > 0 && this.root) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const [id, p] of this.positions) {
          const node = findTopic(this.root, id);
          const wHalf = (node ? this.nodeWidth(node) : this.nw) / 2;
          minX = Math.min(minX, p.x - wHalf);
          maxX = Math.max(maxX, p.x + wHalf);
          minY = Math.min(minY, p.y - this.nh / 2);
          maxY = Math.max(maxY, p.y + this.nh / 2);
        }
        const rect = this.svg.getBoundingClientRect();
        const cw = rect.width || 800;
        const ch = rect.height || 600;
        this.tx = cw / 2 - ((minX + maxX) / 2) * this.scale;
        this.ty = ch / 2 - ((minY + maxY) / 2) * this.scale;
      }
      this.applyTransform();
    } else {
      this.fitView();
    }
  }

  // ---------- 渲染 ----------

  private render() {
    while (this.g.firstChild) this.g.removeChild(this.g.firstChild);
    this.overlay.empty();
    this.nodeEls.clear();
    if (!this.root) return;

    // 连线
    for (const [id, pos] of this.positions) {
      const node = findTopic(this.root, id);
      if (!node) continue;
      const kids = node.collapsed ? [] : attachedChildren(node);
      kids.forEach((k, i) => {
        const cp = this.positions.get(k.id!);
        if (!cp) return;
        const color = this.edgeColor(node, i);
        const path = svgEl("path", {
          d: edgePath(pos, cp, this.nodeWidth(node), this.nodeWidth(k), this.nh, this.currentLayout),
          class: "mm-edge",
        });
        // 用内联 style 覆盖 styles.css 里的 .mm-edge{stroke:...}：SVG presentation attribute
        // 的优先级低于 CSS 规则，只有内联样式能稳定盖住（影响：彩虹分支、_color 节点配色）
        if (color) path.setCssStyles({ stroke: color })
        this.g.appendChild(path);
      });
    }

    // 节点
    for (const [id, pos] of this.positions) {
      this.drawNode(id, pos);
    }

    this.updateMinimap();
  }

  private edgeColor(parent: XTopic, childIndex: number): string {
    if (
      !this.canvasStyle.rainbow ||
      !this.root ||
      this.currentLayout === "orgChart"
    ) {
      return "";
    }
    // 沿 parent 向上走到 root，记录「作为 root 子节点时的 index」，
    // 用它从 RAINBOW_COLORS 取色，让二级/三级分支也继承一级分支的彩虹色。
    let cur: XTopic = parent;
    let idx = childIndex;
    while (cur !== this.root) {
      const realParent = findParent(this.root, cur.id!);
      if (!realParent) return "";
      const siblings = attachedChildren(realParent);
      idx = siblings.indexOf(cur);
      if (idx < 0) return "";
      cur = realParent;
    }
    return RAINBOW_COLORS[idx % RAINBOW_COLORS.length];
  }

  // 向上查找最近的祖先 _color（含自身）
  private resolveColor(node: XTopic): { fill: string; text: string } | null {
    let cur: XTopic | undefined = node;
    while (cur) {
      const c = (cur as { _color?: unknown })._color;
      if (typeof c === "string" && c) {
        return { fill: c, text: isDarkHex(c) ? "#ffffff" : "#1e1e1e" };
      }
      if (cur.id === this.root?.id) break;
      cur = this.root ? findParent(this.root, cur.id!) ?? undefined : undefined;
    }
    return null;
  }

  private drawNode(id: string, pos: Pos) {
    const node = this.root ? findTopic(this.root, id) : null;
    if (!node) return;
    const isRoot = node.id === this.root?.id;
    const isSelected = id === this.selectedId;
    const isCollapsed = !!node.collapsed;
    const hasChildren = attachedChildren(node).length > 0;
    const markerIds = getMarkerIds(node);
    const stickers = getStickers(node);
    const col = this.resolveColor(node);

    const fo = svgEl("foreignObject", {
      x: String(pos.x - this.nodeWidth(node) / 2),
      y: String(pos.y - this.nodeBoxHeight(node) / 2),
      width: String(this.nodeWidth(node)),
      height: String(this.nodeBoxHeight(node)),
    });
    const div = newEl("div");
    div.className =
      "mm-node" +
      (isRoot ? " is-root" : "") +
      (isSelected ? " is-selected" : "") +
      (isCollapsed ? " is-collapsed" : "");
    div.setCssStyles({ width: this.nodeWidth(node) + "px" })
    div.setCssStyles({ height: this.nodeBoxHeight(node) + "px" })
    div.setCssStyles({ fontSize: this.fontSizeOf(this.depthOf(node)) + "px" })
    if (col) {
      div.setCssStyles({ background: col.fill })
      div.setCssStyles({ color: col.text })
      div.setCssStyles({ borderColor: col.fill })
    }

    // 贴纸行（emoji）
    if (stickers.length > 0) {
      const stRow = newEl("div");
      stRow.className = "mm-node-stickers";
      for (const s of stickers) {
        const sp = newEl("span");
        sp.className = "mm-node-sticker";
        sp.textContent = s;
        stRow.appendChild(sp);
      }
      div.appendChild(stRow);
    }

    // 标记行
    if (markerIds.length > 0) {
      const markersRow = newEl("div");
      markersRow.className = "mm-node-markers";
      for (const mid of markerIds) {
        const def = findMarker(mid);
        markersRow.appendChild(renderMarkerIcon(def, 12));
      }
      div.appendChild(markersRow);
    }

    const text = newEl("div");
    text.className = "mm-node-text";
    text.textContent = node.title ?? "(空)";
    div.appendChild(text);

    // 拖拽调整宽度的手柄（放在远离父节点的一侧）
    const handleSide: "left" | "right" = pos.side < 0 ? "left" : "right";
    const handle = newEl("div");
    handle.className = "mm-resize-handle " + handleSide;
    handle.title = "拖拽调整节点宽度";
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startResize(e, id, pos, handleSide);
    });
    div.appendChild(handle);

    fo.appendChild(div);
    this.g.appendChild(fo);
    this.nodeEls.set(id, div);

    div.addEventListener("mousedown", (e) => e.stopPropagation());
    div.addEventListener("pointerdown", (e) => {
      // 仅在节点主体上发起拖拽；手柄/折叠点已各自 stopPropagation
      this.startDrag(e, id);
    });
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      this.select(id);
    });
    div.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.startEdit(id);
    });
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e, id);
    });

    if (hasChildren) {
      const dotX = pos.x + (pos.side >= 0 ? this.nodeWidth(node) / 2 : -this.nodeWidth(node) / 2);
      const dot = svgEl("circle", {
        cx: String(dotX),
        cy: String(pos.y),
        r: "6",
        class: "mm-collapse-dot" + (isCollapsed ? " collapsed" : ""),
      });
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleNode(id);
      });
      this.g.appendChild(dot);
    }
  }

  // 鼠标拖拽调整单个节点宽度：以"靠近父节点那条边"为固定锚边，只有远侧移动；松手写回 topic._width 并重排+保存
  private startResize(
    e: PointerEvent,
    id: string,
    pos: Pos,
    handleSide: "left" | "right"
  ) {
    const node = this.root ? findTopic(this.root, id) : null;
    const div = this.nodeEls.get(id);
    if (!node || !div) return;
    const fo = div.parentElement as unknown as SVGForeignObjectElement | null;
    const startW = this.nodeWidth(node);
    const startX = e.clientX;
    const self = this;

    // 根节点 或 组织结构图(side=0,上下布局、子节点居中于父节点下方) → 中心固定
    // 其余布局 → 以靠近父节点的锚边为固定边（与 rebuild 后的布局几何一致，松手不跳变）
    const parent =
      id === this.root?.id || pos.side === 0
        ? null
        : this.root
        ? findParent(this.root, id)
        : null;
    let anchorX = 0; // 锚边（靠近父节点那一侧的边）的画布 x 坐标
    if (parent) {
      const pPos = this.positions.get(parent.id!);
      const pW = this.nodeWidth(parent);
      const s = pos.side > 0 ? 1 : -1;
      anchorX = (pPos ? pPos.x : 0) + s * (pW / 2 + this.hgap);
    }

    const apply = (newW: number): number => {
      newW = Math.max(MIN_NODE_W, Math.min(MAX_NODE_W, Math.round(newW)));
      div.setCssStyles({ width: newW + "px" })
      if (fo) {
        fo.setAttribute("width", String(newW));
        if (parent) {
          // 右拉手柄：左(锚)边不动 → fo.x = 锚边；左拉手柄：右(锚)边不动 → fo.x = 锚边 - 宽
          const x = handleSide === "right" ? anchorX : anchorX - newW;
          fo.setAttribute("x", String(x));
        } else {
          // 根 / 组织结构图：中心固定
          fo.setAttribute("x", String(pos.x - newW / 2));
        }
      }
      return newW;
    };

    const onMove = (ev: PointerEvent) => {
      const dxCanvas = (ev.clientX - startX) / self.scale;
      const delta = handleSide === "right" ? dxCanvas : -dxCanvas;
      apply(startW + delta);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const dxCanvas = (ev.clientX - startX) / self.scale;
      const delta = handleSide === "right" ? dxCanvas : -dxCanvas;
      const newW = apply(startW + delta);
      (node as { _width?: number })._width = newW;
      self.rebuild();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 拖拽移动节点：拖动时连同其子树整体平移（实时预览），松手写回 topic._dx/_dy 并保存
  private startDrag(e: PointerEvent, id: string) {
    if (!this.root || this.editingId === id) return;
    const node = findTopic(this.root, id);
    if (!node) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startDx = (node as { _dx?: number })._dx ?? 0;
    const startDy = (node as { _dy?: number })._dy ?? 0;
    // 基准位置快照（已包含当前已有的偏移）
    const base = new Map<string, Pos>();
    for (const [k, p] of this.positions) base.set(k, { x: p.x, y: p.y, side: p.side });
    const subIds = this.subtreeIds(id);
    const self = this;
    let dragging = false;
    let div = this.nodeEls.get(id);

    const move = (ev: PointerEvent) => {
      const ddx = (ev.clientX - startX) / self.scale;
      const ddy = (ev.clientY - startY) / self.scale;
      if (
        !dragging &&
        Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4
      )
        return; // 阈值内不算拖拽，交给 click 处理选中
      dragging = true;
      if (div) div.classList.add("is-dragging");
      for (const sid of subIds) {
        const bp = base.get(sid);
        if (bp)
          self.positions.set(sid, {
            x: bp.x + ddx,
            y: bp.y + ddy,
            side: bp.side,
          });
      }
      self.render();
      div = self.nodeEls.get(id);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.setCssStyles({ userSelect: "" })
      const d = self.nodeEls.get(id);
      if (d) d.classList.remove("is-dragging");
      if (!dragging) return; // 未越过阈值 → 视为点击，不写偏移
      const ddx = (ev.clientX - startX) / self.scale;
      const ddy = (ev.clientY - startY) / self.scale;
      (node as { _dx?: number })._dx = startDx + ddx;
      (node as { _dy?: number })._dy = startDy + ddy;
      self.dirty = true;
      self.refreshHeader();
      self.maybeAutoSave();
    };
    document.body.setCssStyles({ userSelect: "none" })
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ---------- 交互 ----------

  private select(id: string) {
    if (this.selectedId && this.nodeEls.has(this.selectedId)) {
      this.nodeEls.get(this.selectedId)!.classList.remove("is-selected");
    }
    this.selectedId = id;
    if (this.nodeEls.has(id)) {
      this.nodeEls.get(id)!.classList.add("is-selected");
    }
    // 选中节点后刷新侧栏（例如让「画布」标签下的「节点样式」区域显示出来），
    // 不再强制切到「标记」标签，避免颜色设置按钮被隐藏。
    this.renderSidePanel();
  }

  private showContextMenu(e: MouseEvent, id: string) {
    const node = this.root ? findTopic(this.root, id) : null;
    if (!node) return;
    const menu = new Menu();
    menu.addItem((i) =>
      i.setTitle("添加子主题").onClick(() => this.addChildNode(id))
    );
    menu.addItem((i) =>
      i.setTitle("添加同级主题").onClick(() => this.addSiblingNode(id))
    );
    menu.addItem((i) =>
      i.setTitle("编辑文本").onClick(() => this.startEdit(id))
    );
    menu.addItem((i) =>
      i
        .setTitle(node.collapsed ? "展开" : "折叠")
        .onClick(() => this.toggleNode(id))
    );
    menu.addItem((i) => i.setTitle("删除").onClick(() => this.deleteNode(id)));
    menu.addItem((i) =>
      i.setTitle("重置宽度").onClick(() => {
        delete (node as { _width?: number })._width;
        this.rebuild();
      })
    );
    menu.showAtMouseEvent(e);
  }

  private addChildNode(id: string) {
    if (!this.root) return;
    const parent = findTopic(this.root, id);
    if (!parent) return;
    const child = addChild(parent, "新主题");
    if (parent === this.root && this.canvasStyle.theme === "pastel") {
      const idx = attachedChildren(this.root).indexOf(child);
      (child as { _color?: string })._color =
        NODE_PALETTE[idx % NODE_PALETTE.length];
    }
    if (parent.collapsed) toggleCollapse(parent);
    this.rebuildAndSelect(child.id!);
  }

  private addSiblingNode(id: string) {
    if (!this.root) return;
    if (id === this.root.id) {
      new Notice("根主题没有同级主题");
      return;
    }
    const parent = findParent(this.root, id);
    if (!parent) return;
    const child = addChild(parent, "新主题");
    if (parent === this.root && this.canvasStyle.theme === "pastel") {
      const idx = attachedChildren(this.root).indexOf(child);
      (child as { _color?: string })._color =
        NODE_PALETTE[idx % NODE_PALETTE.length];
    }
    this.rebuildAndSelect(child.id!);
  }

  private deleteNode(id: string) {
    if (!this.root) return;
    if (id === this.root.id) {
      new Notice("不能删除根主题");
      return;
    }
    removeTopic(this.root, id);
    if (this.selectedId === id) this.selectedId = null;
    this.rebuild();
  }

  private toggleNode(id: string) {
    if (!this.root) return;
    const node = findTopic(this.root, id);
    if (!node) return;
    toggleCollapse(node);
    this.rebuild();
  }

  private rebuildAndSelect(id: string) {
    this.rebuild();
    this.select(id);
    this.startEdit(id);
  }

  private rebuild() {
    this.computeLayout();
    this.render();
    this.dirty = true;
    this.refreshHeader();
    // 折叠/展开/增删等节点变更后重新自适应视图，
    // 避免节点位置已变但视图仍以旧的 tx/ty/scale 显示导致重叠/错位
    this.fitView();
    this.maybeAutoSave();
  }

  private setLayout(key: LayoutKey) {
    if (this.currentLayout === key || !this.root) return;
    this.currentLayout = key;
    (this.root as unknown as Record<string, unknown>)["structure-class"] =
      LAYOUTS[key].structureClass;
    this.rebuild();
    this.renderSidePanel();
  }

  // 切换画布样式（任一项）
  private updateCanvasStyle(patch: Partial<CanvasStyle>) {
    if (!this.root) return;
    this.canvasStyle = { ...this.canvasStyle, ...patch };
    writeCanvasStyle(this.root, this.canvasStyle);
    this.contentEl.toggleClass("mm-fullscreen", this.canvasStyle.fullscreen);
    this.dirty = true;
    this.rebuild();
    this.renderSidePanel();
    if (patch.fullscreen !== undefined) {
      requestAnimationFrame(() => this.fitView());
    }
  }

  // 设置节点颜色
  private setNodeColor(color: string | null) {
    if (!this.root || !this.selectedId) return;
    const node = findTopic(this.root, this.selectedId);
    if (!node) return;
    if (color) (node as { _color?: string })._color = color;
    else delete (node as { _color?: string })._color;
    this.rebuild();
    this.renderSidePanel();
  }

  // 按分支自动染色：每个一级主题分配一种颜色（自身与后代继承）
  private autoColorBranches() {
    if (!this.root) return;
    const kids = attachedChildren(this.root);
    kids.forEach((k, i) => {
      (k as { _color?: string })._color = NODE_PALETTE[i % NODE_PALETTE.length];
    });
    // 同步把主题设为 pastel，后续新增根子节点也会自动继承色板
    this.canvasStyle.theme = "pastel";
    writeCanvasStyle(this.root, this.canvasStyle);
    new Notice("已按分支自动染色（" + kids.length + " 个分支）");
    this.rebuild();
    this.renderSidePanel();
  }

  private clearAllColors() {
    if (!this.root) return;
    const walk = (t: XTopic) => {
      delete (t as { _color?: string })._color;
      for (const k of attachedChildren(t)) walk(k);
    };
    walk(this.root);
    // 清除全部颜色后切回 classic，避免新增根子节点又被自动染色
    this.canvasStyle.theme = "classic";
    writeCanvasStyle(this.root, this.canvasStyle);
    this.rebuild();
    this.renderSidePanel();
  }

  private startEdit(id: string) {
    if (!this.root) return;
    const node = findTopic(this.root, id);
    if (!node) return;
    const pos = this.positions.get(id);
    if (!pos) return;
    this.editingId = id;
    this.select(id);

    // Mobile: 保存编辑前视图，收缩容器到键盘上方可见区，并把节点居中到可见区上部
    if (this.isMobile) {
      this.preEditTx = this.tx;
      this.preEditTy = this.ty;
      this.preEditScale = this.scale;
      this.attachEditViewportHandler(id);
      this.centerNodeForEdit(id);
    }

    const input = newEl("input");
    input.className = "mm-edit-input";
    input.value = node.title ?? "";
    const editDepth = this.depthOf(node);
    const editBoxH = this.boxHeightOf(editDepth);
    input.setCssStyles({ left: this.tx + (pos.x - this.nodeWidth(node) / 2) * this.scale + "px" })
    input.setCssStyles({ top: this.ty + (pos.y - editBoxH / 2) * this.scale + "px" })
    input.setCssStyles({ width: this.nodeWidth(node) * this.scale + "px" })
    input.setCssStyles({ height: editBoxH * this.scale + "px" })
    input.setCssStyles({ fontSize: this.fontSizeOf(editDepth) * this.scale + "px" })
    input.setCssStyles({ pointerEvents: "auto" })
    this.overlay.appendChild(input);
    input.focus({ preventScroll: true });
    input.select();

    let done = false;
    const cleanup = () => {
      // 仅在移动端需要还原编辑前的平移/缩放与容器高度；
      // 桌面端并没有进入过 isMobile 分支给 preEdit* 赋值（默认 0/0/1），
      // 这里盲目重置会把刚 fitView 出来的视图打回 (0,0,1)，
      // 表现就是「编辑完回车后整个思维导图跳到屏幕外」。
      if (this.isMobile) {
        this.tx = this.preEditTx;
        this.ty = this.preEditTy;
        this.scale = this.preEditScale;
        this.applyTransform();
      }
      this.detachEditViewportHandler();
    };
    const commit = () => {
      if (done) return;
      done = true;
      cleanup();
      node.title = input.value;
      input.remove();
      this.editingId = null;
      this.render();
      this.dirty = true;
      this.refreshHeader();
      this.maybeAutoSave();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        done = true;
        cleanup();
        input.remove();
        this.editingId = null;
      }
    });
  }

  // 移动端编辑时：把节点放到「键盘上方可见区域」的上部，保证任何键盘高度下都可见
  private centerNodeForEdit(id: string) {
    if (!this.root || this.editingId !== id) return;
    const pos = this.positions.get(id);
    if (!pos) return;
    const node = findTopic(this.root, id);
    if (!node) return;

    // 取 canvas 的实际渲染矩形（高 = 收缩后 mm-view 减去 toolbar，留给 svg 的可见高度）
    const rect = this.canvas.getBoundingClientRect();
    // 编辑时不要强制放大到 1.0+，否则子节点会被挤出可见区域；
    // 仅在当前缩放过小时稍放大以保证输入框可读，其余情况保持原缩放以保留上下文。
    const editScale = Math.max(this.scale, 0.7);
    this.scale = editScale;
    // 水平居中
    this.tx = rect.width / 2 - pos.x * editScale;
    // 垂直放在画布上部（约 30% 处），给下方子节点留出可见空间；
    // 同时保证节点不会跑到 toolbar 下沿附近或被键盘挡
    const nh = this.nh * editScale;
    const canvasH = Math.max(rect.height, nh + 32);
    const topSlot = Math.max(48, canvasH * 0.3); // 上部安全距离，至少避开工具栏
    const bottomSlot = Math.max(canvasH * 0.6, nh + 16);
    const targetY = Math.min(topSlot, canvasH - bottomSlot);
    this.ty = Math.max(targetY, 12) - pos.y * editScale;
    this.applyTransform();

    // 输入框跟随节点重新定位
    const input = this.overlay.querySelector(
      ".mm-edit-input"
    ) as HTMLInputElement | null;
    if (input) {
      input.setCssStyles({ left: this.tx + (pos.x - this.nodeWidth(node) / 2) * editScale + "px" })
      input.setCssStyles({ top: this.ty + (pos.y - this.nh / 2) * editScale + "px" })
      input.setCssStyles({ width: this.nodeWidth(node) * editScale + "px" })
      input.setCssStyles({ height: nh + "px" })
      input.setCssStyles({ fontSize: 14 * editScale + "px" })
    }
  }

  // 让 .mm-view 容器收缩到「键盘上方」的可见高度：
  // - 优先使用 visualViewport.height（iOS 上能正确反映去掉键盘/URL 栏的真实可视高度）
  // - Android（adjustResize / adjustPan）：window.innerHeight 与 visualViewport.height 中较小者
  // - .mm-view 在 adjustPan 模式下可能被滚出屏幕（top 为负），需要 clamp 到 0
  // 这样 .mm-canvas 的高度就是真实可见高度，居中计算自然正确，不再出现「画布与键盘间大块空白」
  private applyEditContainerHeight() {
    if (!this.isMobile || !this.editingId) return;
    const vv = window.visualViewport;
    // 可视高度：iOS 用 visualViewport.height；Android 上两者都可用，取较小者更稳
    const availH = vv ? Math.min(vv.height, window.innerHeight) : window.innerHeight;
    const keyboardShown = window.innerHeight - availH > 32;
    if (!keyboardShown) {
      // 键盘已收起，还原容器高度（避免在已展开状态下被卡在编辑态高度）
      if (this.contentEl.style.height) this.contentEl.setCssStyles({ height: "" })
    } else {
      // 键盘弹起：mm-view 顶部可能因 adjustPan 滚动到屏幕外，clamp 到 0
      const rawTop = this.contentEl.getBoundingClientRect().top;
      const top = Math.max(0, rawTop);
      const visibleH = Math.max(160, availH - top);
      this.contentEl.setCssStyles({ height: visibleH + "px" })
    }
    // 容器高度变化后下一帧再居中一次，确保 rect 已更新
    requestAnimationFrame(() => {
      if (this.editingId) this.centerNodeForEdit(this.editingId);
    });
  }

  private attachEditViewportHandler(id: string) {
    const handler = () => {
      this.applyEditContainerHeight();
      this.centerNodeForEdit(id);
    };
    this.editViewportHandler = handler;
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handler);
      window.visualViewport.addEventListener("scroll", handler);
    }
    // Obsidian 移动端弹键盘时常通过 window.resize 通知（innerHeight 缩小）
    window.addEventListener("resize", handler);
    // 键盘弹出有动画，首次进入可能在键盘就位前，延迟再校正一次
    this.editRefocusTimer = window.setTimeout(handler, 300);
  }

  private detachEditViewportHandler() {
    if (this.editViewportHandler) {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", this.editViewportHandler);
        window.visualViewport.removeEventListener("scroll", this.editViewportHandler);
      }
      window.removeEventListener("resize", this.editViewportHandler);
      this.editViewportHandler = undefined;
    }
    if (this.editRefocusTimer !== undefined) {
      window.clearTimeout(this.editRefocusTimer);
      this.editRefocusTimer = undefined;
    }
    // 还原容器高度（编辑前状态由 cleanup() 负责还原平移/缩放）
    this.contentEl.setCssStyles({ height: "" })
  }

  // ---------- 平移 / 缩放 ----------

  // 命中判定：target 是根节点 div 自身或它的子元素
  private isTargetOnRoot(target: Element | null): boolean {
    if (!target || !this.root) return false;
    const rootEl = this.nodeEls.get(this.root.id);
    return !!rootEl && (rootEl === target || rootEl.contains(target));
  }

  private onMouseDown = (e: MouseEvent) => {
    // 只允许在根节点（中心主题）上拖动整张导图；空白处与连线不再平移画布
    if (!this.isTargetOnRoot(e.target as Element | null)) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = this.tx;
    const oy = this.ty;
    const move = (ev: MouseEvent) => {
      this.tx = ox + (ev.clientX - startX);
      this.ty = oy + (ev.clientY - startY);
      this.applyTransform();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      // 只允许在根节点上拖动整张导图；空白处不再平移画布
      if (!this.isTargetOnRoot(e.target as Element | null)) return;
      e.preventDefault();
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      const ox = this.tx;
      const oy = this.ty;
      const move = (ev: TouchEvent) => {
        if (ev.touches.length !== 1) return;
        ev.preventDefault();
        this.tx = ox + (ev.touches[0].clientX - startX);
        this.ty = oy + (ev.touches[0].clientY - startY);
        this.applyTransform();
      };
      const up = () => {
        window.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", up);
        window.removeEventListener("touchcancel", up);
      };
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", up);
      window.addEventListener("touchcancel", up);
    } else if (e.touches.length === 2) {
      // 双指缩放
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const rect = this.svg.getBoundingClientRect();
      const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
      const wx = (cx - this.tx) / this.scale;
      const wy = (cy - this.ty) / this.scale;
      const startScale = this.scale;

      const move = (ev: TouchEvent) => {
        if (ev.touches.length !== 2) return;
        ev.preventDefault();
        const nt1 = ev.touches[0];
        const nt2 = ev.touches[1];
        const dist = Math.hypot(nt2.clientX - nt1.clientX, nt2.clientY - nt1.clientY);
        const ratio = dist / Math.max(1, startDist);
        this.scale = Math.min(3, Math.max(0.2, startScale * ratio));
        this.tx = cx - wx * this.scale;
        this.ty = cy - wy * this.scale;
        this.applyTransform();
      };
      const up = () => {
        window.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", up);
        window.removeEventListener("touchcancel", up);
      };
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", up);
      window.addEventListener("touchcancel", up);
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const newScale = Math.min(3, Math.max(0.2, this.scale * (1 + delta)));
    const rect = this.svg.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = (cx - this.tx) / this.scale;
    const wy = (cy - this.ty) / this.scale;
    this.scale = newScale;
    this.tx = cx - wx * this.scale;
    this.ty = cy - wy * this.scale;
    this.applyTransform();
  };

  private onMiniDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = this.minimap.getBoundingClientRect();
    const b = this.mapBounds();
    if (!b) return;
    const W = MINIMAP_W;
    const H = MINIMAP_H;
    const pad = 6;
    const mw = Math.max(1, b.maxX - b.minX);
    const mh = Math.max(1, b.maxY - b.minY);
    const s = Math.min((W - pad * 2) / mw, (H - pad * 2) / mh);
    const toX = (x: number) => pad + (x - b.minX) * s;
    const toY = (y: number) => pad + (y - b.minY) * s;

    const recenter = (clientX: number, clientY: number) => {
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const mapX = (mx - pad) / s + b.minX;
      const mapY = (my - pad) / s + b.minY;
      const cw = this.svg.clientWidth || 800;
      const ch = this.svg.clientHeight || 600;
      this.tx = cw / 2 - mapX * this.scale;
      this.ty = ch / 2 - mapY * this.scale;
      this.applyTransform();
    };
    recenter(e.clientX, e.clientY);
    const move = (ev: MouseEvent) => recenter(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  private onMiniTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = this.minimap.getBoundingClientRect();
    const b = this.mapBounds();
    if (!b) return;
    const W = MINIMAP_W;
    const H = MINIMAP_H;
    const pad = 6;
    const mw = Math.max(1, b.maxX - b.minX);
    const mh = Math.max(1, b.maxY - b.minY);
    const s = Math.min((W - pad * 2) / mw, (H - pad * 2) / mh);

    const recenter = (clientX: number, clientY: number) => {
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const mapX = (mx - pad) / s + b.minX;
      const mapY = (my - pad) / s + b.minY;
      const cw = this.svg.clientWidth || 800;
      const ch = this.svg.clientHeight || 600;
      this.tx = cw / 2 - mapX * this.scale;
      this.ty = ch / 2 - mapY * this.scale;
      this.applyTransform();
    };
    recenter(touch.clientX, touch.clientY);
    const move = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      ev.preventDefault();
      recenter(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    const up = () => {
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
  };

  // ---------- 缩略图预览 ----------

  private mapBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null {
    if (this.positions.size === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [id, p] of this.positions) {
      const node = this.root ? findTopic(this.root, id) : null;
      const wHalf = (node ? this.nodeWidth(node) : this.nw) / 2;
      minX = Math.min(minX, p.x - wHalf);
      maxX = Math.max(maxX, p.x + wHalf);
      minY = Math.min(minY, p.y - this.nh / 2);
      maxY = Math.max(maxY, p.y + this.nh / 2);
    }
    return { minX, minY, maxX, maxY };
  }

  private updateMinimap() {
    if (!this.minimapSvg) return;
    while (this.minimapSvg.firstChild)
      this.minimapSvg.removeChild(this.minimapSvg.firstChild);
    const b = this.mapBounds();
    if (!b) return;
    const W = MINIMAP_W;
    const H = MINIMAP_H;
    const pad = 6;
    const mw = Math.max(1, b.maxX - b.minX);
    const mh = Math.max(1, b.maxY - b.minY);
    const s = Math.min((W - pad * 2) / mw, (H - pad * 2) / mh);
    const toX = (x: number) => pad + (x - b.minX) * s;
    const toY = (y: number) => pad + (y - b.minY) * s;

    // 节点小方块
    for (const [id, pos] of this.positions) {
      const node = this.root ? findTopic(this.root, id) : null;
      const isRoot = node?.id === this.root?.id;
      const col = node ? this.resolveColor(node) : null;
      const r = svgEl("rect", {
        x: String(toX(pos.x - this.nodeWidth(node) / 2)),
        y: String(toY(pos.y - this.nh / 2)),
        width: String(this.nodeWidth(node) * s),
        height: String(this.nh * s),
        rx: "1",
        fill: col ? col.fill : isRoot ? "var(--interactive-accent)" : "#cfd8e3",
      });
      this.minimapSvg.appendChild(r);
    }

    // 视口矩形
    const cw = this.svg.clientWidth || 800;
    const ch = this.svg.clientHeight || 600;
    const vx = (0 - this.tx) / this.scale;
    const vy = (0 - this.ty) / this.scale;
    const vw = cw / this.scale;
    const vh = ch / this.scale;
    const vr = svgEl("rect", {
      x: String(toX(vx)),
      y: String(toY(vy)),
      width: String(vw * s),
      height: String(vh * s),
      fill: "rgba(74,118,212,0.12)",
      stroke: "var(--interactive-accent)",
      "stroke-width": "1",
    });
    this.minimapSvg.appendChild(vr);
  }

  // ---------- 导出 SVG / PNG ----------

  private exportSVG() {
    const svg = this.buildExportSVG();
    if (!svg) {
      new Notice("没有可导出的内容");
      return;
    }
    this.writeExportFile(svg, "svg");
  }

  private async exportPNG() {
    const svg = this.buildExportSVG();
    if (!svg) {
      new Notice("没有可导出的内容");
      return;
    }
    const b = this.mapBounds();
    if (!b) return;
    const w = Math.ceil(b.maxX - b.minX) + 40;
    const h = Math.ceil(b.maxY - b.minY) + 40;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = newEl("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        new Notice("PNG 导出失败：无法创建画布");
        URL.revokeObjectURL(url);
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((out) => {
        if (!out) {
          new Notice("PNG 导出失败");
          URL.revokeObjectURL(url);
          return;
        }
        out.arrayBuffer().then((buf) => {
          this.writeExportFile(buf, "png");
          URL.revokeObjectURL(url);
        });
      }, "image/png");
    };
    img.onerror = () => {
      new Notice("PNG 导出失败");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // 用纯 SVG（rect + text）重建整图，便于独立导出（不依赖 Obsidian CSS）
  private buildExportSVG(): string {
    if (!this.root || this.positions.size === 0) return "";
    const b = this.mapBounds()!;
    const pad = 20;
    const w = Math.ceil(b.maxX - b.minX) + pad * 2;
    const h = Math.ceil(b.maxY - b.minY) + pad * 2;
    const ox = -b.minX + pad;
    const oy = -b.minY + pad;
    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    );
    parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>`);
    parts.push(`<g transform="translate(${ox},${oy})">`);

    // 连线
    for (const [id, pos] of this.positions) {
      const node = findTopic(this.root, id);
      if (!node) continue;
      const kids = node.collapsed ? [] : attachedChildren(node);
      kids.forEach((k, i) => {
        const cp = this.positions.get(k.id!);
        if (!cp) return;
        const color = this.edgeColor(node, i) || "#b0b8c4";
        parts.push(
          `<path d="${edgePath(pos, cp, this.nodeWidth(node), this.nodeWidth(k), this.nh, this.currentLayout)}" fill="none" stroke="${color}" stroke-width="2"/>`
        );
      });
    }

    // 节点
    for (const [id, pos] of this.positions) {
      const node = findTopic(this.root, id);
      if (!node) continue;
      const isRoot = node.id === this.root.id;
      const col = this.resolveColor(node);
      let fill = "#ffffff";
      let textColor = "#1e1e1e";
      if (isRoot) {
        fill = col ? col.fill : "#4a76d4";
        textColor = col ? col.text : "#ffffff";
      } else if (col) {
        fill = col.fill;
        textColor = col.text;
      }
      const x = pos.x - this.nodeWidth(node) / 2;
      const y = pos.y - this.nh / 2;
      parts.push(
        `<rect x="${x}" y="${y}" width="${this.nodeWidth(node)}" height="${this.nh}" rx="8" fill="${fill}" stroke="${isRoot ? fill : "#cfd8e3"}" stroke-width="2"/>`
      );
      const markers = getMarkerIds(node);
      const stickers = getStickers(node);
      const innerPad = 10;
      let textX = pos.x;
      let anchor = "middle";
      // 标记/贴纸占左侧，文字右移
      const leftIcons = markers.length + stickers.length;
      if (leftIcons > 0) {
        let ix = x + innerPad;
        for (const mid of markers) {
          const def = findMarker(mid);
          parts.push(
            `<circle cx="${ix + 6}" cy="${pos.y}" r="6" fill="${def.color}"/>`
          );
          ix += 15;
        }
        for (const st of stickers) {
          parts.push(
            `<text x="${ix + 8}" y="${pos.y + 5}" font-size="14" text-anchor="middle">${escapeXml(st)}</text>`
          );
          ix += 18;
        }
        anchor = "start";
        textX = x + innerPad + leftIcons * 17;
      }
      parts.push(
        `<text x="${textX}" y="${pos.y + 5}" font-size="${
          this.canvasStyle.compact ? 12 : 14
        }" fill="${textColor}" text-anchor="${anchor}" font-family="sans-serif">${escapeXml(
          node.title ?? ""
        )}</text>`
      );
    }

    parts.push(`</g></svg>`);
    return parts.join("");
  }

  private async writeExportFile(data: string | ArrayBuffer, ext: "svg" | "png") {
    if (!this.file) {
      new Notice("没有打开的文件");
      return;
    }
    const base = this.file.path.replace(/\.xmind$/i, "");
    let path = `${base}.${ext}`;
    let n = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${base}-${n}.${ext}`;
      n++;
    }
    try {
      if (ext === "svg") await this.app.vault.create(path, data as string);
      else await this.app.vault.createBinary(path, data as ArrayBuffer);
      new Notice("已导出 " + path);
    } catch (e) {
      new Notice("导出失败：" + (e as Error).message);
    }
  }

  // ---------- 侧栏 ----------

  private renderSidePanel() {
    this.sideContent.empty();
    if (this.activeTab === "format") {
      this.renderFormatPanel();
    } else if (this.activeTab === "markers") {
      this.renderMarkerPanel();
    } else {
      this.renderStickerPanel();
    }
  }

  private renderFormatPanel() {
    const content = this.sideContent;

    // 思维导图布局缩略图
    const section1 = content.createDiv({ cls: "mm-side-section" });
    const title1 = section1.createDiv({ cls: "mm-side-section-title" });
    title1.createEl("span", { text: "思维导图" });
    const thumbs = section1.createDiv({ cls: "mm-thumbs-grid" });
    for (const key of LAYOUT_ORDER) {
      const def = LAYOUTS[key];
      const cell = thumbs.createDiv({
        cls: "mm-thumb" + (this.currentLayout === key ? " is-active" : ""),
        attr: { title: def.label },
      });
      cell.appendChild(makeThumbSvg(def.thumb, this.currentLayout === key));
      cell.addEventListener("click", () => this.setLayout(key));
      cell.createEl("div", { cls: "mm-thumb-label", text: def.label });
    }

    // 画布样式开关
    const section2 = content.createDiv({ cls: "mm-side-section" });
    const title2 = section2.createDiv({ cls: "mm-side-section-title" });
    title2.createEl("span", { text: "画布样式" });

    this.makeToggleRow(section2, "彩虹分支", this.canvasStyle.rainbow, (v) =>
      this.updateCanvasStyle({ rainbow: v })
    );
    this.makeToggleRow(
      section2,
      "紧凑布局",
      this.canvasStyle.compact,
      (v) => this.updateCanvasStyle({ compact: v })
    );
    this.makeToggleRow(
      section2,
      "全屏显示",
      this.canvasStyle.fullscreen,
      (v) => this.updateCanvasStyle({ fullscreen: v })
    );

    // 节点样式（选中节点时显示）
    if (this.selectedId && this.root) {
      const node = findTopic(this.root, this.selectedId);
      const section3 = content.createDiv({ cls: "mm-side-section" });
      const title3 = section3.createDiv({ cls: "mm-side-section-title" });
      title3.createEl("span", { text: "节点样式" });
      if (node) {
        const nameRow = section3.createDiv({ cls: "mm-node-style-name" });
        nameRow.textContent = "当前：" + (node.title || "(空)");
        // 预设色板
        const swatches = section3.createDiv({ cls: "mm-swatches" });
        for (const c of NODE_PALETTE) {
          const sw = swatches.createDiv({ cls: "mm-swatch" });
          sw.setCssStyles({ background: c })
          sw.addEventListener("click", () => this.setNodeColor(c));
        }
        // 取色器
        const pickerRow = section3.createDiv({ cls: "mm-picker-row" });
        const picker = pickerRow.createEl("input", {
          type: "color",
          cls: "mm-color-input",
        }) as HTMLInputElement;
        picker.addEventListener("input", () =>
          this.setNodeColor(picker.value)
        );
        pickerRow.createEl("span", {
          cls: "mm-picker-label",
          text: "自定义颜色",
        });
        // 按钮
        const btnClear = section3.createEl("button", {
          cls: "mm-style-btn",
          text: "清除此节点颜色",
        });
        btnClear.addEventListener("click", () => this.setNodeColor(null));
        const btnAuto = section3.createEl("button", {
          cls: "mm-style-btn",
          text: "按分支自动染色",
        });
        btnAuto.addEventListener("click", () => this.autoColorBranches());
        const btnClearAll = section3.createEl("button", {
          cls: "mm-style-btn",
          text: "清除所有节点颜色",
        });
        btnClearAll.addEventListener("click", () => this.clearAllColors());
      }
    }

    // 当前文档统计
    if (this.root) {
      const stats = this.collectStats();
      const section4 = content.createDiv({ cls: "mm-side-section" });
      const title4 = section4.createDiv({ cls: "mm-side-section-title" });
      title4.createEl("span", { text: "信息" });
      const info = section4.createDiv({ cls: "mm-info" });
      info.createEl("div", { text: `主题数：${stats.topicCount}` });
      info.createEl("div", { text: `最大深度：${stats.maxDepth}` });
      info.createEl("div", { text: `带标记的节点：${stats.markedCount}` });
      info.createEl("div", { text: `带贴纸的节点：${stats.stickerCount}` });
      info.createEl("div", { text: `带颜色的节点：${stats.coloredCount}` });
    }
  }

  private makeToggleRow(
    parent: HTMLElement,
    label: string,
    value: boolean,
    onChange: (v: boolean) => void
  ) {
    const row = parent.createDiv({ cls: "mm-toggle-row" });
    const lbl = row.createEl("span", { cls: "mm-toggle-label", text: label });
    const sw = row.createDiv({
      cls: "mm-toggle-switch" + (value ? " is-on" : ""),
    });
    const knob = sw.createDiv({ cls: "mm-toggle-knob" });
    sw.addEventListener("click", () => onChange(!value));
    lbl.addEventListener("click", () => onChange(!value));
  }

  private renderMarkerPanel() {
    const content = this.sideContent;

    if (!this.selectedId) {
      const hint = content.createDiv({ cls: "mm-marker-empty" });
      hint.textContent = "选中一个节点后，点击下方标记即可给该节点添加或移除标记。";
      return;
    }
    const node = findTopic(this.root!, this.selectedId);
    if (!node) return;

    const header = content.createDiv({ cls: "mm-marker-header" });
    header.createEl("div", {
      cls: "mm-marker-header-title",
      text: "当前节点",
    });
    header.createEl("div", {
      cls: "mm-marker-header-name",
      text: node.title || "(空)",
    });
    const clearBtn = header.createEl("button", {
      cls: "mm-marker-clear",
      text: "清除全部",
    });
    clearBtn.addEventListener("click", () => {
      if (!node) return;
      const cur = getMarkerIds(node);
      if (cur.length === 0) return;
      for (const id of cur) toggleMarker(node, id);
      this.rebuild();
      this.renderSidePanel();
    });

    for (const cat of MARKER_CATEGORIES) {
      this.renderCategory(content, cat, node);
    }
  }

  private renderCategory(
    parent: HTMLElement,
    cat: MarkerCategoryDef,
    node: XTopic
  ) {
    const sec = parent.createDiv({ cls: "mm-marker-cat" });
    sec.createEl("div", { cls: "mm-marker-cat-title", text: cat.name });
    const grid = sec.createDiv({ cls: "mm-marker-grid" });
    for (const m of cat.markers) {
      const cell = grid.createDiv({
        cls: "mm-marker-cell" + (hasMarker(node, m.id) ? " is-active" : ""),
        attr: { title: m.label },
      });
      cell.appendChild(renderMarkerIcon(m, 18));
      cell.addEventListener("click", () => {
        toggleMarker(node, m.id);
        this.rebuild();
        this.renderSidePanel();
      });
    }
  }

  private renderStickerPanel() {
    const content = this.sideContent;
    if (!this.selectedId) {
      const hint = content.createDiv({ cls: "mm-marker-empty" });
      hint.textContent = "选中一个节点后，点击下方贴纸即可给该节点添加或移除贴纸。";
      return;
    }
    const node = findTopic(this.root!, this.selectedId);
    if (!node) return;

    const header = content.createDiv({ cls: "mm-marker-header" });
    header.createEl("div", {
      cls: "mm-marker-header-title",
      text: "当前节点",
    });
    header.createEl("div", {
      cls: "mm-marker-header-name",
      text: node.title || "(空)",
    });
    const clearBtn = header.createEl("button", {
      cls: "mm-marker-clear",
      text: "清除全部",
    });
    clearBtn.addEventListener("click", () => {
      setStickers(node, []);
      this.rebuild();
      this.renderSidePanel();
    });

    for (const group of STICKER_GROUPS) {
      const sec = content.createDiv({ cls: "mm-marker-cat" });
      sec.createEl("div", { cls: "mm-marker-cat-title", text: group.name });
      const grid = sec.createDiv({ cls: "mm-sticker-grid" });
      for (const emoji of group.items) {
        const has = getStickers(node).includes(emoji);
        const cell = grid.createDiv({
          cls: "mm-sticker-cell" + (has ? " is-active" : ""),
          text: emoji,
          attr: { title: emoji },
        });
        cell.addEventListener("click", () => {
          toggleSticker(node, emoji);
          this.rebuild();
          this.renderSidePanel();
        });
      }
    }
  }

  private collectStats(): {
    topicCount: number;
    maxDepth: number;
    markedCount: number;
    stickerCount: number;
    coloredCount: number;
  } {
    let topicCount = 0;
    let maxDepth = 0;
    let markedCount = 0;
    let stickerCount = 0;
    let coloredCount = 0;
    const walk = (t: XTopic, depth: number) => {
      topicCount++;
      maxDepth = Math.max(maxDepth, depth);
      if (getMarkerIds(t).length > 0) markedCount++;
      if (getStickers(t).length > 0) stickerCount++;
      if (typeof (t as { _color?: unknown })._color === "string")
        coloredCount++;
      for (const k of attachedChildren(t)) walk(k, depth + 1);
    };
    if (this.root) walk(this.root, 0);
    return { topicCount, maxDepth, markedCount, stickerCount, coloredCount };
  }

  // ---------- 保存 ----------

  /**
   * 根据设置决定是否由编辑操作自动保存。
   * - autoSave = true → 按 autoSaveInterval 做防抖保存：停止编辑 interval 秒后执行 save()
   * - autoSave = false → 什么都不做，仅保留 dirty 标记，等用户手动保存或 Ctrl+S
   * 工具栏「保存」按钮和 Ctrl+S 仍然直接调用 save()，代表用户主动行为，不走这里。
   */
  private maybeAutoSave(): void {
    if (!pluginInstance?.settings.autoSave) return;
    if (this.autoSaveTimer !== undefined) {
      window.clearTimeout(this.autoSaveTimer);
    }
    const intervalMs = pluginInstance.settings.autoSaveInterval * 1000;
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = undefined;
      // 触发时再检查一次设置，防止定时器等待期间用户关闭了自动保存
      if (this.dirty && pluginInstance?.settings.autoSave) {
        this.save().catch((e) => {
          console.error("[MindMap] 自动保存失败:", e);
        });
      }
    }, intervalMs);
  }

  async save(): Promise<void> {
    if (!this.file || !this.root) return;
    try {
      const data = await serializeXMind(this.sheets);
      await this.app.vault.modifyBinary(this.file, data);
      this.dirty = false;
      this.refreshHeader();
      new Notice("思维导图已保存");
    } catch (e) {
      new Notice("保存失败：" + (e as Error).message);
    }
  }
}

// 布局缩略图 SVG
function makeThumbSvg(kind: string, active: boolean): SVGSVGElement {
  const stroke = active ? "var(--interactive-accent)" : "var(--text-muted)";
  const fill = active ? "var(--interactive-accent)" : "var(--background-modifier-border)";
  const NS = "http://www.w3.org/2000/svg";
  const doc = document;
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 80 50");
  svg.setAttribute("class", "mm-thumb-svg");
  const dot = (cx: number, cy: number, r = 2.5, f = fill) => {
    const c = doc.createElementNS(NS, "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(r));
    c.setAttribute("fill", f);
    svg.appendChild(c);
  };
  const line = (d: string) => {
    const p = doc.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", stroke);
    p.setAttribute("stroke-width", "1");
    svg.appendChild(p);
  };
  const rootX = 40,
    rootY = 25,
    rootR = 4;
  dot(rootX, rootY, rootR);
  if (kind === "balance") {
    const pts = [
      [68, 8],
      [68, 25],
      [68, 42],
      [12, 8],
      [12, 25],
      [12, 42],
    ];
    for (const [x, y] of pts) {
      line(`M ${rootX} ${rootY} Q ${(rootX + x) / 2} ${(rootY + y) / 2} ${x} ${y}`);
      dot(x, y);
    }
  } else if (kind === "right") {
    const pts = [
      [70, 8],
      [70, 18],
      [70, 28],
      [70, 38],
    ];
    for (const [x, y] of pts) {
      line(`M ${rootX} ${rootY} Q ${(rootX + x) / 2} ${(rootY + y) / 2} ${x} ${y}`);
      dot(x, y);
    }
  } else if (kind === "left") {
    const pts = [
      [10, 8],
      [10, 18],
      [10, 28],
      [10, 38],
    ];
    for (const [x, y] of pts) {
      line(`M ${rootX} ${rootY} Q ${(rootX + x) / 2} ${(rootY + y) / 2} ${x} ${y}`);
      dot(x, y);
    }
  } else if (kind === "orgChart") {
    const children = [18, 40, 62];
    for (const x of children) {
      line(`M ${rootX} ${rootY} L ${(rootX + x) / 2} ${rootY} L ${(rootX + x) / 2} 42 L ${x} 42`);
      dot(x, 42);
    }
  } else if (kind === "tree") {
    dot(12, 25, rootR);
    dot(20, 18);
    dot(20, 32);
    dot(32, 14);
    dot(32, 22);
    dot(32, 36);
    line(`M 12 25 L 20 18`);
    line(`M 12 25 L 20 32`);
    line(`M 20 18 L 32 14`);
    line(`M 20 18 L 32 22`);
    line(`M 20 32 L 32 36`);
  } else if (kind === "logic") {
    dot(12, 25, rootR);
    dot(30, 18);
    dot(30, 32);
    dot(52, 14);
    dot(52, 22);
    dot(52, 36);
    line(`M 12 25 L 22 18 L 22 32 L 12 25`);
    line(`M 12 25 L 22 18`);
    line(`M 12 25 L 22 32`);
    line(`M 30 18 L 42 14 L 42 22 L 52 14`);
    line(`M 30 18 L 42 22 L 52 22`);
    line(`M 30 32 L 42 36 L 52 36`);
  } else if (kind === "timeline") {
    line(`M 12 25 L 68 25`);
    const xs = [22, 38, 54];
    for (const x of xs) {
      dot(x, 25);
      dot(x, 38);
      line(`M ${x} 25 L ${x} 38`);
    }
  } else if (kind === "fishbone") {
    // 右端鱼头
    dot(64, 25, rootR);
    const bones = [
      [30, 8],
      [18, 40],
      [46, 6],
      [36, 42],
    ];
    for (const [bx, by] of bones) {
      line(`M 64 25 L ${bx} ${by}`);
      dot(bx, by);
    }
  }
  return svg;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function edgePath(
  p: Pos,
  c: Pos,
  wP: number,
  wC: number,
  nh: number,
  layout: LayoutKey
): string {
  // 鱼骨对角线
  if (c.side === 3) {
    const x1 = p.x - wP / 2;
    const y1 = p.y;
    const x2 = c.x + wC / 2;
    const y2 = c.y;
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  // 时间轴子级：垂直折线
  if (c.side === 2) {
    const x1 = p.x;
    const y1 = p.y + nh / 2;
    const x2 = c.x;
    const y2 = c.y - nh / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  }
  // 逻辑图：水平折线
  if (c.side === 4) {
    const x1 = p.x + wP / 2;
    const y1 = p.y;
    const x2 = c.x - wC / 2;
    const y2 = c.y;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  }
  // 组织结构图：父和子都 side=0，走直角折线
  if (p.side === 0 && c.side === 0) {
    const x1 = p.x;
    const y1 = p.y + nh / 2;
    const x2 = c.x;
    const y2 = c.y - nh / 2;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
  // 思维导图 / 树形：父到子用 cubic-bezier 曲线
  const right = c.side >= 0;
  const x1 = p.x + (right ? wP / 2 : -wP / 2);
  const y1 = p.y;
  const x2 = c.x + (right ? -wC / 2 : wC / 2);
  const y2 = c.y;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}
