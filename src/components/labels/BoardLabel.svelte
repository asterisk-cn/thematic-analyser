<script lang="ts">
  import { store } from '../../store.svelte';
  import { EXCERPT_MIME, LABEL_MIME, draggedIds, dragging, dropPlace, endDrag, startDrag } from '../../lib/dnd';
  import { descendantIds } from '../../lib/labels';
  import type { LabelNode } from '../../lib/labels';
  import { CODE_LIMIT, type BoardFilter } from '../../lib/boardFilter';
  import ColorPicker from '../sidebar/ColorPicker.svelte';
  import BoardCode from './BoardCode.svelte';
  import BoardLabel from './BoardLabel.svelte';
  import DropZone from './DropZone.svelte';
  import CommentThread from '../CommentThread.svelte';

  let {
    node,
    collapseAll,
    filter,
  }: { node: LabelNode; collapseAll: { v: boolean; n: number }; filter: BoardFilter | null } = $props();
  const label = $derived(node.label);

  let collapsed = $state(false);
  let open = $state(false);
  let adding = $state(false);
  let childName = $state('');
  let showAll = $state(false);
  let commentsOpen = $state(false);
  const commentCount = $derived(store.commentsByTarget.get(`l:${label.id}`)?.length ?? 0);

  // 「すべて開く／閉じる」に追従
  $effect(() => {
    if (collapseAll.n) collapsed = collapseAll.v;
  });

  const checked = $derived(store.selLabels.has(label.id));
  const allCodes = $derived(store.excerpts.filter((e) => e.labelId === label.id));
  /** 検索中は一致したものだけ（ラベル名が一致したら全部） */
  const codes = $derived(
    !filter || filter.full.has(label.id) ? allCodes : allCodes.filter((e) => filter.codes.has(e.id)),
  );
  const shownCodes = $derived(showAll ? codes : codes.slice(0, CODE_LIMIT));
  const total = $derived(store.totalCounts.get(label.id) ?? 0);
  const visible = $derived(!filter || filter.visible.has(label.id));
  /** ドラッグ中、見出しのどこに落とそうとしているか */
  let place = $state<'before' | 'after' | 'inside' | null>(null);

  function onHeadOver(e: DragEvent) {
    const types = e.dataTransfer?.types ?? [];
    const isLabel = types.includes(LABEL_MIME);
    if (!isLabel && !types.includes(EXCERPT_MIME)) return;
    e.stopPropagation();
    // 自分自身や配下の中・前後には落とせない（preventDefault しない＝ドロップ不可）
    if (isLabel && dragging.ids.some((id) => descendantIds(store.labels, id).has(label.id))) {
      place = null;
      return;
    }
    e.preventDefault();
    // コードは中へ入れるだけ。ラベルは前・中・後
    place = isLabel ? dropPlace(e, e.currentTarget as HTMLElement, true) : 'inside';
  }

  function onHeadDrop(e: DragEvent) {
    const p = place;
    place = null;
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    const exIds = draggedIds(e, EXCERPT_MIME);
    const lbIds = draggedIds(e, LABEL_MIME);
    if (exIds.length) store.assignLabel(exIds, label.id);
    if (lbIds.length) {
      const failed =
        p === 'inside' ? store.moveLabels(lbIds, label.id) : store.placeLabels(lbIds, label.parentId, label.id, p);
      if (failed) store.toast('ラベルを自分自身や配下のラベルの下には移動できません', 'error');
    }
    store.clearSelection();
    endDrag();
  }

  /** 検索中はすべて開いて見せる */
  const isCollapsed = $derived(filter ? false : collapsed);
</script>

{#if visible}
<DropZone labelId={label.id} class="label-node depth-{Math.min(node.depth, 4)} {checked ? 'checked' : ''}">
  <div
    class="label-head"
    class:drop-before={place === 'before'}
    class:drop-after={place === 'after'}
    class:drop-inside={place === 'inside'}
    style:--c={label.color}
    role="treeitem"
    aria-selected={checked}
    aria-expanded={!isCollapsed}
    tabindex="-1"
    ondragover={onHeadOver}
    ondragleave={(e) => !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node) && (place = null)}
    ondrop={onHeadDrop}
  >
    <button class="twisty" onclick={() => (collapsed = !collapsed)} aria-label={isCollapsed ? '開く' : '閉じる'} disabled={!!filter}>
      {isCollapsed ? '▸' : '▾'}
    </button>
    <input type="checkbox" {checked} onchange={() => store.toggleSelLabel(label.id)} aria-label="このラベルを選択" />
    <span
      class="grip"
      title="ドラッグして別のラベルの下へ（選択中のラベルはまとめて移動）"
      draggable="true"
      role="button"
      tabindex="-1"
      ondragstart={(e) =>
        startDrag(e, LABEL_MIME, checked ? [...store.selLabels] : [label.id], (e.currentTarget as HTMLElement).closest('.label-head'))}
      ondragend={endDrag}
      >⋮⋮</span
    >
    <textarea
      class="label-name"
      rows="1"
      value={label.name}
      oninput={(e) => store.updateLabel(label.id, { name: e.currentTarget.value.replace(/\n/g, '') })}
      onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
      aria-label="ラベル名"
    ></textarea>
    <span class="count" title="配下を含むコード数（直下 {codes.length}）">{total}</span>
    <button
      class="comment-btn"
      class:has={commentCount > 0}
      class:open={commentsOpen}
      onclick={() => (commentsOpen = !commentsOpen)}
      title={commentCount ? `コメント ${commentCount} 件` : 'コメントを付ける'}
      aria-label="コメント"
    >
      💬{#if commentCount}<b>{commentCount}</b>{/if}
    </button>
    <button class="icon-btn" title="子ラベルを追加" onclick={() => ((adding = true), (collapsed = false))}>＋</button>
    <button class="icon-btn" onclick={() => (open = !open)} title="詳細">⋯</button>
  </div>

  {#if commentsOpen}
    <div class="label-thread">
      <CommentThread target={{ kind: 'label', labelId: label.id }} onclose={() => (commentsOpen = false)} />
    </div>
  {/if}

  {#if open}
    <div class="code-detail">
      <ColorPicker value={label.color} onchange={(c) => store.updateLabel(label.id, { color: c })} />
      <label class="field">
        <span>ラベルの説明</span>
        <textarea
          rows="3"
          value={label.description}
          placeholder="このラベルがまとめている意味・パターン"
          oninput={(e) => store.updateLabel(label.id, { description: e.currentTarget.value })}
        ></textarea>
      </label>
      <div class="detail-actions">
        <button
          class="btn btn-small btn-danger"
          onclick={() => {
            if (confirm(`ラベル「${label.name}」を削除しますか？\n子ラベルと付いていたコードは 1 つ上の階層へ移ります。`))
              store.deleteLabel(label.id);
          }}>ラベルを削除</button
        >
      </div>
    </div>
  {/if}

  {#if isCollapsed}
    {#if total || node.children.length}<span class="collapsed-hint">コード {total} 件・子ラベル {node.children.length} 件</span>{/if}
  {:else}
    {#if label.description && !open}<p class="label-desc">{label.description}</p>{/if}
    {#if codes.length}
      <div class="board-codes">
        {#each shownCodes as ex (ex.id)}<BoardCode {ex} />{/each}
      </div>
      {#if codes.length > CODE_LIMIT}
        <button class="more-btn" onclick={() => (showAll = !showAll)}>
          {showAll ? '折りたたむ' : `残り ${codes.length - CODE_LIMIT} 件を表示`}
        </button>
      {/if}
    {/if}
    {#if adding}
      <form
        class="add-form child-form"
        onsubmit={(e) => {
          e.preventDefault();
          if (childName.trim()) store.addLabel(childName, label.id);
          childName = '';
          adding = false;
        }}
      >
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={childName} placeholder="子ラベル名" autofocus onblur={() => !childName && (adding = false)} />
        <button class="btn btn-small btn-ink" type="submit">追加</button>
      </form>
    {/if}
    {#if node.children.length}
      <div class="label-children">
        {#each node.children as child (child.label.id)}<BoardLabel node={child} {collapseAll} {filter} />{/each}
      </div>
    {/if}
    {#if !filter && !codes.length && !node.children.length && !adding}
      <span class="drop-hint">コードや他のラベルをここへドラッグ</span>
    {/if}
  {/if}
</DropZone>
{/if}
