export interface Segment {
  id: string;
  /** 秒。タイムスタンプが無い行は null */
  start: number | null;
  end: number | null;
  speaker?: string;
  text: string;
}

export interface TranscriptDoc {
  id: string;
  name: string;
  segments: Segment[];
  /** グローバルタイムライン上でのトランスクリプト 0 秒の位置 */
  offset: number;
}

/**
 * ラベル。コードに付けてまとめるためのもの。
 * parentId で入れ子にでき（null ならトップレベル）、下位ラベルを上位ラベルでまとめていく
 */
export interface Label {
  id: string;
  name: string;
  color: string;
  description: string;
  parentId: string | null;
}

/**
 * 切片。セグメント index + 文字オフセットで範囲を表す。
 * code は「この切片が言っていること」を書いた切片固有の文（1 対 1）、
 * labelId はそのコードに付けたラベル
 */
export interface Excerpt {
  id: string;
  docId: string;
  startSeg: number;
  startOff: number;
  endSeg: number;
  endOff: number;
  text: string;
  code: string;
  labelId: string | null;
  memo: string;
  createdAt: number;
}

export interface MediaMeta {
  name: string;
  offset: number;
  volume: number;
  muted: boolean;
}

export interface Track {
  id: string;
  name: string;
  kind: 'video' | 'audio';
  url: string;
  /** グローバルタイムライン上でのメディア 0 秒の位置 */
  offset: number;
  volume: number;
  muted: boolean;
  duration: number | null;
}

export interface ProjectFile {
  format: 'thematic-analyser-project';
  version: 2;
  exportedAt: string;
  name: string;
  docs: TranscriptDoc[];
  labels: Label[];
  excerpts: Excerpt[];
  mediaMeta: Record<string, MediaMeta>;
}

/** 絞り込み対象：ラベル ID（配下のラベルも含む）、または「ラベル未付与」 */
export const UNLABELED = '__unlabeled__';
export type Focus = string;
