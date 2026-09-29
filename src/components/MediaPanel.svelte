<script lang="ts">
  import { store } from '../store.svelte';
  import { ACCEPT, openFiles } from '../lib/files';
  import TrackCard from './TrackCard.svelte';

  let input: HTMLInputElement;
  const videos = $derived(store.tracks.filter((t) => t.kind === 'video'));
  const audios = $derived(store.tracks.filter((t) => t.kind === 'audio'));
  const ghosts = $derived.by(() => {
    const loaded = new Set(store.tracks.map((t) => t.name));
    return Object.values(store.mediaMeta).filter((m) => !loaded.has(m.name));
  });
</script>

<section class="panel media-panel">
  <div class="panel-head">
    <h2>メディア <em>{store.tracks.length}</em></h2>
    <button class="btn btn-small" onclick={() => input.click()}>＋ 動画・音声</button>
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
  </div>

  <div class="panel-body media-body">
    {#if store.tracks.length === 0}
      <div class="empty media-empty">
        <p class="empty-title">映像と音声を並べて再生</p>
        <p>
          複数の動画・音声ファイルを読み込むと、1 本のタイムラインで同時に再生されます。
          ずれている場合は「開始」の値か、下のタイムラインのバーをドラッグして合わせます。
        </p>
      </div>
    {/if}
    <div class="video-grid n{Math.min(videos.length, 4)}">
      {#each videos as t (t.id)}
        <TrackCard track={t} index={store.tracks.indexOf(t)} />
      {/each}
    </div>
    {#each audios as t (t.id)}
      <TrackCard track={t} index={store.tracks.indexOf(t)} />
    {/each}
    {#if ghosts.length}
      <div class="ghosts">
        <p>前回のメディア（同じファイル名で読み込むと同期設定を復元）</p>
        {#each ghosts as g (g.name)}
          <div class="ghost" title={g.name}>
            <span>{g.name}</span>
            <code>{g.offset >= 0 ? '+' : ''}{g.offset.toFixed(2)}s</code>
            <button class="icon-btn" title="記録を削除" onclick={() => store.forgetMedia(g.name)}>×</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
