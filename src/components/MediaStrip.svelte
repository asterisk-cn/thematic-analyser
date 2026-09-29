<script lang="ts">
  import { store } from '../store.svelte';
  import { ACCEPT, openFiles } from '../lib/files';
  import TrackCard from './TrackCard.svelte';

  let input: HTMLInputElement;
  const ghosts = $derived.by(() => {
    const loaded = new Set(store.tracks.map((t) => t.name));
    return Object.values(store.mediaMeta).filter((m) => !loaded.has(m.name));
  });
</script>

<div class="media-strip" class:collapsed={store.mediaCollapsed}>
  <div class="strip-head">
    <button
      class="strip-toggle"
      onclick={() => (store.mediaCollapsed = !store.mediaCollapsed)}
      aria-expanded={!store.mediaCollapsed}
      title={store.mediaCollapsed ? 'メディアを表示' : 'メディアを折りたたむ'}
    >
      {store.mediaCollapsed ? '▸' : '▾'} メディア <em>{store.tracks.length}</em>
    </button>
    <button class="strip-add" onclick={() => input.click()}>＋ 動画・音声</button>
    <input
      bind:this={input}
      type="file"
      multiple
      accept={ACCEPT}
      hidden
      onchange={(e) => {
        openFiles([...(e.currentTarget.files ?? [])]);
        e.currentTarget.value = '';
      }}
    />
    {#if ghosts.length}
      <span class="strip-ghosts" title="同じファイル名で読み込むと同期設定を復元します">
        前回のメディア：{ghosts.map((g) => g.name).join('、')}
      </span>
    {/if}
  </div>
  <!-- 折りたたんでも要素は残す（再生を続けるため） -->
  <div class="strip-body" hidden={store.mediaCollapsed}>
    {#each store.tracks as t, i (t.id)}
      <TrackCard track={t} index={i} />
    {:else}
      <p class="strip-empty">動画・音声ファイルを読み込むと、ここに並んで同時に再生されます（画面へのドロップでも可）</p>
    {/each}
  </div>
</div>
