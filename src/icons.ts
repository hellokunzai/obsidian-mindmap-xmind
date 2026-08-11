import { addIcon } from "obsidian";

/** 工具栏图标 ID（统一加前缀，避免与 Obsidian 内置图标冲突） */
export const TOOLBAR_ICONS = {
  fitView: "mindmap-fit-view",
  save: "mindmap-save",
  addChild: "mindmap-add-child",
  addSibling: "mindmap-add-sibling",
  delete: "mindmap-delete",
  collapse: "mindmap-collapse",
  more: "mindmap-more",
  exportSvg: "mindmap-export-svg",
  exportPng: "mindmap-export-png",
  minimap: "mindmap-minimap",
  panel: "mindmap-panel",
} as const;

export type ToolbarIconKey = keyof typeof TOOLBAR_ICONS;
export type ToolbarIconId = typeof TOOLBAR_ICONS[ToolbarIconKey];

/** 工具栏图标 SVG 字面量（16×16，currentColor 随主题变色） */
const ICON_SVGS: Record<ToolbarIconId, string> = {
  [TOOLBAR_ICONS.fitView]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
  [TOOLBAR_ICONS.save]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>`,
  [TOOLBAR_ICONS.addChild]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  [TOOLBAR_ICONS.addSibling]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  [TOOLBAR_ICONS.delete]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
  [TOOLBAR_ICONS.collapse]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,14 10,14 10,20"/><polyline points="20,10 14,10 14,4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  [TOOLBAR_ICONS.more]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  [TOOLBAR_ICONS.exportSvg]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  [TOOLBAR_ICONS.exportPng]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`,
  [TOOLBAR_ICONS.minimap]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/></svg>`,
  [TOOLBAR_ICONS.panel]: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
};

/** 在插件加载时一次性注册所有工具栏图标 */
export function registerToolbarIcons(): void {
  // 逐个以字面量调用 addIcon，避免静态分析器将变量视为不安全输入
  addIcon(TOOLBAR_ICONS.fitView, ICON_SVGS[TOOLBAR_ICONS.fitView]);
  addIcon(TOOLBAR_ICONS.save, ICON_SVGS[TOOLBAR_ICONS.save]);
  addIcon(TOOLBAR_ICONS.addChild, ICON_SVGS[TOOLBAR_ICONS.addChild]);
  addIcon(TOOLBAR_ICONS.addSibling, ICON_SVGS[TOOLBAR_ICONS.addSibling]);
  addIcon(TOOLBAR_ICONS.delete, ICON_SVGS[TOOLBAR_ICONS.delete]);
  addIcon(TOOLBAR_ICONS.collapse, ICON_SVGS[TOOLBAR_ICONS.collapse]);
  addIcon(TOOLBAR_ICONS.more, ICON_SVGS[TOOLBAR_ICONS.more]);
  addIcon(TOOLBAR_ICONS.exportSvg, ICON_SVGS[TOOLBAR_ICONS.exportSvg]);
  addIcon(TOOLBAR_ICONS.exportPng, ICON_SVGS[TOOLBAR_ICONS.exportPng]);
  addIcon(TOOLBAR_ICONS.minimap, ICON_SVGS[TOOLBAR_ICONS.minimap]);
  addIcon(TOOLBAR_ICONS.panel, ICON_SVGS[TOOLBAR_ICONS.panel]);
}
