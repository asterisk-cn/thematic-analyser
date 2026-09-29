import type { Excerpt, Label, Segment, TranscriptDoc } from '../types';
import { UNLABELED } from '../types';

export const UNCODED = '#b9b1a3';

/** 抜粋のおおよその時間範囲（グローバル時刻） */
export function excerptTime(doc: TranscriptDoc | undefined, ex: Excerpt): { start: number | null; end: number | null } {
  if (!doc) return { start: null, end: null };
  const segs = doc.segments;
  let start: number | null = null;
  for (let i = Math.min(ex.startSeg, segs.length - 1); i >= 0; i--) {
    if (segs[i].start != null) {
      start = segs[i].start;
      break;
    }
  }
  let end: number | null = null;
  const last = segs[ex.endSeg];
  if (last?.end != null) end = last.end;
  else {
    for (let i = ex.endSeg + 1; i < segs.length; i++) {
      if (segs[i].start != null) {
        end = segs[i].start;
        break;
      }
    }
  }
  return {
    start: start == null ? null : start + doc.offset,
    end: end == null ? null : end + doc.offset,
  };
}

/** 絞り込み条件（ラベルとその配下の ID 集合、または未付与）に合うか */
export function excerptMatchesFocus(ex: Excerpt, focus: string | null, focusIds: Set<string> | null): boolean {
  if (!focus) return true;
  if (focus === UNLABELED) return !ex.labelId;
  return !!ex.labelId && !!focusIds?.has(ex.labelId);
}

export function excerptColor(ex: Excerpt, labelMap: Map<string, Label>): string {
  return (ex.labelId && labelMap.get(ex.labelId)?.color) || UNCODED;
}

export interface Piece {
  text: string;
  exIds: string[];
  colors: string[];
  pending: boolean;
}

export interface Span {
  startSeg: number;
  startOff: number;
  endSeg: number;
  endOff: number;
}

/** セグメント 1 行分のテキストを、抜粋の境界で区切る */
export function segmentPieces(
  seg: Segment,
  idx: number,
  excerpts: Excerpt[],
  labelMap: Map<string, Label>,
  pending: Span | null,
): Piece[] {
  const len = seg.text.length;
  type R = { a: number; b: number; ex?: Excerpt };
  const ranges: R[] = [];
  const clip = (s: Span) => ({
    a: idx === s.startSeg ? s.startOff : 0,
    b: idx === s.endSeg ? s.endOff : len,
  });
  for (const ex of excerpts) {
    if (idx < ex.startSeg || idx > ex.endSeg) continue;
    const r = clip(ex);
    if (r.b > r.a) ranges.push({ ...r, ex });
  }
  if (pending && idx >= pending.startSeg && idx <= pending.endSeg) {
    const r = clip(pending);
    if (r.b > r.a) ranges.push(r);
  }
  if (!ranges.length) return [{ text: seg.text, exIds: [], colors: [], pending: false }];

  const cuts = new Set<number>([0, len]);
  ranges.forEach((r) => {
    cuts.add(r.a);
    cuts.add(r.b);
  });
  const sorted = [...cuts].sort((x, y) => x - y);
  const out: Piece[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    if (p1 <= p0) continue;
    const covering = ranges.filter((r) => r.a <= p0 && r.b >= p1);
    const exs = covering.filter((r) => r.ex).map((r) => r.ex!);
    const colors: string[] = [];
    exs.forEach((e) => {
      const c = excerptColor(e, labelMap);
      if (!colors.includes(c)) colors.push(c);
    });
    out.push({
      text: seg.text.slice(p0, p1),
      exIds: exs.map((e) => e.id),
      colors,
      pending: covering.some((r) => !r.ex),
    });
  }
  return out;
}

/** 蛍光ペン風：下 58% に色帯を重ねる */
export function highlightBackground(colors: string[]): string | undefined {
  if (!colors.length) return undefined;
  const top = 42;
  const band = (100 - top) / colors.length;
  const stops = colors
    .map((c, i) => {
      const mix = `color-mix(in srgb, ${c} 62%, transparent)`;
      return `${mix} ${top + band * i}% ${top + band * (i + 1)}%`;
    })
    .join(', ');
  return `linear-gradient(to bottom, transparent 0 ${top}%, ${stops})`;
}

export function textForSpan(doc: TranscriptDoc, s: Span): string {
  const parts: string[] = [];
  for (let i = s.startSeg; i <= s.endSeg; i++) {
    const t = doc.segments[i]?.text ?? '';
    const a = i === s.startSeg ? s.startOff : 0;
    const b = i === s.endSeg ? s.endOff : t.length;
    parts.push(t.slice(a, b));
  }
  return parts.join(' ').trim();
}

export function speakerOf(doc: TranscriptDoc | undefined, ex: Excerpt): string {
  return doc?.segments[ex.startSeg]?.speaker ?? '';
}

export function sortExcerpts(excerpts: Excerpt[], docs: TranscriptDoc[]): Excerpt[] {
  const order = new Map(docs.map((d, i) => [d.id, i]));
  return [...excerpts].sort(
    (a, b) =>
      (order.get(a.docId) ?? 0) - (order.get(b.docId) ?? 0) ||
      a.startSeg - b.startSeg ||
      a.startOff - b.startOff,
  );
}

const SPEAKER_COLORS = ['#b23a26', '#28607a', '#6b4f9e', '#3d7a3a', '#9a5b12', '#7a2f5c', '#2f6f6a', '#5a5a2a'];
export function speakerColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPEAKER_COLORS[h % SPEAKER_COLORS.length];
}
