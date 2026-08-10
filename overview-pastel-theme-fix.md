# 修复：柔和色板主题无效

## 问题现象
插件设置里把「主题配色」设为「柔和色板（一级柔和色）」后，新建思维导图或添加子主题时没有自动出现柔和颜色。

## 根因
旧实现存在两个问题：
1. `CanvasStyle` 没有持久化 `theme` 字段，只保存了 `rainbow` 和 `compact`。新建导图默认只有中心主题、没有一级子节点，创建时没有机会写入 `_color`；等后续添加子节点时，主题信息已经丢失。
2. 添加子节点的逻辑里没有根据主题自动给一级子节点分配 `NODE_PALETTE` 颜色。

## 修复内容
`src/MindMapView.ts`：
- `CanvasStyle` 新增 `theme: ThemeKey` 字段，`DEFAULT_STYLE` 默认 `"classic"`。
- `applyDefaultThemeToRoot()` 创建新文件时把 `theme` 写入 `_canvasStyle`。
- `readCanvasStyle()` 兼容旧文件：若只有 `rainbow: true` 没有 `theme`，则推导为 `"rainbow"`。
- `loadMap()` 加载文件时，如果主题为 pastel，自动给没有 `_color` 的一级子节点补色。
- `addChildNode()` / `addSiblingNode()` 当父节点为根且主题为 pastel 时，给新子节点按索引分配色板颜色。
- `autoColorBranches()`（按分支自动染色）执行后把主题同步设为 `"pastel"`，让后续新增根子节点继续自动染色。
- `clearAllColors()`（清除所有节点颜色）执行后把主题切回 `"classic"`，避免新子节点又被自动染色。

## 验证与部署
- `npm run build` 通过（tsc + esbuild）。
- 新的 `main.js` 已复制到运行中的 Obsidian 插件目录：
  `E:/workspace/obsidian/obsidian_vault/.obsidian/plugins/mindmap-xmind/main.js`

## 使用方式
1. 在插件设置把「主题配色」改为「柔和色板（一级柔和色）」。
2. 新建思维导图（默认只有中心主题）。
3. 按 `Tab` 或点击工具栏「子主题」添加一级子节点，新节点会自动按柔和色板上色。
4. 已有文件以自身存储的 `_canvasStyle` 为准；如需切换到 pastel，可打开文件后点击「按分支自动染色」按钮。
