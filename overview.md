# 移动端适配与工具栏优化

## 已完成

### 1. 工具栏重构
- 将顶部工具栏拆分为 **常用操作区** 与 **「更多」下拉菜单**。
- 常用操作始终靠左显示：适应视图、保存、+子主题、+同级、删除、折叠/展开。
- 次要操作收入下拉：导出 SVG、导出 PNG、缩略图开关、显示/隐藏面板。
- 下拉菜单点击外部自动收起。

### 2. 移动端兼容
- 通过 `Platform.isMobile` 检测移动平台，为根节点添加 `is-mobile` 类。
- 移动端默认收起右侧栏，点击「显示面板」后以侧滑浮层形式打开，并带遮罩。
- 操作提示在移动端隐藏，工具栏按钮使用更紧凑的短标签。
- 为画布和缩略图补充 `touchstart` / `touchmove` / `touchend` 事件，支持单指拖拽平移、双指缩放。
- 添加 `touch-action: none` 防止浏览器默认手势干扰。
- 小屏断点（≤600px）额外优化布局、字号与间距。

### 3. 修复「更多」下拉菜单不显示
- 根因：`.mm-toolbar` 设置了 `overflow: hidden`，下拉菜单向下溢出时被截断。
- 处理：移除 `.mm-toolbar` 的 `overflow: hidden`，仅保留在 `.mm-toolbar-primary` 上，确保常用按钮区仍能截断溢出，同时下拉菜单可正常展开。

### 4. 修复移动端编辑节点时节点居中、键盘留白与子节点被挤出
- 根因：
  - 仅用 `visualViewport.height` 当可见高度不可靠——Obsidian Android webview 弹键盘时该值不缩小（键盘覆盖式弹出），导致节点居中到整屏中部。
  - 编辑时强制把缩放放大到 `1.0~1.4`，键盘弹出后可视区域很小，子节点被等比拉大到画布/键盘之外，出现「空白画布、节点显示不出来」。
- 处理：
  - `centerNodeForEdit()` 改用 `Math.min(window.innerHeight, visualViewport?.height)` 作为可见高度，并用 `visualViewport.offsetTop` 修正顶部偏移，计算「键盘上方可见区域」。
  - 缩放改为 `Math.max(this.scale, 0.7)`，只在缩放过小时轻微放大，正常情况保持原缩放以保留周围节点。
  - 节点垂直目标位置从可见区中部改为约 40% 处，给下方子节点留出更多空间。
  - `attachEditViewportHandler()` 额外监听 `window.resize`（Android 弹键盘触发）并在聚焦 300ms 后二次校正，覆盖键盘弹出动画延迟。
  - 输入框使用 `focus({ preventScroll: true })` 避免浏览器默认滚动错位。
  - CSS 为编辑输入框增加 `z-index: 50`、移动端 `font-size: 16px`、`min-width: 120px`、`max-width: calc(100% - 16px)`。

### 4.1 关键修复：根因是「容器」高度未随键盘收缩（用户点拨）
- 现象：按上述改了几次仍不行——唤起键盘后节点显示不出来，画布与键盘之间有大块空白。
- 根因（容器不是画布）：居中计算参考了 `.mm-canvas` 的 `getBoundingClientRect().height`，但 Obsidian 移动端容器 `.mm-view`/`.mm-canvas` 在键盘弹出时**并未收缩到键盘上方可见区**（尤其 iOS 键盘覆盖式弹出），容器仍是整屏高度，于是节点被居中到整屏中部、落在键盘后方，上方留白。
- 处理：
  - 新增 `applyEditContainerHeight()`：编辑时把 `.mm-view`（contentEl）内联高度设为「键盘上方可见高度」=`min(visualViewport.height, window.innerHeight) - contentEl.top`；仅当确实缩小（`< innerHeight-4`）才收缩，否则还原为 `""`（100%）。这样 `.mm-canvas` 高度即真实可见高度，居中自然正确，画布与键盘之间不再有空白。
    - iOS：`visualViewport.height` 缩小 → 收缩生效；Android adjustResize：`window.innerHeight` 已缩 → 容器本就正确，走还原分支保持原状。
  - `centerNodeForEdit()` 改用收缩后的 `rect.height`，节点垂直锚定在可见区**上部 1/3**（`min(rect.height*0.32, rect.height - nh - 12)`），任意键盘高度下都可见。
  - `attachEditViewportHandler()` 新增监听 `visualViewport.scroll`，handler 内调用 `applyEditContainerHeight()` 并 `requestAnimationFrame` 二次居中（容器高度变化后下一帧 rect 才更新）。
  - 保存 `preEditTx/Ty/Scale`，`commit`/`Escape` 的 `cleanup()` 还原编辑前平移/缩放并重置容器高度，避免用户视图卡在编辑态。

### 5. 构建验证
- 运行 `npm run build` 成功通过 TypeScript 类型检查与 esbuild 打包。
- `main.js` 与 `styles.css` 已更新。

## 修改文件
- `src/MindMapView.ts`
- `styles.css`
- `main.js`（构建产物）

## 后续可优化
- 可为移动端节点添加长按菜单，补充右键菜单中的「添加子主题/同级」等操作。
- 节点编辑时可考虑自动滚动到可视区域，避免被虚拟键盘遮挡。
