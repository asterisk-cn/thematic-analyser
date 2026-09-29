import type { Segment } from '../types';
import { uid } from './id';
import { parseTime } from './time';

const TS = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`;
/** 行頭タイムスタンプ: "[00:01:23]", "00:01:23 - 00:01:30", "(1:23)" など */
const RE_LEAD = new RegExp(
  String.raw`^[\[(（]?(${TS})[\])）]?(?:\s*(?:-->|[-–—~〜])\s*[\[(（]?(${TS})[\])）]?)?\s*(.*)$`,
);
/** Otter などの「話者名  00:01:23」だけの見出し行 */
const RE_SPEAKER_TIME = new RegExp(String.raw`^(.{1,40}?)\s+[\[(（]?(${TS})[\])）]?$`);
/** 「話者: 本文」 */
const RE_SPEAKER = /^([^\s:：。、,.!?「」][^:：。、!?「」\n]{0,23})\s*[:：]\s*(.*)$/;

function splitSpeaker(text: string): { speaker?: string; text: string } {
  const m = text.match(RE_SPEAKER);
  if (!m || m[2].startsWith('//') || !m[2].trim()) return { text };
  return { speaker: m[1].trim(), text: m[2].trim() };
}

function finalize(raw: Omit<Segment, 'id'>[]): Segment[] {
  const segs = raw
    .filter((s) => s.text.trim().length > 0)
    .map((s) => ({ ...s, id: uid(), text: s.text.replace(/\s+/g, ' ').trim() }));
  // 終了時刻が無ければ次の開始時刻で補完
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.start != null && s.end == null) {
      const next = segs.slice(i + 1).find((n) => n.start != null);
      s.end = next?.start ?? null;
    }
  }
  return segs;
}

export function parsePlainText(content: string): Segment[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const out: Omit<Segment, 'id'>[] = [];
  let pending: { start: number | null; end: number | null; speaker?: string } | null = null;
  let carrySpeaker: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let start: number | null = null;
    let end: number | null = null;
    let text = line;

    const lead = line.match(RE_LEAD);
    if (lead && parseTime(lead[1]) != null) {
      start = parseTime(lead[1]);
      end = lead[2] ? parseTime(lead[2]) : null;
      text = lead[3];
    } else {
      const header = line.match(RE_SPEAKER_TIME);
      if (header && parseTime(header[2]) != null) {
        carrySpeaker = header[1].trim();
        pending = { start: parseTime(header[2]), end: null, speaker: carrySpeaker };
        continue;
      }
    }

    if (!text.trim()) {
      // タイムスタンプだけの行 → 次の行に適用
      pending = { start, end, speaker: pending?.speaker ?? carrySpeaker };
      continue;
    }

    const sp = splitSpeaker(text);
    let speaker = sp.speaker;
    if (speaker) carrySpeaker = undefined;
    if (pending) {
      start ??= pending.start;
      end ??= pending.end;
      speaker ??= pending.speaker;
      pending = null;
    }
    speaker ??= carrySpeaker;
    out.push({ start, end, speaker, text: sp.text });
  }
  return finalize(out);
}

export function parseSubtitles(content: string): Segment[] {
  const blocks = content.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split(/\n\s*\n/);
  const out: Omit<Segment, 'id'>[] = [];
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    const idx = lines.findIndex((l) => l.includes('-->'));
    if (idx < 0) continue;
    const [a, rest] = lines[idx].split('-->');
    const start = parseTime(a.trim());
    const end = parseTime(rest.trim().split(/\s+/)[0]);
    let text = lines.slice(idx + 1).join(' ');
    let speaker: string | undefined;
    const voice = text.match(/^<v(?:\.[^\s>]+)?\s+([^>]+)>/);
    if (voice) speaker = voice[1].trim();
    text = text.replace(/<[^>]+>/g, '').trim();
    if (!speaker) {
      const sp = splitSpeaker(text);
      speaker = sp.speaker;
      text = sp.text;
    }
    out.push({ start, end, speaker, text });
  }
  return finalize(out);
}

const TEXT_KEYS = ['text', 'transcript', 'content', 'utterance', 'sentence', 'body', 'value', 'message'];
const START_KEYS = ['start', 'start_time', 'startTime', 'begin', 'from', 'offset', 'timestamp', 'time', 'ts'];
const END_KEYS = ['end', 'end_time', 'endTime', 'to', 'stop'];
const SPEAKER_KEYS = ['speaker', 'speaker_label', 'speakerLabel', 'speaker_name', 'name', 'role', 'author', 'user'];

function pickArray(o: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(o)) return o;
  if (!o || typeof o !== 'object' || depth > 3) return null;
  const rec = o as Record<string, unknown>;
  for (const k of ['segments', 'utterances', 'transcript', 'transcription', 'items', 'results', 'data', 'entries', 'messages', 'cues', 'monologues']) {
    const r = pickArray(rec[k], depth + 1);
    if (r && r.length) return r;
  }
  return null;
}

function firstOf(rec: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (rec[k] != null && rec[k] !== '') return rec[k];
  return undefined;
}

export function parseJsonTranscript(data: unknown): Segment[] {
  const arr = pickArray(data);
  if (!arr) {
    const text = data && typeof data === 'object' ? (data as Record<string, unknown>).text : null;
    if (typeof text === 'string') return parsePlainText(text);
    throw new Error('JSON からセグメント配列を見つけられませんでした');
  }

  const raw = arr.map((item): Omit<Segment, 'id'> => {
    if (typeof item === 'string') return { start: null, end: null, text: item };
    const rec = (item ?? {}) as Record<string, unknown>;
    let text = firstOf(rec, TEXT_KEYS);
    if (typeof text !== 'string' && Array.isArray(rec.words)) {
      text = (rec.words as Record<string, unknown>[]).map((w) => w.text ?? w.word ?? w.punctuated_word ?? '').join(' ');
    }
    if (Array.isArray(text)) text = text.map((t) => (typeof t === 'string' ? t : (t as { text?: string })?.text ?? '')).join('');
    let start = parseTime(firstOf(rec, START_KEYS));
    let end = parseTime(firstOf(rec, END_KEYS));
    const startMs = parseTime(firstOf(rec, ['start_ms', 'startMs']));
    const endMs = parseTime(firstOf(rec, ['end_ms', 'endMs']));
    if (start == null && startMs != null) start = startMs / 1000;
    if (end == null && endMs != null) end = endMs / 1000;
    const dur = parseTime(rec.duration);
    if (end == null && start != null && dur != null) end = start + dur;
    const speakerRaw = firstOf(rec, SPEAKER_KEYS);
    const speaker = speakerRaw != null && typeof speakerRaw !== 'object' ? String(speakerRaw) : undefined;
    return { start, end, speaker, text: typeof text === 'string' ? text : String(text ?? '') };
  });

  // ミリ秒で書かれていそうなら秒へ（10 時間超の開始時刻があれば ms とみなす）
  const maxStart = Math.max(0, ...raw.map((r) => r.start ?? 0));
  if (maxStart > 36000) {
    for (const r of raw) {
      if (r.start != null) r.start /= 1000;
      if (r.end != null) r.end /= 1000;
    }
  }
  return finalize(raw);
}

export function isProjectFile(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as { format?: string }).format === 'thematic-analyser-project';
}

export function parseTranscriptFile(name: string, content: string): Segment[] {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'json') return parseJsonTranscript(JSON.parse(content));
  if (ext === 'srt' || ext === 'vtt' || /^﻿?WEBVTT/.test(content)) return parseSubtitles(content);
  return parsePlainText(content);
}
