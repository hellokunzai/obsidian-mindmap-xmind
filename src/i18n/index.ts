// 国际化翻译模块
// 所有用户可见文本（命令名、设置面板、Notice、菜单、tooltip 等）必须通过 t() 获取，
// 禁止硬编码字符串。至少提供 en（英语）和 zh-cn（简体中文）两种语言。
import { moment } from "obsidian";

// 语言环境归一化：支持 "zh-cn" / "zh" / "zh-CN" / "zh_CN" 等写法
const rawLocale = moment.locale().toLowerCase().replace("_", "-");
const lang = rawLocale.split("-")[0];

type TranslationTable = Record<string, string>;

const translations: Record<string, TranslationTable> = {
  "en": {
    // ---- 命令 / 菜单 ----
    "command.newMindmap": "New Mind Map (.xmind)",
    "command.saveMindmap": "Save Current Mind Map",
    "menu.newMindmap": "New Mind Map",

    // ---- Notice ----
    "notice.createFail": "Failed to create mind map: {{msg}}",
    "notice.fileExists": "File already exists: {{path}}",
    "notice.created": "Created {{path}}",
    "notice.parseFail": "Failed to parse mind map: {{msg}}",
    "notice.noExportContent": "Nothing to export",
    "notice.pngFailCanvas": "PNG export failed: cannot create canvas",
    "notice.pngFail": "PNG export failed",
    "notice.noOpenFile": "No file is open",
    "notice.exported": "Exported {{path}}",
    "notice.exportFail": "Export failed: {{msg}}",
    "notice.rootNoSibling": "The root topic has no siblings",
    "notice.cannotDeleteRoot": "Cannot delete the root topic",
    "notice.autoColored": "Auto-colored {{count}} branches",
    "notice.saved": "Mind map saved",
    "notice.saveFail": "Save failed: {{msg}}",

    // ---- 设置面板 ----
    "settings.general": "General",
    "settings.autoSave.name": "Auto Save",
    "settings.autoSave.desc": "Automatically save changes while editing, without clicking the save button.",
    "settings.autoSaveInterval.name": "Auto Save Interval",
    "settings.autoSaveInterval.desc": "Interval between auto saves (seconds)",
    "settings.resetInterval": "Reset to default ({{seconds}}s)",
    "settings.appearance": "Appearance & Defaults",
    "settings.defaultLayout.name": "Default Layout",
    "settings.defaultLayout.desc": "Layout used for new mind maps",
    "settings.compactMode.name": "Compact Mode",
    "settings.compactMode.desc": "New maps use the compact layout by default (smaller spacing, more content visible). Existing files keep their own settings.",
    "settings.theme.name": "Theme",
    "settings.theme.desc": "Default branch colors for new maps. Existing files keep their own settings.",
    "settings.theme.classic": "Classic (no coloring)",
    "settings.theme.rainbow": "Rainbow (colorful branches)",
    "settings.theme.pastel": "Pastel (soft palette)",
    "settings.showMinimap.name": "Show Minimap",
    "settings.showMinimap.desc": "Whether to show the minimap when opening a map. The \"Minimap\" toolbar button toggles it temporarily.",
    "settings.defaultZoom.name": "Default Zoom",
    "settings.defaultZoom.desc": "Initial zoom when opening a map: Fit to view (auto scale) or 100% (original size, drag/scroll to zoom).",
    "settings.defaultZoom.fit": "Fit to view (auto zoom)",
    "settings.defaultZoom.oneHundred": "100% (original size)",
    "settings.currentInterval": "Current interval: ",
    "settings.intervalSeconds": "{{count}} seconds",
    "settings.shortcuts": "Shortcuts: Ctrl+S save \u00b7 Tab add child \u00b7 Enter add sibling \u00b7 Delete remove node",

    // ---- Modal ----
    "modal.newMindmap.title": "New Mind Map",
    "modal.newMindmap.placeholder": "File name (without extension)",
    "modal.newMindmap.hint": "A .xmind file will be created; double-click to open and edit it in Obsidian.",
    "modal.create": "Create",
    "modal.cancel": "Cancel",

    // ---- 默认文案 ----
    "default.mindMapName": "Mind Map",
    "default.centerTopic": "Central Topic",
    "default.newTopic": "New Topic",
    "default.emptyText": "(empty)",

    // ---- 视图 ----
    "view.fallbackTitle": "Mind Map",
    "view.empty": "No mind map file is open. Use the \"New Mind Map (.xmind)\" command to get started.",

    // ---- 工具栏 ----
    "toolbar.fitView": "Fit to View",
    "toolbar.save": "Save",
    "toolbar.addChild": "Add Child",
    "toolbar.addSibling": "Add Sibling",
    "toolbar.delete": "Delete",
    "toolbar.collapse": "Collapse/Expand",
    "toolbar.exportSvg": "Export SVG",
    "toolbar.exportPng": "Export PNG",
    "toolbar.minimap": "Minimap",
    "toolbar.panel": "Open Panel",
    "toolbar.more": "More",
    "toolbar.hint": "Select a node \u00b7 Tab add child / Enter add sibling / Delete remove / Space collapse / Double-click edit",

    // ---- 侧栏 Tab ----
    "tab.format": "Canvas",
    "tab.markers": "Markers",
    "tab.stickers": "Stickers",

    // ---- 侧栏面板 ----
    "side.section.mindmap": "Mind Map",
    "side.section.canvasStyle": "Canvas Style",
    "side.section.nodeStyle": "Node Style",
    "side.section.info": "Info",
    "side.canvas.rainbow": "Rainbow Branches",
    "side.canvas.compact": "Compact Layout",
    "side.canvas.fullscreen": "Fullscreen",
    "side.node.current": "Current: {{name}}",
    "side.node.customColor": "Custom Color",
    "side.node.clearColor": "Clear Node Color",
    "side.node.autoColor": "Auto-Color Branches",
    "side.node.clearAllColors": "Clear All Node Colors",
    "side.stats.topics": "Topics: {{count}}",
    "side.stats.maxDepth": "Max Depth: {{depth}}",
    "side.stats.marked": "Marked Nodes: {{count}}",
    "side.stats.stickers": "Nodes with Stickers: {{count}}",
    "side.stats.colored": "Colored Nodes: {{count}}",
    "side.marker.emptyHint": "Select a node, then click a marker below to add or remove it.",
    "side.sticker.emptyHint": "Select a node, then click a sticker below to add or remove it.",
    "side.currentNode": "Current Node",
    "side.clearAll": "Clear All",

    // ---- 右键菜单 ----
    "ctx.addChild": "Add Child Topic",
    "ctx.addSibling": "Add Sibling Topic",
    "ctx.editText": "Edit Text",
    "ctx.expand": "Expand",
    "ctx.collapse": "Collapse",
    "ctx.delete": "Delete",
    "ctx.resetWidth": "Reset Width",

    // ---- 节点 ----
    "node.resizeHint": "Drag to resize node width",

    // ---- 布局名称 ----
    "layout.balance": "Balance",
    "layout.right": "Right",
    "layout.left": "Left",
    "layout.orgChart": "Org Chart",
    "layout.tree": "Tree",
    "layout.logic": "Logic",
    "layout.timeline": "Timeline",
    "layout.fishbone": "Fishbone",

    // ---- 贴纸分组 ----
    "sticker.work": "Work",
    "sticker.life": "Life",
    "sticker.nature": "Nature",
    "sticker.symbol": "Symbols",

    // ---- 标记 ----
    "marker.cat.label": "Label",
    "marker.cat.priority": "Priority",
    "marker.cat.task": "Task",
    "marker.cat.flag": "Flag",
    "marker.cat.star": "Star",
    "marker.cat.person": "People",
    "marker.cat.symbol": "Symbol",
    "marker.labelTag": "Label {{n}}",
    "marker.taskStart": "Start",
    "marker.taskDone": "Done",
    "marker.taskPaused": "Paused",
    "marker.labelFlag": "Flag {{n}}",
    "marker.starCount": "{{n}} Star",
    "marker.personCount": "Person {{n}}",
    "marker.color.red": "Red",
    "marker.color.orange": "Orange",
    "marker.color.yellow": "Yellow",
    "marker.color.green": "Green",
    "marker.color.blue": "Blue",
    "marker.color.purple": "Purple",
    "marker.color.gray": "Gray",

    // ---- 错误 ----
    "error.missingContent": "Missing content.json, this may not be a valid XMind file",
    "error.invalidContent": "content.json is not in the expected format (should be an array of sheets)",
  },
  "zh-cn": {
    // ---- 命令 / 菜单 ----
    "command.newMindmap": "新建思维导图 (.xmind)",
    "command.saveMindmap": "保存当前思维导图",
    "menu.newMindmap": "新建思维导图",

    // ---- Notice ----
    "notice.createFail": "新建思维导图失败：{{msg}}",
    "notice.fileExists": "文件已存在：{{path}}",
    "notice.created": "已创建 {{path}}",
    "notice.parseFail": "无法解析思维导图：{{msg}}",
    "notice.noExportContent": "没有可导出的内容",
    "notice.pngFailCanvas": "PNG 导出失败：无法创建画布",
    "notice.pngFail": "PNG 导出失败",
    "notice.noOpenFile": "没有打开的文件",
    "notice.exported": "已导出 {{path}}",
    "notice.exportFail": "导出失败：{{msg}}",
    "notice.rootNoSibling": "根主题没有同级主题",
    "notice.cannotDeleteRoot": "不能删除根主题",
    "notice.autoColored": "已按分支自动染色（{{count}} 个分支）",
    "notice.saved": "思维导图已保存",
    "notice.saveFail": "保存失败：{{msg}}",

    // ---- 设置面板 ----
    "settings.general": "常规",
    "settings.autoSave.name": "自动保存",
    "settings.autoSave.desc": "编辑思维导图时自动保存更改，无需手动点击保存按钮",
    "settings.autoSaveInterval.name": "自动保存间隔",
    "settings.autoSaveInterval.desc": "自动保存的时间间隔（秒）",
    "settings.resetInterval": "恢复默认值 ({{seconds}}秒)",
    "settings.appearance": "外观与默认",
    "settings.defaultLayout.name": "默认布局",
    "settings.defaultLayout.desc": "新建思维导图时使用的默认布局",
    "settings.compactMode.name": "紧凑模式",
    "settings.compactMode.desc": "新建导图默认使用紧凑布局（间距更小，可显示更多内容）。已有文件以自身设置为准。",
    "settings.theme.name": "主题配色",
    "settings.theme.desc": "新建导图时的默认分支配色。已有文件以自身设置为准。",
    "settings.theme.classic": "经典（白底不染色）",
    "settings.theme.rainbow": "彩虹分支（一级七彩）",
    "settings.theme.pastel": "柔和色板（一级柔和色）",
    "settings.showMinimap.name": "显示缩略图",
    "settings.showMinimap.desc": "打开导图时是否显示右下角缩略图（mini map）。工具栏「缩略图」按钮可临时切换。",
    "settings.defaultZoom.name": "默认缩放",
    "settings.defaultZoom.desc": "打开导图时的初始缩放：适应视图（自动缩放至全屏可见）或 100%（原始大小，可手动拖拽/滚轮缩放）。",
    "settings.defaultZoom.fit": "适应视图（自动缩放）",
    "settings.defaultZoom.oneHundred": "100%（原始大小）",
    "settings.currentInterval": "当前间隔：",
    "settings.intervalSeconds": "{{count}} 秒",
    "settings.shortcuts": "快捷键：Ctrl+S 手动保存 · Tab 添加子主题 · Enter 添加同级 · Delete 删除节点",

    // ---- Modal ----
    "modal.newMindmap.title": "新建思维导图",
    "modal.newMindmap.placeholder": "文件名（无需扩展名）",
    "modal.newMindmap.hint": "将创建 .xmind 文件，可在 Obsidian 中双击打开编辑。",
    "modal.create": "创建",
    "modal.cancel": "取消",

    // ---- 默认文案 ----
    "default.mindMapName": "思维导图",
    "default.centerTopic": "中心主题",
    "default.newTopic": "新主题",
    "default.emptyText": "(空)",

    // ---- 视图 ----
    "view.fallbackTitle": "思维导图",
    "view.empty": "没有打开的思维导图文件。使用命令「新建思维导图 (.xmind)」开始。",

    // ---- 工具栏 ----
    "toolbar.fitView": "适应视图",
    "toolbar.save": "保存",
    "toolbar.addChild": "子主题",
    "toolbar.addSibling": "同级主题",
    "toolbar.delete": "删除",
    "toolbar.collapse": "折叠/展开",
    "toolbar.exportSvg": "导出 SVG",
    "toolbar.exportPng": "导出 PNG",
    "toolbar.minimap": "缩略图",
    "toolbar.panel": "打开面板",
    "toolbar.more": "更多",
    "toolbar.hint": "选中节点 · Tab 加子 / Enter 同级 / Delete 删除 / 空格 折叠 / 双击编辑",

    // ---- 侧栏 Tab ----
    "tab.format": "画布",
    "tab.markers": "标记",
    "tab.stickers": "贴纸",

    // ---- 侧栏面板 ----
    "side.section.mindmap": "思维导图",
    "side.section.canvasStyle": "画布样式",
    "side.section.nodeStyle": "节点样式",
    "side.section.info": "信息",
    "side.canvas.rainbow": "彩虹分支",
    "side.canvas.compact": "紧凑布局",
    "side.canvas.fullscreen": "全屏显示",
    "side.node.current": "当前：{{name}}",
    "side.node.customColor": "自定义颜色",
    "side.node.clearColor": "清除此节点颜色",
    "side.node.autoColor": "按分支自动染色",
    "side.node.clearAllColors": "清除所有节点颜色",
    "side.stats.topics": "主题数：{{count}}",
    "side.stats.maxDepth": "最大深度：{{depth}}",
    "side.stats.marked": "带标记的节点：{{count}}",
    "side.stats.stickers": "带贴纸的节点：{{count}}",
    "side.stats.colored": "带颜色的节点：{{count}}",
    "side.marker.emptyHint": "选中一个节点后，点击下方标记即可给该节点添加或移除标记。",
    "side.sticker.emptyHint": "选中一个节点后，点击下方贴纸即可给该节点添加或移除贴纸。",
    "side.currentNode": "当前节点",
    "side.clearAll": "清除全部",

    // ---- 右键菜单 ----
    "ctx.addChild": "添加子主题",
    "ctx.addSibling": "添加同级主题",
    "ctx.editText": "编辑文本",
    "ctx.expand": "展开",
    "ctx.collapse": "折叠",
    "ctx.delete": "删除",
    "ctx.resetWidth": "重置宽度",

    // ---- 节点 ----
    "node.resizeHint": "拖拽调整节点宽度",

    // ---- 布局名称 ----
    "layout.balance": "平衡图",
    "layout.right": "向右图",
    "layout.left": "向左图",
    "layout.orgChart": "组织结构图",
    "layout.tree": "树形图",
    "layout.logic": "逻辑图",
    "layout.timeline": "时间轴",
    "layout.fishbone": "鱼骨图",

    // ---- 贴纸分组 ----
    "sticker.work": "工作",
    "sticker.life": "生活",
    "sticker.nature": "自然",
    "sticker.symbol": "符号",

    // ---- 标记 ----
    "marker.cat.label": "标签",
    "marker.cat.priority": "优先级",
    "marker.cat.task": "任务",
    "marker.cat.flag": "旗标",
    "marker.cat.star": "星星",
    "marker.cat.person": "人像",
    "marker.cat.symbol": "符号",
    "marker.labelTag": "标签 {{n}}",
    "marker.taskStart": "开始",
    "marker.taskDone": "完成",
    "marker.taskPaused": "暂停",
    "marker.labelFlag": "旗标 {{n}}",
    "marker.starCount": "{{n}} 星",
    "marker.personCount": "人员 {{n}}",
    "marker.color.red": "红",
    "marker.color.orange": "橙",
    "marker.color.yellow": "黄",
    "marker.color.green": "绿",
    "marker.color.blue": "蓝",
    "marker.color.purple": "紫",
    "marker.color.gray": "灰",

    // ---- 错误 ----
    "error.missingContent": "缺少 content.json，可能不是有效的 XMind 文件",
    "error.invalidContent": "content.json 格式不正确（应为 sheet 数组）",
  },
};

// 当前语言：精确匹配（zh-cn）→ 语言族匹配（zh）→ 兜底 en
const table = translations[rawLocale] ?? translations[lang] ?? translations["en"];

/**
 * 获取指定 key 的翻译文本。
 * @param key 翻译键
 * @param params 可选参数，用 {{key}} 占位符替换（如 t("notice.created", { path })）
 */
export function t(key: string, params?: Record<string, string>): string {
  let text = table[key] ?? translations["en"][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${k}}}`, "g"), v);
    }
  }
  return text;
}
