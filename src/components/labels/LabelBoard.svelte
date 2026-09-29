<script lang="ts">
  import { store } from '../../store.svelte';
  import { flatten } from '../../lib/labels';
  import { sortExcerpts } from '../../lib/analysis';
  import { buildBoardFilter, POOL_PAGE } from '../../lib/boardFilter';
  import AddForm from '../sidebar/AddForm.svelte';
  import BoardCode from './BoardCode.svelte';
  import BoardLabel from './BoardLabel.svelte';
  import ContextPanel from './ContextPanel.svelte';
  import DropZone from './DropZone.svelte';
  import CommentsPanel from '../CommentsPanel.svelte';

  let q = $state('');
  let groupName = $state('');
  let moveTarget = $state('');
  let collapseAll = $state({ v: false, n: 0 });
  let treeQ = $state('');
  let poolLimit = $state(POOL_PAGE);

  const filter = $derived(buildBoardFilter(treeQ, store.labels, store.excerpts));
  const noHit = $derived(!!filter && filter.visible.size === 0);

  const loose = $derived.by(() => {
    const ids = new Set(store.labels.map((l) => l.id));
    const k = q.trim().toLowerCase();
    return sortExcerpts(
      store.excerpts.filter(
        (e) => (!e.labelId || !ids.has(e.labelId)) && (!k || e.code.toLowerCase().includes(k) || e.text.toLowerCase().includes(k)),
      ),
      store.docs,
    );
  });
  // 検索語が変わったら先頭から表示し直す
  $effect(() => {
    void q;
    poolLimit = POOL_PAGE;
  });
  const labelComments = $derived(store.comments.filter((c) => c.target.kind === 'label').length);
  const looseTotal = $derived(store.excerpts.filter((e) => !e.labelId || !store.labelMap.has(e.labelId)).length);

  const nSel = $derived(store.selExcerpts.size + store.selLabels.size);
  const targets = $derived(flatten(store.labelTree).filter((n) => !store.selLabels.has(n.label.id)));

  function group(e: SubmitEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;
    const l = store.groupSelection(groupName);
    store.toast(`「${l.name}」にまとめました`);
    groupName = '';
  }

  function move() {
    const failed = store.moveSelection(moveTarget || null);
    if (failed) store.toast(`${failed} 件のラベルは自分の配下へは移動できませんでした`, 'error');
    moveTarget = '';
  }
</script>

<main class="board">
  <section class="panel pool-panel">
    <div class="left-tabs" role="tablist">
      <button role="tab" aria-selected={store.boardLeftTab === 'pool'} class:on={store.boardLeftTab === 'pool'} onclick={() => (store.boardLeftTab = 'pool')}>
        未付与のコード<em>{looseTotal}</em>
      </button>
      <button
        role="tab"
        aria-selected={store.boardLeftTab === 'comments'}
        class:on={store.boardLeftTab === 'comments'}
        onclick={() => (store.boardLeftTab = 'comments')}
      >
        コメント<em>{labelComments}</em>
      </button>
    </div>
    {#if store.boardLeftTab === 'comments'}
      <div class="panel-body"><CommentsPanel mode="label" /></div>
    {:else}
    <div class="pool-tools">
      <input type="search" placeholder="コード・切片を検索" bind:value={q} />
    </div>
    <DropZone labelId={null} class="panel-body pool-body">
      {#each loose.slice(0, poolLimit) as ex (ex.id)}
        <BoardCode {ex} showQuote />
      {:else}
        <div class="empty">
          {#if looseTotal}
            <p>「{q}」に一致するコードはありません</p>
          {:else if store.excerpts.length}
            <p class="empty-title">すべてのコードにラベルが付きました</p>
            <p>ラベルをここへドラッグすると、ラベルを外せます（ラベルならトップレベルへ）。</p>
          {:else}
            <p class="empty-title">まだコードがありません</p>
            <p>「① コーディング」で切片を選び、コードを書きましょう。</p>
          {/if}
        </div>
      {/each}
      {#if loose.length > poolLimit}
        <button class="more-btn" onclick={() => (poolLimit += POOL_PAGE)}>
          さらに表示（残り {loose.length - poolLimit} 件）
        </button>
      {/if}
    </DropZone>
    {/if}
  </section>

  <section class="panel tree-panel">
    <div class="panel-head">
      <h2>ラベル <em>{store.labels.length}</em></h2>
    </div>
    <div class="tree-tools">
      <input type="search" placeholder="ラベル・コードを検索" bind:value={treeQ} />
      {#if store.labels.length && !filter}
        <button class="btn btn-small btn-ghost" onclick={() => (collapseAll = { v: true, n: collapseAll.n + 1 })}>すべて閉じる</button>
        <button class="btn btn-small btn-ghost" onclick={() => (collapseAll = { v: false, n: collapseAll.n + 1 })}>すべて開く</button>
      {/if}
    </div>

    {#if nSel}
      <div class="sel-bar">
        <span class="sel-count">
          {#if store.selExcerpts.size}コード <b>{store.selExcerpts.size}</b>{/if}
          {#if store.selExcerpts.size && store.selLabels.size}・{/if}
          {#if store.selLabels.size}ラベル <b>{store.selLabels.size}</b>{/if}
          件を選択中
        </span>
        <form class="sel-group" onsubmit={group}>
          <input bind:value={groupName} placeholder="新しいラベル名" />
          <button class="btn btn-small btn-ink" type="submit" disabled={!groupName.trim()}>新しいラベルでまとめる</button>
        </form>
        <div class="sel-move">
          <select bind:value={moveTarget} aria-label="移動先">
            <option value="">（ラベルなし／トップレベル）</option>
            {#each targets as n (n.label.id)}
              <option value={n.label.id}>{'　'.repeat(n.depth)}{n.depth ? '└ ' : ''}{n.label.name}</option>
            {/each}
          </select>
          <button class="btn btn-small" onclick={move}>へ移動</button>
        </div>
        <button class="btn btn-small btn-ghost" onclick={() => store.clearSelection()}>選択解除 <kbd>Esc</kbd></button>
      </div>
    {/if}

    <div class="panel-body tree-body">
      <AddForm placeholder="新しいラベル（トップレベル）" onadd={(n) => store.addLabel(n)} />
      <div class="label-tree" role="tree">
        {#each store.labelTree as node (node.label.id)}
          <BoardLabel {node} {collapseAll} {filter} />
        {:else}
          <div class="empty">
            <p class="empty-title">ラベルを作りましょう</p>
            <p>
              左のコードを選んで「新しいラベルでまとめる」か、ラベルを作ってコードをドラッグします。
              ラベル同士も選んでまとめたり、⋮⋮ をドラッグして入れ子にしたりして階層を作れます。
            </p>
          </div>
        {/each}
        {#if noHit}<div class="empty">「{treeQ}」に一致するラベル・コードはありません</div>{/if}
      </div>
    </div>
  </section>

  <ContextPanel />
</main>
