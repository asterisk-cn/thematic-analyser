import type { Excerpt, Label, ProjectFile } from '../types';

export interface LabelNode {
  label: Label;
  depth: number;
  children: LabelNode[];
}

/** ラベルの木。親が見つからないラベルはトップレベル扱い */
export function buildTree(labels: Label[]): LabelNode[] {
  const ids = new Set(labels.map((l) => l.id));
  const byParent = new Map<string | null, Label[]>();
  for (const l of labels) {
    const p = l.parentId && ids.has(l.parentId) ? l.parentId : null;
    byParent.set(p, [...(byParent.get(p) ?? []), l]);
  }
  const walk = (parent: string | null, depth: number): LabelNode[] =>
    (byParent.get(parent) ?? []).map((label) => ({ label, depth, children: walk(label.id, depth + 1) }));
  return walk(null, 0);
}

/** 深さ優先で平らにした一覧（セレクトボックスなど用） */
export function flatten(nodes: LabelNode[]): LabelNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** id 自身と配下すべてのラベル ID */
export function descendantIds(labels: Label[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of labels) {
      if (l.parentId && out.has(l.parentId) && !out.has(l.id)) {
        out.add(l.id);
        grew = true;
      }
    }
  }
  return out;
}

/** ルートからのラベル名の並び */
export function labelPath(labels: Label[], id: string | null): Label[] {
  const map = new Map(labels.map((l) => [l.id, l]));
  const path: Label[] = [];
  const seen = new Set<string>();
  let cur = id ? map.get(id) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return path;
}

export const pathText = (labels: Label[], id: string | null) =>
  labelPath(labels, id)
    .map((l) => l.name)
    .join(' › ');

/**
 * 旧形式（共有コード codes[] + テーマ themes[]、切片に codeIds[]）を新形式へ移行する。
 * - 切片のコード文 = 付いていたコード名を「／」でつないだもの
 * - ラベル = 旧テーマ（トップ）＋ 旧コード（その下の子ラベル）
 * - 切片のラベル = 付いていた最初の旧コード
 */
export function migrate(data: any): Pick<ProjectFile, 'labels' | 'excerpts'> {
  if (Array.isArray(data.labels)) return { labels: data.labels, excerpts: data.excerpts ?? [] };

  type OldCode = { id: string; name: string; color: string; description?: string; themeId?: string | null };
  type OldTheme = { id: string; name: string; color: string; description?: string };
  const codes: OldCode[] = data.codes ?? [];
  const themes: OldTheme[] = data.themes ?? [];
  const codeMap = new Map(codes.map((c) => [c.id, c]));

  const labels: Label[] = [
    ...themes.map((t) => ({ id: t.id, name: t.name, color: t.color, description: t.description ?? '', parentId: null })),
    ...codes.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      description: c.description ?? '',
      parentId: c.themeId ?? null,
    })),
  ];

  const excerpts: Excerpt[] = (data.excerpts ?? []).map((e: Excerpt & { codeIds?: string[] }) => {
    if (typeof e.code === 'string') return e;
    const ids = e.codeIds ?? [];
    const { codeIds: _drop, ...rest } = e;
    void _drop;
    return {
      ...rest,
      code: ids.map((id) => codeMap.get(id)?.name).filter(Boolean).join('／'),
      labelId: ids.find((id) => codeMap.has(id)) ?? null,
    };
  });
  return { labels, excerpts };
}
