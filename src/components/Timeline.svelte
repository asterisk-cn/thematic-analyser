<script lang="ts">
  import { store } from '../store.svelte';
  import { engine } from '../lib/engine.svelte';
  import { excerptColor, excerptMatchesFocus, excerptTime } from '../lib/analysis';
  import { fmtTime } from '../lib/time';
  import type { Excerpt } from '../types';

  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

  let lanes: HTMLDivElement;

  const snap = $derived(engine.snap);
  const doc = $derived(store.activeDoc);
  const D = $derived(Math.max(snap.duration, 1));
  const pct = (t: number) => `${(t / D) * 100}%`;

  const ticks = $derived.by(() => {
    const step = STEPS.find((s) => D / s <= 10) ?? 3600;
    const out: number[] = [];
    for (let t = 0; t <= D; t += step) out.push(t);
    return out;
  });

  const marks = $derived.by(() => {
    if (!doc) return [];
    return store.excerpts
      .filter((e) => e.docId === doc.id && excerptMatchesFocus(e, store.focus, store.focusIds))
      .map((e) => ({ e, t: excerptTime(doc, e), color: excerptColor(e, store.labelMap) }))
      .filter((m) => m.t.start != null);
  });

  const segBlocks = $derived.by(() => {
    if (!doc) return [];
    return doc.segments
      .filter((s) => s.start != null)
      .slice(0, 3000)
      .map((s) => ({ a: s.start! + doc.offset, b: (s.end ?? s.start! + 2) + doc.offset }));
  });

  const timeAt = (clientX: number) => {
    const r = lanes.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * D;
  };

  function drag(e: PointerEvent, onMove: (ev: PointerEvent) => void) {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const up = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', up);
  }

  function onScrubStart(e: PointerEvent) {
    if (e.button !== 0) return;
    engine.seek(timeAt(e.clientX));
    drag(e, (ev) => engine.seek(timeAt(ev.clientX)));
  }

  function onBarDrag(e: PointerEvent, trackId: string, startOffset: number) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const D0 = D;
    const w = lanes.getBoundingClientRect().width;
    drag(e, (ev) => {
      let v = startOffset + ((ev.clientX - x0) / w) * D0;
      v = ev.shiftKey ? Math.round(v) : Math.round(v * 100) / 100;
      store.updateTrack(trackId, { offset: v });
    });
  }

  function jumpTo(ex: Excerpt, start: number) {
    store.selectedExcerptId = ex.id;
    store.requestScroll(ex.docId, ex.startSeg);
    engine.seek(start);
  }
</script>

<section class="deck">
  <div class="transport">
    <button class="t-btn" onclick={() => engine.seek(0)} title="先頭へ">⏮</button>
    <button class="t-btn" onclick={() => engine.nudge(-5)} title="5 秒戻る (←)">−5</button>
    <button class="t-play" onclick={() => engine.toggle()} title="再生 / 一時停止 (Space)">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {#if snap.playing}
          <path d="M4 2h3v12H4zM9 2h3v12H9z" fill="currentColor" />
        {:else}
          <path d="M4 2l10 6-10 6z" fill="currentColor" />
        {/if}
      </svg>
    </button>
    <button class="t-btn" onclick={() => engine.nudge(5)} title="5 秒進む (→)">+5</button>
    <div class="t-time">
      <b>{fmtTime(snap.time, true)}</b>
      <span>/ {fmtTime(snap.duration)}</span>
    </div>
    <div class="t-rates" role="group" aria-label="再生速度">
      {#each RATES as r (r)}
        <button class:on={r === snap.rate} onclick={() => engine.setRate(r)}>{r}×</button>
      {/each}
    </div>
    <div class="t-hint">
      <kbd>Space</kbd> 再生 <kbd>←</kbd><kbd>→</kbd> 5秒 <kbd>Shift</kbd>+ドラッグ 1秒単位
    </div>
  </div>

  <div class="tl">
    <div class="tl-labels">
      <div class="tl-label ruler-label">TIME</div>
      <div class="tl-label">
        <span class="lane-kind">TXT</span>
        <span class="lane-name">{doc?.name ?? '—'}</span>
      </div>
      {#each store.tracks as t, i (t.id)}
        <div class="tl-label">
          <span class="lane-kind">{t.kind === 'video' ? 'VID' : 'AUD'}</span>
          <span class="lane-name" title={t.name}>{String(i + 1).padStart(2, '0')} {t.name}</span>
        </div>
      {/each}
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="tl-lanes" bind:this={lanes} onpointerdown={onScrubStart}>
      <div class="tl-ruler">
        {#each ticks as t (t)}
          <span class="tick" style:left={pct(t)}>{fmtTime(t)}</span>
        {/each}
      </div>

      <div class="tl-lane txt-lane">
        {#each segBlocks as b, i (i)}
          <i class="seg-block" style:left={pct(b.a)} style:width={pct(Math.max(0.2, b.b - b.a))}></i>
        {/each}
        {#each marks as { e, t, color } (e.id)}
          <button
            class="ex-mark"
            class:sel={e.id === store.selectedExcerptId}
            style:left={pct(t.start!)}
            style:width={pct(Math.max(0.5, (t.end ?? t.start! + 2) - t.start!))}
            style:background={color}
            title={e.code || e.text}
            aria-label={e.code || e.text}
            onpointerdown={(ev) => ev.stopPropagation()}
            onclick={() => jumpTo(e, t.start!)}
          ></button>
        {/each}
      </div>

      {#each store.tracks as t (t.id)}
        <div class="tl-lane">
          <div
            class="track-bar {t.kind}"
            style:left={pct(t.offset)}
            style:width={pct(t.duration ?? D * 0.1)}
            onpointerdown={(e) => onBarDrag(e, t.id, t.offset)}
            title="ドラッグで開始位置を調整"
            role="slider"
            aria-label="{t.name} の開始位置"
            aria-valuenow={t.offset}
            tabindex="-1"
          >
            <span>{t.offset >= 0 ? '+' : ''}{t.offset.toFixed(2)}s</span>
          </div>
        </div>
      {/each}

      <div class="playhead" style:left={pct(snap.time)}><i></i></div>
    </div>
  </div>
</section>
