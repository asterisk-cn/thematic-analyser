<script lang="ts">
  import { store } from '../../store.svelte';
  import { EXCERPT_MIME, startDrag } from '../../lib/dnd';
  import { speakerOf } from '../../lib/analysis';
  import type { Excerpt } from '../../types';

  let { ex, showQuote = false }: { ex: Excerpt; showQuote?: boolean } = $props();

  const checked = $derived(store.selExcerpts.has(ex.id));
  const active = $derived(store.selectedExcerptId === ex.id);
  const color = $derived((ex.labelId && store.labelMap.get(ex.labelId)?.color) || '#b9b1a3');
  const doc = $derived(store.docs.find((d) => d.id === ex.docId));
  const speaker = $derived(speakerOf(doc, ex));

  function onclick(e: MouseEvent) {
    store.selectedExcerptId = ex.id;
    store.toggleSelExcerpt(ex.id, e.metaKey || e.ctrlKey || e.shiftKey);
  }
</script>

<div
  class="board-code"
  class:checked
  class:active
  class:blank={!ex.code}
  style:--c={color}
  draggable="true"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (store.selectedExcerptId = ex.id))}
  ondragstart={(e) => startDrag(e, EXCERPT_MIME, checked ? [...store.selExcerpts] : [ex.id])}
  title="クリックで選択（Ctrl/⌘/Shift で複数）・ドラッグでラベルへ"
>
  <input
    type="checkbox"
    {checked}
    onclick={(e) => {
      e.stopPropagation();
      store.toggleSelExcerpt(ex.id, true);
    }}
    aria-label="選択"
  />
  <div class="bc-body">
    <span class="bc-code">{ex.code || 'コード未記入'}</span>
    {#if showQuote}
      <span class="bc-quote">「{ex.text.length > 60 ? ex.text.slice(0, 60) + '…' : ex.text}」</span>
    {/if}
    <span class="bc-meta">{doc?.name}{speaker ? ` · ${speaker}` : ''}</span>
  </div>
</div>
