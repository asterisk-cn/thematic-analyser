<script lang="ts">
  import { store } from './store.svelte';
  import { engine } from './lib/engine.svelte';
  import { openFiles } from './lib/files';
  import Header from './components/Header.svelte';
  import MediaPanel from './components/MediaPanel.svelte';
  import TranscriptView from './components/TranscriptView.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Timeline from './components/Timeline.svelte';
  import LabelBoard from './components/labels/LabelBoard.svelte';

  let dragging = $state(false);
  let depth = 0;

  const isTyping = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  function onKey(e: KeyboardEvent) {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (store.page === 'label') {
      if (e.key === 'Escape') store.clearSelection();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      engine.toggle();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      engine.nudge(e.shiftKey ? -1 : -5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      engine.nudge(e.shiftKey ? 1 : 5);
    } else if (e.key === 'Escape') {
      store.selectedExcerptId = null;
    }
  }
</script>

<svelte:window
  onkeydown={onKey}
  ondragenter={(e) => {
    if (!hasFiles(e)) return;
    depth++;
    dragging = true;
  }}
  ondragleave={(e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) dragging = false;
  }}
  ondragover={(e) => {
    if (hasFiles(e)) e.preventDefault();
  }}
  ondrop={(e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    dragging = false;
    openFiles([...(e.dataTransfer?.files ?? [])]);
  }}
/>

<div class="app" class:board-page={store.page === 'label'}>
  <Header />
  {#if store.page === 'code'}
    <main class="main">
      <MediaPanel />
      <TranscriptView />
      <Sidebar />
    </main>
    <Timeline />
  {:else}
    <LabelBoard />
  {/if}

  <div class="toasts" aria-live="polite">
    {#each store.toasts as t (t.id)}
      <button class="toast {t.kind}" onclick={() => store.dismissToast(t.id)}>{t.msg}</button>
    {/each}
  </div>

  {#if dragging}
    <div class="drop-overlay">
      <div>
        <b>ここにドロップ</b>
        <span>トランスクリプト (.txt .json .srt .vtt) ・動画・音声・プロジェクト (.json)</span>
      </div>
    </div>
  {/if}
</div>
