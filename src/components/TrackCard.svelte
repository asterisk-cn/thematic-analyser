<script lang="ts">
  import { untrack } from 'svelte';
  import { store } from '../store.svelte';
  import { engine } from '../lib/engine.svelte';
  import { fmtTime } from '../lib/time';
  import type { Track } from '../types';

  let { track, index }: { track: Track; index: number } = $props();
  let el: HTMLMediaElement | undefined = $state();

  // 要素の登録（トラック ID ごとに 1 回）
  $effect(() => {
    if (!el) return;
    const id = track.id;
    return engine.register(id, el, untrack(() => track.offset));
  });
  $effect(() => engine.setOffset(track.id, track.offset));
  $effect(() => {
    if (!el) return;
    el.muted = track.muted;
    el.volume = track.volume;
  });

  const onMeta = (e: Event) => store.updateTrack(track.id, { duration: (e.currentTarget as HTMLMediaElement).duration });
  const setOffset = (v: number) => store.updateTrack(track.id, { offset: Math.round(v * 100) / 100 });
  const bars = Array.from({ length: 22 }, (_, i) => 20 + ((i * 37) % 70));
</script>

<figure class="track-card {track.kind}">
  {#if track.kind === 'video'}
    <div class="video-frame">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={el} src={track.url} playsinline preload="auto" onloadedmetadata={onMeta} onclick={() => engine.toggle()}></video>
      <span class="track-index">{String(index + 1).padStart(2, '0')}</span>
    </div>
  {:else}
    <div class="audio-frame">
      <audio bind:this={el} src={track.url} preload="auto" onloadedmetadata={onMeta}></audio>
      <span class="track-index">{String(index + 1).padStart(2, '0')}</span>
      <span class="audio-glyph" aria-hidden="true">
        {#each bars as h, i (i)}<i style:height="{h}%"></i>{/each}
      </span>
    </div>
  {/if}
  <figcaption>
    <div class="track-title" title={track.name}>
      {track.name}
      <span class="track-dur">{fmtTime(track.duration)}</span>
    </div>
    <div class="track-controls">
      <button class="chip-btn" class:on={track.muted} onclick={() => store.updateTrack(track.id, { muted: !track.muted })} title="ミュート">
        {track.muted ? 'ミュート中' : '音声'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={track.volume}
        oninput={(e) => store.updateTrack(track.id, { volume: +e.currentTarget.value })}
        aria-label="音量"
        class="vol"
      />
      <div class="offset-ctl" title="タイムライン上でこのメディアが始まる位置（秒）。下のタイムラインでバーをドラッグしても調整できます">
        <span>開始</span>
        <button onclick={() => setOffset(track.offset - 0.1)}>−</button>
        <input type="number" step="0.1" value={track.offset} oninput={(e) => setOffset(+e.currentTarget.value || 0)} />
        <button onclick={() => setOffset(track.offset + 0.1)}>＋</button>
      </div>
      <button class="icon-btn" onclick={() => store.removeTrack(track.id)} title="取り除く">×</button>
    </div>
  </figcaption>
</figure>
