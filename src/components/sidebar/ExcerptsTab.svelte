<script lang="ts">
  import { store } from '../../store.svelte';
  import { excerptMatchesFocus, sortExcerpts } from '../../lib/analysis';
  import ExcerptCard from './ExcerptCard.svelte';

  let q = $state('');
  let docFilter = $state('');
  let blankOnly = $state(false);

  const list = $derived.by(() => {
    const k = q.trim().toLowerCase();
    return sortExcerpts(
      store.excerpts.filter(
        (e) =>
          excerptMatchesFocus(e, store.focus, store.focusIds) &&
          (!docFilter || e.docId === docFilter) &&
          (!blankOnly || !e.code.trim()) &&
          (!k || e.text.toLowerCase().includes(k) || e.code.toLowerCase().includes(k) || e.memo.toLowerCase().includes(k)),
      ),
      store.docs,
    );
  });

  // 選択された切片のカードを見える位置へ
  let listEl: HTMLUListElement | undefined = $state();
  $effect(() => {
    const id = store.selectedExcerptId;
    if (!id || !listEl) return;
    listEl.querySelector(`[data-ex-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
</script>

<div class="tab-body">
  <div class="ex-filters">
    <input type="search" placeholder="コード・切片・メモを検索" bind:value={q} />
    <select bind:value={docFilter}>
      <option value="">すべてのドキュメント</option>
      {#each store.docs as d (d.id)}
        <option value={d.id}>{d.name}</option>
      {/each}
    </select>
  </div>
  <div class="ex-count">
    {list.length} 件
    <label class="toggle"><input type="checkbox" bind:checked={blankOnly} /><span>コード未記入のみ</span></label>
  </div>
  {#if list.length}
    <ul class="ex-list" bind:this={listEl}>
      {#each list as e (e.id)}
        <ExcerptCard ex={e} selected={e.id === store.selectedExcerptId} />
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <p class="empty-title">コードがありません</p>
      <p>トランスクリプトで文章をドラッグ選択し、その切片が言っていることをコードとして書きます。</p>
    </div>
  {/if}
</div>
