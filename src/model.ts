// 内部数据模型：直接复用 XMind 的 JSON 结构（Topic 树）。
// 这样所有 XMind 自有字段（notes / markers / labels / href 等）都能原样保留，往返不丢数据。
import { genId } from "./util";

export interface XChildren {
  attached?: XTopic[];
  detached?: XTopic[];
  summary?: XTopic[];
  [key: string]: unknown;
}

export interface XTopic {
  id?: string;
  class?: string;
  title?: string;
  children?: XChildren;
  // collapsed 是我们在 Obsidian 中维护的视图状态；XMind 会忽略未知字段，不破坏兼容性
  collapsed?: boolean;
  [key: string]: unknown;
}

export interface XSheet {
  id?: string;
  class?: string;
  title?: string;
  rootTopic: XTopic;
  [key: string]: unknown;
}

export function newTopic(title: string, id?: string): XTopic {
  return {
    id: id ?? genId("topic"),
    class: "topic",
    title,
    children: { attached: [] },
  };
}

export function attachedChildren(t: XTopic): XTopic[] {
  return t.children?.attached ?? [];
}

export function setAttached(t: XTopic, kids: XTopic[]): void {
  if (!t.children) t.children = {};
  t.children.attached = kids;
}

export function addChild(parent: XTopic, title = "新主题"): XTopic {
  const child = newTopic(title);
  const kids = attachedChildren(parent);
  kids.push(child);
  setAttached(parent, kids);
  return child;
}

/** 删除指定 id 的节点（不删除根）。返回是否删除成功 */
export function removeTopic(root: XTopic, id: string): boolean {
  const kids = attachedChildren(root);
  const idx = kids.findIndex((k) => k.id === id);
  if (idx >= 0) {
    kids.splice(idx, 1);
    setAttached(root, kids);
    return true;
  }
  for (const k of kids) {
    if (removeTopic(k, id)) return true;
  }
  return false;
}

export function findTopic(root: XTopic, id: string): XTopic | null {
  if (root.id === id) return root;
  for (const k of attachedChildren(root)) {
    const f = findTopic(k, id);
    if (f) return f;
  }
  return null;
}

/** 查找某节点的父节点 */
export function findParent(root: XTopic, id: string, parent: XTopic | null = null): XTopic | null {
  for (const k of attachedChildren(root)) {
    if (k.id === id) return root;
    const r = findParent(k, id, root);
    if (r) return r;
  }
  return null;
}

export function toggleCollapse(t: XTopic): void {
  t.collapsed = !t.collapsed;
  if (!t.collapsed && !t.children) t.children = { attached: [] };
}
