# 自动保存间隔修复完成

## 问题
- 编辑操作（拖拽、调整节点宽度等）会立即调用 `save()`，导致「自动保存间隔」滑杆形同虚设。
- 文本编辑等操作未触发即时保存逻辑，依赖全局定时器，行为不一致。
- 用户反馈：间隔调到最小值 10 秒时像"随时保存"，其他值又像"不保存"。

## 改动
- `src/MindMapView.ts`：
  - `maybeAutoSave()` 改为按 `autoSaveInterval` 做防抖（debounce）：每次编辑后重置定时器，停止编辑 `interval` 秒后才执行 `save()`。
  - 在 `rebuild()` 末尾统一调用 `maybeAutoSave()`，增删节点、折叠/展开、切换布局、修改颜色/标记/贴纸等所有变更都走同一套防抖逻辑。
  - `startEdit` 提交文本、`startDrag` 松开时继续触发防抖保存。
  - 视图关闭时清除未触发的定时器，若仍有未保存修改且自动保存开启，则立即保存一次。
  - 加载新文件时清除旧定时器，防止把上一文件的脏状态写回。
- `src/main.ts`：
  - 移除了基于全局 `setInterval` 的 `performAutoSave`、`activeViews`、`registerActiveView`/`unregisterActiveView`、`applyAutoSave`。
  - 设置面板中切换自动保存、调整间隔、恢复默认值后不再调用已移除的 `applyAutoSave()`。

## 结果
- 自动保存间隔滑杆现在真正控制保存频率：10 秒 = 停止编辑 10 秒后保存，300 秒 = 停止编辑 300 秒后保存。
- 所有变更操作行为一致，避免频繁立即保存。
- 关闭视图/切换文件时不会丢失未保存的修改。

## 构建验证
- `npm run build` 通过。
