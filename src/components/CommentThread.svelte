<script lang="ts">
  import { store } from '../store.svelte';
  import type { CommentTarget } from '../types';

  let { target, onclose }: { target: CommentTarget; onclose?: () => void } = $props();

  const comments = $derived(store.commentsOf(target));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  let draft = $state('');
  let editing = $state<string | null>(null);
  let editText = $state('');
  let input: HTMLTextAreaElement;

  $effect(() => input?.focus({ preventScroll: true }));

  function post() {
    if (!draft.trim()) return;
    store.addComment(target, draft);
    draft = '';
  }

  const submitKey = (e: KeyboardEvent) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing;

  function fmt(ts: number) {
    const d = new Date(ts);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) +
          ' ' +
          d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="thread" onmouseup={(e) => e.stopPropagation()} ondragstart={(e) => e.stopPropagation()}>
  {#each comments as c (c.id)}
    <div class="comment">
      {#if editing === c.id}
        <textarea
          class="comment-input"
          rows="2"
          bind:value={editText}
          onkeydown={(e) => {
            if (submitKey(e)) {
              e.preventDefault();
              if (editText.trim()) store.updateComment(c.id, editText.trim());
              editing = null;
            } else if (e.key === 'Escape') editing = null;
          }}
        ></textarea>
        <div class="comment-actions">
          <button
            onclick={() => {
              if (editText.trim()) store.updateComment(c.id, editText.trim());
              editing = null;
            }}>保存</button
          >
          <button onclick={() => (editing = null)}>取消</button>
        </div>
      {:else}
        <p class="comment-text">{c.text}</p>
        <div class="comment-meta">
          <span>{fmt(c.createdAt)}{c.updatedAt ? '（編集済み）' : ''}</span>
          <button onclick={() => ((editing = c.id), (editText = c.text))}>編集</button>
          <button
            onclick={() => {
              if (confirm('このコメントを削除しますか？')) store.deleteComment(c.id);
            }}>削除</button
          >
        </div>
      {/if}
    </div>
  {/each}
  <div class="comment-new">
    <textarea
      bind:this={input}
      class="comment-input"
      rows="2"
      placeholder="コメントを書く"
      bind:value={draft}
      onkeydown={(e) => {
        if (submitKey(e)) {
          e.preventDefault();
          post();
        } else if (e.key === 'Escape') onclose?.();
      }}
    ></textarea>
    <div class="comment-actions">
      <span class="pop-hint"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd>Enter</kbd> 投稿</span>
      {#if onclose}<button onclick={onclose}>閉じる</button>{/if}
      <button class="btn btn-small btn-ink" onclick={post} disabled={!draft.trim()}>コメント</button>
    </div>
  </div>
</div>
