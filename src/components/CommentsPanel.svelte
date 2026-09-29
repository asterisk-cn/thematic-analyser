<script lang="ts">
  import { store } from '../store.svelte';
  import { engine } from '../lib/engine.svelte';
  import { flatten, pathText } from '../lib/labels';
  import { fmtTime } from '../lib/time';
  import { commentKey, type CommentTarget } from '../types';
  import CommentThread from './CommentThread.svelte';

  /** segment: 開いているドキュメントの発話へのコメント／label: ラベルへのコメント */
  let { mode }: { mode: 'segment' | 'label' } = $props();

  interface Group {
    key: string;
    target: CommentTarget;
    title: string;
    sub: string;
    color?: string;
    count: number;
  }

  const doc = $derived(store.activeDoc);

  const groups = $derived.by((): Group[] => {
    const active = store.commentTarget;
    if (mode === 'segment') {
      if (!doc) return [];
      const segs = new Set<number>();
      for (const c of store.comments) if (c.target.kind === 'segment' && c.target.docId === doc.id) segs.add(c.target.seg);
      if (active?.kind === 'segment' && active.docId === doc.id) segs.add(active.seg);
      return [...segs]
        .filter((i) => doc.segments[i])
        .sort((a, b) => a - b)
        .map((i) => {
          const s = doc.segments[i];
          const target: CommentTarget = { kind: 'segment', docId: doc.id, seg: i };
          return {
            key: commentKey(target),
            target,
            title: [s.start != null ? fmtTime(s.start + doc.offset) : null, s.speaker].filter(Boolean).join(' · ') || `${i + 1} 行目`,
            sub: s.text,
            count: store.commentsOf(target).length,
          };
        });
    }
    const ids = new Set<string>();
    for (const c of store.comments) if (c.target.kind === 'label') ids.add(c.target.labelId);
    if (active?.kind === 'label') ids.add(active.labelId);
    // ラベルの木の順に並べる
    return flatten(store.labelTree)
      .filter((n) => ids.has(n.label.id))
      .map((n) => {
        const target: CommentTarget = { kind: 'label', labelId: n.label.id };
        const path = pathText(store.labels, n.label.parentId);
        return {
          key: commentKey(target),
          target,
          title: n.label.name,
          sub: path ? `${path} ›` : '',
          color: n.label.color,
          count: store.commentsOf(target).length,
        };
      });
  });

  const activeKey = $derived(store.commentTarget ? commentKey(store.commentTarget) : null);
  const total = $derived(groups.reduce((n, g) => n + g.count, 0));

  function jump(t: CommentTarget) {
    store.openComments(t);
    if (t.kind === 'segment') {
      store.requestScroll(t.docId, t.seg);
      const s = doc?.segments[t.seg];
      if (doc && s?.start != null) engine.seek(s.start + doc.offset);
    } else {
      document.querySelector(`[data-label-id="${t.labelId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // 開いた対象の欄を見える位置へ
  let listEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    const k = activeKey;
    if (!k || !listEl) return;
    listEl.querySelector(`[data-comment-key="${k}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
</script>

<div class="comments-list" bind:this={listEl}>
  {#if total}<div class="ex-count">{total} 件</div>{/if}
  {#each groups as g (g.key)}
    <section class="comment-group" class:active={g.key === activeKey} data-comment-key={g.key} style:--c={g.color ?? 'var(--ink-3)'}>
      <button class="cg-head" onclick={() => jump(g.target)}>
        {#if g.sub && mode === 'label'}<span class="cg-path">{g.sub}</span>{/if}
        <span class="cg-title">{g.title}</span>
        {#if mode === 'segment'}<span class="cg-sub">{g.sub}</span>{/if}
      </button>
      <CommentThread
        target={g.target}
        compose={g.key === activeKey}
        onclose={() => (store.commentTarget = null)}
      />
      {#if g.key !== activeKey}
        <button class="cg-reply" onclick={() => store.openComments(g.target)}>コメントを追加</button>
      {/if}
    </section>
  {:else}
    <div class="empty">
      <p class="empty-title">コメントはまだありません</p>
      <p>
        {mode === 'segment'
          ? '書き起こしの各行の 💬 から、その発話にコメントを付けられます。'
          : 'ラベルの 💬 から、そのラベルにコメントを付けられます。'}
      </p>
    </div>
  {/each}
</div>
