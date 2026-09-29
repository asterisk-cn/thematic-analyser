<script lang="ts">
  import { highlightBackground, speakerColor, type Piece } from '../lib/analysis';
  import { fmtTime } from '../lib/time';
  import type { Excerpt, Label, Segment } from '../types';

  let {
    seg,
    idx,
    active,
    pieces,
    notes,
    selectedExcerptId,
    onseek,
    onpick,
  }: {
    seg: Segment;
    idx: number;
    active: boolean;
    pieces: Piece[];
    notes: { ex: Excerpt; label?: Label; path: string }[];
    selectedExcerptId: string | null;
    onseek: (idx: number) => void;
    onpick: (exIds: string[]) => void;
  } = $props();
</script>

<div class="seg" class:active data-row-idx={idx}>
  <button class="seg-time" onclick={() => onseek(idx)} disabled={seg.start == null} tabindex="-1">
    {seg.start == null ? '·' : fmtTime(seg.start)}
  </button>
  <div class="seg-body">
    {#if seg.speaker}
      <span class="seg-speaker" style:color={speakerColor(seg.speaker)}>{seg.speaker}</span>
    {/if}
    <!-- 選択位置の計算に textContent を使うため、この span の中には空白を入れないこと -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <span class="seg-text" data-seg-idx={idx}>{#each pieces as p, i (i)}{#if p.exIds.length || p.pending}<span class="hl" class:pending={p.pending} class:sel={!!selectedExcerptId && p.exIds.includes(selectedExcerptId)} style:background-image={highlightBackground(p.colors)} onclick={() => p.exIds.length && onpick(p.exIds)}>{p.text}</span>{:else}{p.text}{/if}{/each}</span>
  </div>
  <div class="seg-notes">
    {#each notes as { ex, label, path } (ex.id)}
      <button
        class="note"
        class:sel={ex.id === selectedExcerptId}
        class:unlabeled={!label}
        style:--c={label?.color ?? '#b9b1a3'}
        onclick={() => onpick([ex.id])}
        title={[path && `ラベル：${path}`, ex.memo && `メモ：${ex.memo}`].filter(Boolean).join('\n') || ex.text}
      >
        <span class="note-code">{ex.code || 'コード未記入'}</span>
        {#if label}<span class="note-label">{label.name}</span>{/if}
        {#if ex.memo}<i class="memo-dot" title="メモあり"></i>{/if}
      </button>
    {/each}
  </div>
</div>
