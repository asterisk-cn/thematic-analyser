import type { Excerpt, Label } from '../types';
import { descendantIds } from './labels';

/**
 * ラベル整理ボードの検索結果。
 * - visible: 表示するラベル（一致したラベル・一致したコードを含むラベルと、その上位すべて）
 * - full:    名前が一致したラベルとその配下（コードを全部見せる）
 * - codes:   文面が一致したコード
 */
export interface BoardFilter {
  visible: Set<string>;
  full: Set<string>;
  codes: Set<string>;
}

export function buildBoardFilter(query: string, labels: Label[], excerpts: Excerpt[]): BoardFilter | null {
  const k = query.trim().toLowerCase();
  if (!k) return null;
  const parent = new Map(labels.map((l) => [l.id, l.parentId]));
  const visible = new Set<string>();
  const full = new Set<string>();
  const codes = new Set<string>();
  const addUp = (id: string | null) => {
    while (id && !visible.has(id)) {
      visible.add(id);
      id = parent.get(id) ?? null;
    }
  };
  for (const l of labels) {
    if (!l.name.toLowerCase().includes(k)) continue;
    addUp(l.id);
    for (const d of descendantIds(labels, l.id)) {
      full.add(d);
      visible.add(d);
    }
  }
  for (const e of excerpts) {
    if (!e.labelId || !parent.has(e.labelId)) continue;
    if (e.code.toLowerCase().includes(k) || e.text.toLowerCase().includes(k)) {
      codes.add(e.id);
      addUp(e.labelId);
    }
  }
  return { visible, full, codes };
}

/** ラベルごとに最初に表示するコード数（超えた分は「残り N 件」で展開） */
export const CODE_LIMIT = 12;
export const POOL_PAGE = 100;
