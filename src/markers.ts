// 标记 (Markers) —— 节点上的小图标
// 对应 XMind 的 topic.markers 字段结构：{ markerId: "priority-1" }
// 兼容 XMind 官方 marker id 命名；不存在时按 markerId 原样保留，不破坏文件。

export type MarkerCategoryKey =
  | "label"
  | "priority"
  | "task"
  | "flag"
  | "star"
  | "person"
  | "symbol";

export interface MarkerDef {
  id: string; // XMind marker id
  label: string; // 显示文字
  color: string; // CSS 颜色
  // 渲染：symbol（文字） / svgPath（路径 d=） / shape（简单形状：circle/triangle/square）
  symbol?: string;
  svgPath?: string;
  shape?: "circle" | "triangle" | "square" | "diamond";
  // 任务进度环（0~1）；仅在 shape === 'circle' 且未指定 symbol 时生效
  progress?: number;
}

export interface MarkerCategoryDef {
  key: MarkerCategoryKey;
  name: string;
  markers: MarkerDef[];
}

const PALETTE = [
  "#ff3b30", // 红
  "#ff9500", // 橙
  "#ffcc00", // 黄
  "#34c759", // 绿
  "#5ac8fa", // 青
  "#007aff", // 蓝
  "#8e8e93", // 灰
];

export const MARKER_CATEGORIES: MarkerCategoryDef[] = [
  {
    key: "label",
    name: "标签",
    markers: PALETTE.map(
      (c, i) =>
        ({
          id: `label-${i + 1}`,
          label: `标签 ${i + 1}`,
          color: c,
          shape: "circle",
        }) as MarkerDef
    ),
  },
  {
    key: "priority",
    name: "优先级",
    markers: PALETTE.map(
      (c, i) =>
        ({
          id: `priority-${i + 1}`,
          label: `P${i + 1}`,
          color: c,
          symbol: String(i + 1),
          shape: "circle",
        }) as MarkerDef
    ),
  },
  {
    key: "task",
    name: "任务",
    markers: [
      { id: "task-start", label: "开始", color: "#007aff", symbol: "▶" },
      { id: "task-0", label: "0%", color: "#8e8e93", shape: "circle" },
      {
        id: "task-quarter",
        label: "25%",
        color: "#8e8e93",
        shape: "circle",
        progress: 0.25,
      },
      {
        id: "task-half",
        label: "50%",
        color: "#8e8e93",
        shape: "circle",
        progress: 0.5,
      },
      {
        id: "task-threeQuarters",
        label: "75%",
        color: "#8e8e93",
        shape: "circle",
        progress: 0.75,
      },
      { id: "task-done", label: "完成", color: "#34c759", symbol: "✓" },
      { id: "task-paused", label: "暂停", color: "#ff9500", symbol: "‖" },
    ],
  },
  {
    key: "flag",
    name: "旗标",
    markers: PALETTE.map(
      (c, i) =>
        ({
          id: `flag-${i + 1}`,
          label: `旗标 ${i + 1}`,
          color: c,
          svgPath: "M0,0 L0,16 L6,11 L9,16 L9,5 L3,0 Z",
        }) as MarkerDef
    ),
  },
  {
    key: "star",
    name: "星星",
    markers: PALETTE.map(
      (c, i) =>
        ({
          id: `star-${i + 1}`,
          label: `${i + 1} 星`,
          color: c,
          svgPath:
            "M8,0 L10,5.5 L16,6 L11.5,10 L13,16 L8,12.5 L3,16 L4.5,10 L0,6 L6,5.5 Z",
        }) as MarkerDef
    ),
  },
  {
    key: "person",
    name: "人像",
    markers: PALETTE.map(
      (c, i) =>
        ({
          id: `people-${i + 1}`,
          label: `人员 ${i + 1}`,
          color: c,
          svgPath:
            "M8,7 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M2,16 c0,-3.3 2.7,-6 6,-6 s6,2.7 6,6",
        }) as MarkerDef
    ),
  },
  {
    key: "symbol",
    name: "符号",
    markers: [
      { id: "symbol-red", label: "红", color: "#ff3b30", symbol: "♥" },
      { id: "symbol-orange", label: "橙", color: "#ff9500", symbol: "☀" },
      { id: "symbol-yellow", label: "黄", color: "#ffcc00", symbol: "☂" },
      { id: "symbol-green", label: "绿", color: "#34c759", symbol: "♣" },
      { id: "symbol-blue", label: "蓝", color: "#007aff", symbol: "♦" },
      { id: "symbol-purple", label: "紫", color: "#af52de", symbol: "♠" },
      { id: "symbol-gray", label: "灰", color: "#8e8e93", symbol: "♪" },
    ],
  },
];

// 通过 id 找 marker 定义
export function findMarker(id: string): MarkerDef | null {
  for (const cat of MARKER_CATEGORIES) {
    const m = cat.markers.find((x) => x.id === id);
    if (m) return m;
  }
  // 兜底：未识别的 marker，灰色圆形
  return { id, label: id, color: "#8e8e93", shape: "circle" };
}

// 读取 topic 的 markers 数组
export function getMarkerIds(topic: unknown): string[] {
  const m = (topic as { markers?: unknown })?.markers;
  if (!Array.isArray(m)) return [];
  return m
    .map((x: unknown) =>
      typeof x === "object" && x !== null
        ? (x as { markerId?: unknown }).markerId
        : undefined
    )
    .filter((x): x is string => typeof x === "string");
}

// 写回 topic 的 markers 数组
export function setMarkerIds(topic: unknown, ids: string[]): void {
  if (ids.length === 0) {
    delete (topic as Record<string, unknown>).markers;
  } else {
    (topic as Record<string, unknown>).markers = ids.map((id) => ({
      markerId: id,
    }));
  }
}

// 通过 markerId 前缀提取其所属组（如 label-3 -> label、task-quarter -> task）
// 用于"同类型互斥"判定。
export function markerGroup(id: string): string {
  const dash = id.indexOf("-");
  return dash > 0 ? id.substring(0, dash) : id;
}

// 切换 marker（同类型互斥，行为对齐 XMind 客户端）：
//   - 若新 id 已存在 -> 仅移除；
//   - 若新 id 不存在 -> 先移除同组其他 marker，再追加新 id。
export function toggleMarker(topic: unknown, id: string): boolean {
  const ids = getMarkerIds(topic);
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    setMarkerIds(topic, ids);
    return false;
  }
  const grp = markerGroup(id);
  // 先清掉同组所有 marker（保留其他组）
  const filtered = ids.filter((x) => markerGroup(x) !== grp);
  filtered.push(id);
  setMarkerIds(topic, filtered);
  return true;
}

export function hasMarker(topic: unknown, id: string): boolean {
  return getMarkerIds(topic).includes(id);
}

// 渲染单个 marker 小图标 -> HTMLElement
export function renderMarkerIcon(def: MarkerDef, size = 14): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "mm-marker-icon";
  wrap.setCssStyles({ width: size + "px" })
  wrap.setCssStyles({ height: size + "px" })
  wrap.title = def.label;

  if (def.symbol) {
    wrap.textContent = def.symbol;
    wrap.setCssStyles({ color: def.color })
    wrap.setCssStyles({ fontSize: Math.round(size * 0.85) + "px" })
    wrap.setCssStyles({ lineHeight: "1" })
    wrap.setCssStyles({ display: "inline-flex" })
    wrap.setCssStyles({ alignItems: "center" })
    wrap.setCssStyles({ justifyContent: "center" })
    wrap.setCssStyles({ fontWeight: "600" })
  } else if (def.svgPath) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", def.svgPath);
    path.setAttribute("fill", def.color);
    svg.appendChild(path);
    wrap.appendChild(svg);
  } else if (def.shape === "triangle") {
    wrap.setCssStyles({ background: def.color })
    wrap.setCssStyles({ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" })
  } else if (def.shape === "square") {
    wrap.setCssStyles({ background: def.color })
    wrap.setCssStyles({ borderRadius: "2px" })
  } else if (def.shape === "diamond") {
    wrap.setCssStyles({ background: def.color })
    wrap.setCssStyles({ transform: "rotate(45deg)" })
  } else {
    // 默认：实心圆；如果是 task 进度，画进度环
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    const bg = document.createElementNS(NS, "circle");
    bg.setAttribute("cx", "8");
    bg.setAttribute("cy", "8");
    bg.setAttribute("r", "6");
    bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", def.color);
    bg.setAttribute("stroke-width", "2");
    bg.setAttribute("opacity", "0.4");
    svg.appendChild(bg);
    const progress = (def as { progress?: number }).progress;
    if (progress && progress > 0) {
      const fg = document.createElementNS(NS, "circle");
      fg.setAttribute("cx", "8");
      fg.setAttribute("cy", "8");
      fg.setAttribute("r", "6");
      fg.setAttribute("fill", "none");
      fg.setAttribute("stroke", def.color);
      fg.setAttribute("stroke-width", "2");
      fg.setAttribute("stroke-dasharray", `${6 * 2 * Math.PI * progress} 100`);
      fg.setAttribute("transform", "rotate(-90 8 8)");
      svg.appendChild(fg);
    } else {
      // 实心圆（label 类）
      const fill = document.createElementNS(NS, "circle");
      fill.setAttribute("cx", "8");
      fill.setAttribute("cy", "8");
      fill.setAttribute("r", "6");
      fill.setAttribute("fill", def.color);
      svg.appendChild(fill);
    }
    wrap.appendChild(svg);
  }
  return wrap;
}
