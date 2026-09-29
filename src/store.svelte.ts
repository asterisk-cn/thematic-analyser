import type { Comment, CommentTarget, Excerpt, Focus, Label, MediaMeta, ProjectFile, Track, TranscriptDoc } from './types';
import { UNLABELED, commentKey } from './types';
import { buildTree, descendantIds, migrate } from './lib/labels';
import { uid } from './lib/id';
import { engine } from './lib/engine.svelte';

/** 蛍光ペン調のパレット */
export const PALETTE = [
  '#f5c518', '#ff7a59', '#5cc8a8', '#6aa5ff', '#c792ea',
  '#ff9ecb', '#9ccc65', '#ffb347', '#4dd0e1', '#e57373',
  '#a1887f', '#90a4ae',
];

/** ① コーディング ／ ② ラベル整理 */
export type Page = 'code' | 'label';

export interface Toast {
  id: string;
  msg: string;
  kind: 'info' | 'error';
}

const STORAGE_KEY = 'thematic-analyser:v1';
const MEDIA_EXT_AUDIO = /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|weba)$/i;
const DEFAULT_NAME = '無題のプロジェクト';

/** ids の要素を patch して取り出し、anchorId の前（後）へ差し込む。anchor が無ければ末尾へ */
function reorder<T extends { id: string }>(
  arr: T[],
  ids: Set<string>,
  anchorId: string | null,
  place: 'before' | 'after',
  patch: (x: T) => T,
): T[] {
  if (!ids.size) return arr;
  const moving = arr.filter((x) => ids.has(x.id)).map(patch);
  const rest = arr.filter((x) => !ids.has(x.id));
  let at = rest.length;
  if (anchorId && !ids.has(anchorId)) {
    const i = rest.findIndex((x) => x.id === anchorId);
    if (i >= 0) at = place === 'before' ? i : i + 1;
  }
  rest.splice(at, 0, ...moving);
  return rest;
}

class AppStore {
  // ── 永続化されるプロジェクトデータ（イミュータブルに置き換える） ──
  name = $state(DEFAULT_NAME);
  docs = $state.raw<TranscriptDoc[]>([]);
  labels = $state.raw<Label[]>([]);
  excerpts = $state.raw<Excerpt[]>([]);
  comments = $state.raw<Comment[]>([]);
  mediaMeta = $state.raw<Record<string, MediaMeta>>({});
  activeDocId = $state<string | null>(null);
  page = $state<Page>('code');

  // ── セッション限りの UI 状態 ──
  tracks = $state.raw<Track[]>([]);
  selectedExcerptId = $state<string | null>(null);
  focus = $state<Focus | null>(null);
  /** 左のコメントタブで入力欄を開いている対象 */
  commentTarget = $state.raw<CommentTarget | null>(null);
  /** ラベル整理画面の左タブ */
  boardLeftTab = $state<'pool' | 'comments'>('pool');
  /** 画面下のメディアの帯を折りたたんでいるか */
  mediaCollapsed = $state(false);
  /** ラベル整理ボードで複数選択中のコード（切片 ID）とラベル */
  selExcerpts = $state.raw<Set<string>>(new Set());
  selLabels = $state.raw<Set<string>>(new Set());
  scrollReq = $state.raw<{ docId: string; seg: number; n: number } | null>(null);
  toasts = $state.raw<Toast[]>([]);

  // ── 派生値 ──
  activeDoc = $derived(this.docs.find((d) => d.id === this.activeDocId) ?? this.docs[0]);
  /** 対象ごとのコメント（commentKey → 古い順） */
  commentsByTarget = $derived.by(() => {
    const m = new Map<string, Comment[]>();
    for (const c of this.comments) {
      const k = commentKey(c.target);
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  });
  labelMap = $derived(new Map(this.labels.map((l) => [l.id, l])));
  labelTree = $derived(buildTree(this.labels));
  /** 絞り込み中のラベルとその配下 */
  focusIds = $derived(this.focus && this.focus !== UNLABELED ? descendantIds(this.labels, this.focus) : null);
  /** ラベルに直接付いているコード数 */
  directCounts = $derived.by(() => {
    const m = new Map<string, number>();
    for (const e of this.excerpts) if (e.labelId) m.set(e.labelId, (m.get(e.labelId) ?? 0) + 1);
    return m;
  });
  /** 配下のラベルも含めたコード数 */
  totalCounts = $derived.by(() => {
    const m = new Map<string, number>();
    const add = (id: string | null, n: number, seen: Set<string>) => {
      while (id && !seen.has(id)) {
        seen.add(id);
        m.set(id, (m.get(id) ?? 0) + n);
        id = this.labelMap.get(id)?.parentId ?? null;
      }
    };
    for (const [id, n] of this.directCounts) add(id, n, new Set());
    return m;
  });

  constructor() {
    this.load();
    this.syncExtent();
    $effect.root(() => {
      $effect(() => {
        const data = JSON.stringify({
          state: {
            name: this.name,
            docs: this.docs,
            labels: this.labels,
            excerpts: this.excerpts,
            comments: this.comments,
            mediaMeta: this.mediaMeta,
            activeDocId: this.activeDocId,
            page: this.page,
            mediaCollapsed: this.mediaCollapsed,
          },
          version: 0,
        });
        const t = setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, data);
          } catch {
            this.toast('ブラウザへの保存に失敗しました（容量不足の可能性）。プロジェクトを書き出してください', 'error');
          }
        }, 250);
        return () => clearTimeout(t);
      });
    });
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw).state ?? {};
      this.name = s.name ?? DEFAULT_NAME;
      this.docs = s.docs ?? [];
      const m = migrate(s);
      this.labels = m.labels;
      this.excerpts = m.excerpts;
      this.comments = s.comments ?? [];
      this.mediaMeta = s.mediaMeta ?? {};
      this.activeDocId = s.activeDocId ?? null;
      this.page = s.page === 'label' ? 'label' : 'code';
      this.mediaCollapsed = !!s.mediaCollapsed;
    } catch {
      /* 壊れた保存データは無視 */
    }
  }

  /**
   * トランスクリプトの長さをタイムラインに反映。
   * ドキュメント切替直後の seek がクランプされないよう同期的に呼ぶ
   */
  private syncExtent() {
    const doc = this.docs.find((d) => d.id === this.activeDocId) ?? this.docs[0];
    if (!doc) return engine.setExtent(0);
    let max = 0;
    for (const s of doc.segments) max = Math.max(max, s.end ?? s.start ?? 0);
    engine.setExtent(max + doc.offset);
  }

  // ── ドキュメント ──
  addDoc(d: Omit<TranscriptDoc, 'id' | 'offset'>) {
    const doc: TranscriptDoc = { ...d, id: uid(), offset: 0 };
    this.docs = [...this.docs, doc];
    this.activeDocId = doc.id;
    this.syncExtent();
    return doc;
  }
  updateDoc(id: string, patch: Partial<TranscriptDoc>) {
    this.docs = this.docs.map((d) => (d.id === id ? { ...d, ...patch } : d));
    this.syncExtent();
  }
  removeDoc(id: string) {
    this.docs = this.docs.filter((d) => d.id !== id);
    this.excerpts = this.excerpts.filter((e) => e.docId !== id);
    this.comments = this.comments.filter((c) => !(c.target.kind === 'segment' && c.target.docId === id));
    if (this.activeDocId === id) this.activeDocId = this.docs[0]?.id ?? null;
    this.syncExtent();
  }
  setActiveDoc(id: string) {
    this.activeDocId = id;
    this.syncExtent();
  }

  // ── ラベル ──
  addLabel(name: string, parentId: string | null = null) {
    const parent = parentId ? this.labelMap.get(parentId) : undefined;
    const label: Label = {
      id: uid(),
      name: name.trim(),
      color: parent?.color ?? PALETTE[this.labels.filter((l) => !l.parentId).length % PALETTE.length],
      description: '',
      parentId: parent ? parent.id : null,
    };
    this.labels = [...this.labels, label];
    return label;
  }
  updateLabel(id: string, patch: Partial<Omit<Label, 'parentId'>>) {
    this.labels = this.labels.map((l) => (l.id === id ? { ...l, ...patch } : l));
  }
  /** 親ラベルを変更。自分自身や配下の下へは移動できない */
  moveLabel(id: string, parentId: string | null) {
    if (parentId && descendantIds(this.labels, id).has(parentId)) return false;
    this.labels = this.labels.map((l) => (l.id === id ? { ...l, parentId } : l));
    return true;
  }
  /** 削除すると、子ラベルと付いていたコードは 1 つ上の階層へ移る */
  deleteLabel(id: string) {
    const parentId = this.labelMap.get(id)?.parentId ?? null;
    this.labels = this.labels.filter((l) => l.id !== id).map((l) => (l.parentId === id ? { ...l, parentId } : l));
    this.excerpts = this.excerpts.map((e) => (e.labelId === id ? { ...e, labelId: parentId } : e));
    this.comments = this.comments.filter((c) => !(c.target.kind === 'label' && c.target.labelId === id));
    if (this.focus === id) this.focus = null;
    if (this.selLabels.has(id)) this.selLabels = new Set([...this.selLabels].filter((x) => x !== id));
  }

  // ── 抜粋 ──
  addExcerpt(e: Omit<Excerpt, 'id' | 'createdAt' | 'memo'>) {
    const ex: Excerpt = { ...e, id: uid(), memo: '', createdAt: Date.now() };
    this.excerpts = [...this.excerpts, ex];
    return ex;
  }
  updateExcerpt(id: string, patch: Partial<Excerpt>) {
    this.excerpts = this.excerpts.map((e) => (e.id === id ? { ...e, ...patch } : e));
  }
  deleteExcerpt(id: string) {
    this.excerpts = this.excerpts.filter((e) => e.id !== id);
    if (this.selectedExcerptId === id) this.selectedExcerptId = null;
  }

  // ── コメント ──
  addComment(target: CommentTarget, text: string) {
    const c: Comment = { id: uid(), target, text: text.trim(), createdAt: Date.now() };
    this.comments = [...this.comments, c];
    return c;
  }
  updateComment(id: string, text: string) {
    this.comments = this.comments.map((c) => (c.id === id ? { ...c, text, updatedAt: Date.now() } : c));
  }
  deleteComment(id: string) {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
  /** 対象のコメント欄を左のタブで開く */
  openComments(target: CommentTarget) {
    this.commentTarget = target;
    if (target.kind === 'label') this.boardLeftTab = 'comments';
  }
  commentsOf(target: CommentTarget) {
    return this.commentsByTarget.get(commentKey(target)) ?? [];
  }

  // ── メディア ──
  addTrack(file: File) {
    const kind: Track['kind'] =
      file.type.startsWith('audio/') || (!file.type.startsWith('video/') && MEDIA_EXT_AUDIO.test(file.name))
        ? 'audio'
        : 'video';
    const meta = this.mediaMeta[file.name];
    const track: Track = {
      id: uid(),
      name: file.name,
      kind,
      url: URL.createObjectURL(file),
      offset: meta?.offset ?? 0,
      volume: meta?.volume ?? 1,
      muted: meta?.muted ?? false,
      duration: null,
    };
    this.tracks = [...this.tracks, track];
    this.rememberMedia(track);
    return track;
  }
  updateTrack(id: string, patch: Partial<Track>) {
    this.tracks = this.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    const t = this.tracks.find((x) => x.id === id);
    if (t) this.rememberMedia(t);
  }
  removeTrack(id: string) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    URL.revokeObjectURL(t.url);
    this.tracks = this.tracks.filter((x) => x.id !== id);
    this.forgetMedia(t.name);
  }
  forgetMedia(name: string) {
    const mm = { ...this.mediaMeta };
    delete mm[name];
    this.mediaMeta = mm;
  }
  private rememberMedia(t: Track) {
    this.mediaMeta = { ...this.mediaMeta, [t.name]: { name: t.name, offset: t.offset, volume: t.volume, muted: t.muted } };
  }

  // ── ラベル整理ボード ──
  setPage(page: Page) {
    if (page === this.page) return;
    engine.pause(); // メディアはコーディング画面にしか無いので止めておく
    this.page = page;
  }
  toggleSelExcerpt(id: string, additive: boolean) {
    const next = new Set(additive ? this.selExcerpts : []);
    if (!additive) this.selLabels = new Set();
    if (this.selExcerpts.has(id) && additive) next.delete(id);
    else next.add(id);
    this.selExcerpts = next;
  }
  toggleSelLabel(id: string) {
    const next = new Set(this.selLabels);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selLabels = next;
  }
  clearSelection() {
    this.selExcerpts = new Set();
    this.selLabels = new Set();
  }
  /** 複数のコードにまとめてラベルを付ける（null で外す） */
  assignLabel(excerptIds: Iterable<string>, labelId: string | null) {
    const ids = new Set(excerptIds);
    this.excerpts = this.excerpts.map((e) => (ids.has(e.id) ? { ...e, labelId } : e));
  }
  /** 複数のラベルをまとめて移動。循環になるものは移動しない。移動できなかった数を返す */
  moveLabels(labelIds: Iterable<string>, parentId: string | null) {
    let failed = 0;
    for (const id of labelIds) if (id !== parentId && !this.moveLabel(id, parentId)) failed++;
    return failed;
  }
  /**
   * 選択中のコードとラベルを新しいラベルでまとめる。
   * 選択したラベルがすべて同じ親を持つなら、新しいラベルはその親の下に作る
   */
  groupSelection(name: string) {
    const labelIds = [...this.selLabels];
    const parents = new Set(labelIds.map((id) => this.labelMap.get(id)?.parentId ?? null));
    const parentId = labelIds.length && parents.size === 1 ? [...parents][0] : null;
    const label = this.addLabel(name, parentId);
    this.moveLabels(labelIds, label.id);
    this.assignLabel(this.selExcerpts, label.id);
    this.clearSelection();
    return label;
  }
  /**
   * ラベルを parentId の下の anchorId の前（後）へ差し込む。anchorId が null なら末尾。
   * 自分自身や配下の下へ入ることになるものは動かさず、その数を返す
   */
  placeLabels(ids: string[], parentId: string | null, anchorId: string | null, place: 'before' | 'after') {
    const ok = new Set(ids.filter((id) => !parentId || !descendantIds(this.labels, id).has(parentId)));
    this.labels = reorder(this.labels, ok, anchorId, place, (l) => ({ ...l, parentId }));
    return ids.length - ok.size;
  }
  /** コードにラベルを付け、そのラベル内で anchorId の前（後）へ並べる */
  placeExcerpts(ids: string[], labelId: string | null, anchorId: string | null, place: 'before' | 'after') {
    this.excerpts = reorder(this.excerpts, new Set(ids), anchorId, place, (e) => ({ ...e, labelId }));
  }
  /** 選択中のものを既存のラベルの下へ */
  moveSelection(target: string | null) {
    const failed = this.moveLabels(this.selLabels, target);
    this.assignLabel(this.selExcerpts, target);
    this.clearSelection();
    return failed;
  }

  // ── UI ──
  requestScroll(docId: string, seg: number) {
    this.scrollReq = { docId, seg, n: (this.scrollReq?.n ?? 0) + 1 };
  }

  toast(msg: string, kind: Toast['kind'] = 'info') {
    const id = uid();
    this.toasts = [...this.toasts, { id, msg, kind }];
    setTimeout(() => this.dismissToast(id), kind === 'error' ? 6000 : 3200);
  }
  dismissToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  // ── プロジェクト ──
  importProject(p: ProjectFile) {
    this.name = p.name ?? DEFAULT_NAME;
    this.docs = p.docs ?? [];
    const m = migrate(p);
    this.labels = m.labels;
    this.excerpts = m.excerpts;
    this.comments = p.comments ?? [];
    this.mediaMeta = { ...(p.mediaMeta ?? {}), ...this.mediaMeta };
    this.activeDocId = p.docs?.[0]?.id ?? null;
    this.selectedExcerptId = null;
    this.focus = null;
    this.clearSelection();
    this.syncExtent();
  }
  exportProject(): ProjectFile {
    return {
      format: 'thematic-analyser-project',
      version: 2,
      exportedAt: new Date().toISOString(),
      name: this.name,
      docs: this.docs,
      labels: this.labels,
      excerpts: this.excerpts,
      comments: this.comments,
      mediaMeta: this.mediaMeta,
    };
  }
  newProject() {
    this.tracks.forEach((t) => URL.revokeObjectURL(t.url));
    this.name = DEFAULT_NAME;
    this.docs = [];
    this.labels = [];
    this.excerpts = [];
    this.comments = [];
    this.mediaMeta = {};
    this.tracks = [];
    this.activeDocId = null;
    this.selectedExcerptId = null;
    this.focus = null;
    this.syncExtent();
  }
}

export const store = new AppStore();
