<script lang="ts">
  import { store } from '../store.svelte';
  import CommentsPanel from './CommentsPanel.svelte';

  const n = $derived(
    store.activeDoc
      ? store.comments.filter((c) => c.target.kind === 'segment' && c.target.docId === store.activeDoc!.id).length
      : 0,
  );
</script>

<section class="panel left-panel">
  <div class="left-tabs" role="tablist">
    <button role="tab" aria-selected="true" class="on">コメント<em>{n}</em></button>
  </div>
  <div class="panel-body"><CommentsPanel mode="segment" /></div>
</section>
