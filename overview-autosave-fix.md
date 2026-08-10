# 修复：关闭「自动保存」后编辑仍自动保存

## 问题现象
用户在 Obsidian 设置里关闭 Mindmap Xmind 的「自动保存」开关后，编辑思维导图（如拖拽节点、调整节点宽度、重置宽度）仍会弹出「思维导图已保存」通知，文件被立即写盘。

## 根因
`src/MindMapView.ts` 中已有修复：把编辑后的直接 `save()` 改为 `maybeAutoSave()`，并新增 `maybeAutoSave()` 方法根据 `settings.autoSave` 判断是否写盘。但部署用的 `main.js` 是旧构建，仍包含直接调用 `save()` 的代码，导致设置开关失效。

涉及的三处编辑操作：
1. 拖拽调整节点宽度后（`startResize` 的 `pointerup`）。
2. 拖拽移动节点（及其子树）后（`startDrag` 的 `pointerup`）。
3. 右键菜单「重置宽度」后。

## 修复内容
- 重新执行 `npm run build`，让 `main.js` 与 `src/MindMapView.ts` 同步。
- 验证构建后的 `main.js` 中三处编辑操作均调用 `maybeAutoSave()`，且 `maybeAutoSave()` 方法存在并正确检查 `pluginInstance.settings.autoSave`。
- 工具栏「保存」按钮与 `Ctrl+S` 仍直接调用 `save()`，属于用户主动保存行为，不受影响。
- 将新的 `main.js` 复制到运行中的 Obsidian 插件目录：
  `E:/workspace/obsidian/obsidian_vault/.obsidian/plugins/mindmap-xmind/main.js`

## 修复后行为
- 关闭「自动保存」时，编辑导图只设置 `dirty = true`（标题后显示 `•`），不会写盘、不会弹通知。
- 需要保存时，手动点击工具栏「保存」按钮或按 `Ctrl+S`。
- 开启「自动保存」时，仍按设定间隔自动保存。

## 修改文件
- `main.js`（重新构建的插件产物）
- `E:/workspace/obsidian/obsidian_vault/.obsidian/plugins/mindmap-xmind/main.js`（已复制到运行目录）
