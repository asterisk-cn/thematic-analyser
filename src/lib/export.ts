import type { Excerpt, ProjectFile } from '../types';
import { excerptTime, sortExcerpts, speakerOf } from './analysis';
import { buildTree, pathText, type LabelNode } from './labels';
import { fmtTime } from './time';

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'project';

export function exportProjectJson(p: ProjectFile) {
  download(`${safe(p.name)}.thematic.json`, JSON.stringify(p, null, 2), 'application/json');
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportExcerptsCsv(p: ProjectFile) {
  const docs = new Map(p.docs.map((d) => [d.id, d]));
  const depth = Math.max(1, ...p.excerpts.map((e) => pathText(p.labels, e.labelId).split(' › ').length));
  const header = [
    '切片ID', 'ドキュメント', '開始', '終了', '話者', '切片', 'コード',
    ...Array.from({ length: depth }, (_, i) => `ラベル${i + 1}`),
    'メモ',
  ];
  const rows = sortExcerpts(p.excerpts, p.docs).map((ex) => {
    const doc = docs.get(ex.docId);
    const t = excerptTime(doc, ex);
    const path = ex.labelId ? pathText(p.labels, ex.labelId).split(' › ') : [];
    return [
      ex.id,
      doc?.name ?? '',
      t.start == null ? '' : fmtTime(t.start, true),
      t.end == null ? '' : fmtTime(t.end, true),
      speakerOf(doc, ex),
      ex.text,
      ex.code,
      ...Array.from({ length: depth }, (_, i) => path[i] ?? ''),
      ex.memo,
    ];
  });
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  download(`${safe(p.name)}_codes.csv`, csv, 'text/csv');
}

export function exportMarkdownReport(p: ProjectFile) {
  const docs = new Map(p.docs.map((d) => [d.id, d]));
  const lines: string[] = [`# ${p.name}`, '', `_書き出し: ${new Date().toLocaleString('ja-JP')}_`, ''];
  lines.push(
    `- ドキュメント: ${p.docs.length}`,
    `- 切片（コード）: ${p.excerpts.length}`,
    `- ラベル: ${p.labels.length}`,
    '',
  );

  const quote = (ex: Excerpt) => {
    const doc = docs.get(ex.docId);
    const t = excerptTime(doc, ex);
    const meta = [doc?.name, t.start != null ? fmtTime(t.start) : null, speakerOf(doc, ex) || null].filter(Boolean).join(' · ');
    lines.push(`- **${ex.code || '（コード未記入）'}**`, `  > ${ex.text.replace(/\n/g, ' ')}`, `  > — ${meta}`);
    if (ex.memo) lines.push(`  - メモ: ${ex.memo}`);
  };

  const byLabel = new Map<string | null, Excerpt[]>();
  for (const e of sortExcerpts(p.excerpts, p.docs)) byLabel.set(e.labelId, [...(byLabel.get(e.labelId) ?? []), e]);

  const walk = (nodes: LabelNode[]) => {
    for (const n of nodes) {
      lines.push(`${'#'.repeat(Math.min(6, n.depth + 2))} ${n.label.name}`, '');
      if (n.label.description) lines.push(n.label.description, '');
      const exs = byLabel.get(n.label.id) ?? [];
      exs.forEach(quote);
      if (exs.length) lines.push('');
      walk(n.children);
    }
  };
  walk(buildTree(p.labels));

  const ids = new Set(p.labels.map((l) => l.id));
  const loose = p.excerpts.filter((e) => !e.labelId || !ids.has(e.labelId));
  if (loose.length) {
    lines.push('## ラベル未付与', '');
    sortExcerpts(loose, p.docs).forEach(quote);
    lines.push('');
  }
  download(`${safe(p.name)}_report.md`, lines.join('\n'), 'text/markdown');
}
