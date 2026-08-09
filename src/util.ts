// 通用工具：生成稳定且唯一的 id
let counter = 0;

export function genId(prefix = "id"): string {
  counter++;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
