<script lang="ts">
  import { store } from '../../store.svelte';
  import { engine } from '../../lib/engine.svelte';
  import { excerptTime, speakerColor } from '../../lib/analysis';
  import { labelPath } from '../../lib/labels';
  import { fmtTime } from '../../lib/time';

  const CONTEXT = 2;

  const ex = $derived(store.excerpts.find((e) => e.id === store.selectedExcerptId));
  const doc = $derived(ex ? store.docs.find((d) => d.id === ex.docId) : undefined);
  const t = $derived(ex ? excerptTime(doc, ex) : { start: null, end: null });
  const path = $derived(ex ? labelPath(store.labels, ex.labelId) : []);

  /** 切片の前後の発話も含めて、切片の部分だけ強調して表示する */
  const rows = $derived.by(() => {
    if (!ex || !doc) return [];
    const from = Math.max(0, ex.startSeg - CONTEXT);
    const to = Math.min(doc.segments.length - 1, ex.endSeg + CONTEXT);
    return doc.segments.slice(from, to + 1).map((seg, k) => {
      const i = from + k;
      const inside = i >= ex.startSeg && i <= ex.endSeg;
      const a = !inside ? 0 : i === ex.startSeg ? ex.startOff : 0;
      const b = !inside ? 0 : i === ex.endSeg ? ex.endOff : seg.text.length;
      return { seg, inside, before: seg.text.slice(0, a), hit: seg.text.slice(a, b), after: seg.text.slice(b) };
    });
  });

  function openInCoding() {
    if (!ex) return;
    store.setActiveDoc(ex.docId);
    store.requestScroll(ex.docId, ex.startSeg);
    store.setPage('code');
    if (t.start != null) engine.seek(t.start);
  }
</script>

<aside class="panel context-panel">
  <div class="panel-head"><h2>文脈</h2></div>
  <div class="panel-body context-body">
    {#if !ex}
      <div class="empty">
        <p class="empty-title">コードを選ぶと、元の発話が表示されます</p>
        <p>ラベルに入れる前に、切片の前後の文脈を確認できます。</p>
      </div>
    {:else}
      <div class="ctx-meta">
        <span>{doc?.name}</span>
        {#if t.start != null}<span class="ex-time">{fmtTime(t.start)}</span>{/if}
      </div>
      <div class="ctx-text">
        {#each rows as r (r.seg.id)}
          <p class:inside={r.inside}>
            {#if r.seg.speaker}<b style:color={speakerColor(r.seg.speaker)}>{r.seg.speaker}</b>{/if}
            {r.before}{#if r.hit}<mark>{r.hit}</mark>{/if}{r.after}
          </p>
        {/each}
      </div>
      <label class="field">
        <span>コード</span>
        <textarea
          class="ctx-code"
          rows="2"
          value={ex.code}
          placeholder="この切片が言っていること"
          oninput={(e) => store.updateExcerpt(ex.id, { code: e.currentTarget.value })}
        ></textarea>
      </label>
      <div class="field">
        <span>ラベル</span>
        {#if path.length}
          <span class="ex-path">
            {#each path as l, i (l.id)}{#if i}<i>›</i>{/if}<span style:--c={l.color}>{l.name}</span>{/each}
          </span>
        {:else}
          <span class="muted">未付与（中央のラベルへドラッグ）</span>
        {/if}
      </div>
      <label class="field">
        <span>分析メモ</span>
        <textarea
          rows="3"
          value={ex.memo}
          placeholder="解釈、疑問、他の箇所とのつながりなど"
          oninput={(e) => store.updateExcerpt(ex.id, { memo: e.currentTarget.value })}
        ></textarea>
      </label>
      <button class="btn btn-small" onclick={openInCoding}>① コーディング画面で開く →</button>
    {/if}
  </div>
</aside>
