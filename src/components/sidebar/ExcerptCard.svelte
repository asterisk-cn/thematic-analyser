<script lang="ts">
  import { store } from '../../store.svelte';
  import { engine } from '../../lib/engine.svelte';
  import { excerptTime, speakerOf } from '../../lib/analysis';
  import { labelPath } from '../../lib/labels';
  import { fmtTime } from '../../lib/time';
  import type { Excerpt } from '../../types';

  let { ex, selected }: { ex: Excerpt; selected: boolean } = $props();

  const doc = $derived(store.docs.find((d) => d.id === ex.docId));
  const t = $derived(excerptTime(doc, ex));
  const sp = $derived(speakerOf(doc, ex));
  const path = $derived(labelPath(store.labels, ex.labelId));
  const color = $derived(path.at(-1)?.color ?? '#b9b1a3');

  function jump() {
    // 先にドキュメントを切り替えて、タイムラインの長さを更新してからシークする
    store.setActiveDoc(ex.docId);
    store.selectedExcerptId = ex.id;
    store.requestScroll(ex.docId, ex.startSeg);
    if (t.start != null) engine.seek(t.start);
  }
</script>

<li class="ex-card" class:sel={selected} style:--c={color} data-ex-id={ex.id}>
  <button class="ex-main" onclick={jump}>
    <span class="ex-meta">
      <span class="ex-doc">{doc?.name}</span>
      {#if t.start != null}<span class="ex-time">{fmtTime(t.start)}</span>{/if}
      {#if sp}<span class="ex-sp">{sp}</span>{/if}
    </span>
    <span class="ex-text">{ex.text}</span>
  </button>
  <div class="ex-code">
    <span class="ex-code-mark" aria-hidden="true">→</span>
    <textarea
      rows="1"
      value={ex.code}
      placeholder="この切片が言っていること（コード）"
      aria-label="コード"
      oninput={(e) => {
        store.updateExcerpt(ex.id, { code: e.currentTarget.value });
        e.currentTarget.style.height = 'auto';
        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
      }}
      onfocus={() => (store.selectedExcerptId = ex.id)}
    ></textarea>
  </div>
  {#if path.length}
    <div class="ex-label">
      <span class="ex-path">
        {#each path as l, i (l.id)}{#if i}<i>›</i>{/if}<span style:--c={l.color}>{l.name}</span>{/each}
      </span>
    </div>
  {/if}
  {#if selected}
    <div class="ex-detail">
      <label class="field">
        <span>分析メモ</span>
        <textarea
          rows="3"
          value={ex.memo}
          placeholder="解釈、疑問、他の箇所とのつながりなど"
          oninput={(e) => store.updateExcerpt(ex.id, { memo: e.currentTarget.value })}
        ></textarea>
      </label>
      <div class="ex-actions">
        {#if t.start != null}
          <button
            class="btn btn-small"
            onclick={() => {
              engine.seek(t.start!);
              engine.play();
            }}>▶ この箇所を再生</button
          >
        {/if}
        <button class="btn btn-small btn-danger" onclick={() => store.deleteExcerpt(ex.id)}>切片を削除</button>
      </div>
    </div>
  {/if}
</li>
