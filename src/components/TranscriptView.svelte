<script lang="ts">
  import { untrack } from 'svelte';
  import { store } from '../store.svelte';
  import { engine } from '../lib/engine.svelte';
  import { excerptMatchesFocus, segmentPieces, textForSpan, type Span } from '../lib/analysis';
  import { ACCEPT, openFiles } from '../lib/files';
  import { loadSample } from '../lib/sample';
  import type { Excerpt } from '../types';
  import { pathText } from '../lib/labels';
  import SegmentRow from './SegmentRow.svelte';
  import SelectionPopover from './SelectionPopover.svelte';

  let list: HTMLDivElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();
  let follow = $state(true);
  let query = $state('');
  let pending = $state.raw<{ span: Span; x: number; y: number; text: string } | null>(null);

  const doc = $derived(store.activeDoc);

  // 再生位置 → アクティブ行（数値なので、行が変わったときだけ下流が更新される）
  const starts = $derived.by(() => {
    if (!doc) return [];
    return doc.segments
      .map((s, i) => ({ t: s.start, i }))
      .filter((x): x is { t: number; i: number } => x.t != null)
      .sort((a, b) => a.t - b.t);
  });
  const activeIdx = $derived.by(() => {
    if (!doc) return -1;
    const t = engine.snap.time - doc.offset;
    let lo = 0;
    let hi = starts.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid].t <= t + 0.01) {
        found = starts[mid].i;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  });

  $effect(() => {
    const idx = activeIdx;
    if (!follow || idx < 0 || pending || !untrack(() => engine.snap.playing)) return;
    list?.querySelector(`[data-row-idx="${idx}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  let handled = 0;
  $effect(() => {
    const req = store.scrollReq;
    if (!req || !doc || req.n === handled) return;
    if (req.docId !== doc.id) {
      store.setActiveDoc(req.docId);
      return;
    }
    handled = req.n;
    const el = list?.querySelector<HTMLElement>(`[data-row-idx="${req.seg}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
  });

  const docExcerpts = $derived(
    doc ? store.excerpts.filter((e) => e.docId === doc.id && excerptMatchesFocus(e, store.focus, store.focusIds)) : [],
  );
  const docExcerptCount = $derived(doc ? store.excerpts.filter((e) => e.docId === doc.id).length : 0);

  const rows = $derived.by(() => {
    if (!doc) return [];
    const k = query.trim().toLowerCase();
    const byStart = new Map<number, Excerpt[]>();
    docExcerpts.forEach((e) => byStart.set(e.startSeg, [...(byStart.get(e.startSeg) ?? []), e]));
    const labelMap = store.labelMap;
    return doc.segments
      .map((seg, idx) => ({ seg, idx }))
      .filter(({ seg }) => !k || seg.text.toLowerCase().includes(k) || (seg.speaker ?? '').toLowerCase().includes(k))
      .map(({ seg, idx }) => ({
        seg,
        idx,
        pieces: segmentPieces(seg, idx, docExcerpts, labelMap, pending?.span ?? null),
        notes: (byStart.get(idx) ?? []).map((ex) => ({
          ex,
          label: ex.labelId ? labelMap.get(ex.labelId) : undefined,
          path: pathText(store.labels, ex.labelId),
        })),
      }));
  });

  function onseek(idx: number) {
    const s = doc?.segments[idx];
    if (doc && s?.start != null) engine.seek(s.start + doc.offset);
  }

  function onpick(exIds: string[]) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const found = exIds
      .map((id) => store.excerpts.find((e) => e.id === id))
      .filter((e): e is Excerpt => !!e)
      .sort((a, b) => a.text.length - b.text.length);
    if (!found.length) return;
    const i = found.findIndex((e) => e.id === store.selectedExcerptId);
    store.selectedExcerptId = found[(i + 1) % found.length].id;
  }

  function onmouseup() {
    const root = list;
    const sel = window.getSelection();
    if (!root || !doc || !sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const texts = [...root.querySelectorAll<HTMLElement>('[data-seg-idx]')].filter((el) => range.intersectsNode(el));
    if (!texts.length) return;
    const first = texts[0];
    const last = texts[texts.length - 1];
    const offsetIn = (el: HTMLElement, node: Node, off: number) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.setEnd(node, off);
      return r.toString().length;
    };
    let startSeg = +first.dataset.segIdx!;
    let startOff = first.contains(range.startContainer) ? offsetIn(first, range.startContainer, range.startOffset) : 0;
    let endSeg = +last.dataset.segIdx!;
    let endOff = last.contains(range.endContainer)
      ? offsetIn(last, range.endContainer, range.endOffset)
      : (last.textContent ?? '').length;

    // 前後の空白を除外
    const t0 = doc.segments[startSeg].text;
    while (startOff < t0.length && /\s/.test(t0[startOff])) startOff++;
    if (startOff >= t0.length && startSeg < endSeg) {
      startSeg++;
      startOff = 0;
    }
    const t1 = doc.segments[endSeg].text;
    while (endOff > 0 && /\s/.test(t1[endOff - 1])) endOff--;
    if (endOff === 0 && endSeg > startSeg) {
      endSeg--;
      endOff = doc.segments[endSeg].text.length;
    }
    if (startSeg > endSeg || (startSeg === endSeg && startOff >= endOff)) return;

    const span = { startSeg, startOff, endSeg, endOff };
    const rect = range.getBoundingClientRect();
    pending = { span, x: rect.left + rect.width / 2, y: rect.bottom, text: textForSpan(doc, span) };
  }

  $effect(() => {
    if (!pending) return;
    const close = () => (pending = null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  });

  function apply(code: string) {
    if (!pending || !doc) return;
    const ex = store.addExcerpt({ docId: doc.id, ...pending.span, text: pending.text, code, labelId: null });
    store.selectedExcerptId = ex.id;
    window.getSelection()?.removeAllRanges();
    pending = null;
  }

  function closeDoc(id: string, name: string) {
    const n = store.excerpts.filter((e) => e.docId === id).length;
    if (confirm(`「${name}」を削除しますか？${n ? `\nこのドキュメントの抜粋 ${n} 件も削除されます。` : ''}`)) store.removeDoc(id);
  }
</script>

<section class="panel transcript-panel">
  {#if !doc}
    <div class="welcome">
      <p class="welcome-kicker">No. 01 — はじめに</p>
      <h1>データを読み、<br /><span class="marker">意味のまとまり</span>を見つける。</h1>
      <p class="welcome-lead">
        トランスクリプトを読み込み、気になる箇所を選んで「その切片が言っていること」をコードとして書きます。
        コードへのラベル付けと階層づくりは「② ラベル整理」ページで行います。
      </p>
      <div class="welcome-actions">
        <button class="btn btn-ink btn-lg" onclick={() => fileInput?.click()}>ファイルを選ぶ</button>
        <button class="btn btn-lg" onclick={loadSample}>サンプルで試す</button>
        <input
          bind:this={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onchange={(e) => {
            openFiles([...(e.currentTarget.files ?? [])]);
            e.currentTarget.value = '';
          }}
        />
      </div>
      <p class="welcome-drop">またはこの画面にファイルをドロップ</p>
      <dl class="formats">
        <div>
          <dt>.txt / .md</dt>
          <dd>1 行 = 1 発話。<code>[00:01:23] 話者: 本文</code> のような時刻・話者を自動認識</dd>
        </div>
        <div>
          <dt>.json</dt>
          <dd><code>[{'{'}start, end, speaker, text{'}'}]</code>、Whisper の <code>segments</code>、<code>utterances</code> など</dd>
        </div>
        <div>
          <dt>.srt / .vtt</dt>
          <dd>字幕ファイル（VTT の話者タグにも対応）</dd>
        </div>
        <div>
          <dt>動画・音声</dt>
          <dd>mp4 / webm / mov / mp3 / wav / m4a など。複数を同時再生</dd>
        </div>
      </dl>
    </div>
  {:else}
    <div class="doc-tabs" role="tablist">
      {#each store.docs as d (d.id)}
        <div class="doc-tab" class:on={d.id === doc.id} role="tab" aria-selected={d.id === doc.id} tabindex="-1">
          <button class="doc-tab-name" onclick={() => store.setActiveDoc(d.id)} title={d.name}>{d.name}</button>
          <button class="doc-tab-x" title="このトランスクリプトを閉じる" onclick={() => closeDoc(d.id, d.name)}>×</button>
        </div>
      {/each}
    </div>

    <div class="doc-toolbar">
      <input class="search" type="search" placeholder="本文・話者を検索" bind:value={query} />
      <label class="offset-field" title="トランスクリプトの 0 秒がタイムライン上のどこにあたるか">
        時刻補正
        <input
          type="number"
          step="0.1"
          value={doc.offset}
          oninput={(e) => store.updateDoc(doc.id, { offset: +e.currentTarget.value || 0 })}
        />
        s
      </label>
      <label class="toggle">
        <input type="checkbox" bind:checked={follow} />
        <span>再生に追従</span>
      </label>
      <span class="doc-count">{doc.segments.length} 行 · 抜粋 {docExcerptCount}</span>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="seg-list" bind:this={list} {onmouseup}>
      {#each rows as r (r.seg.id)}
        <SegmentRow
          seg={r.seg}
          idx={r.idx}
          active={r.idx === activeIdx}
          pieces={r.pieces}
          notes={r.notes}
          selectedExcerptId={store.selectedExcerptId}
          {onseek}
          {onpick}
        />
      {:else}
        <div class="empty">「{query}」に一致する行はありません</div>
      {/each}
    </div>

    {#if pending}
      <SelectionPopover x={pending.x} y={pending.y} preview={pending.text} onapply={apply} onclose={() => (pending = null)} />
    {/if}
  {/if}
</section>
