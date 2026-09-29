<script lang="ts">
  import { store } from '../store.svelte';
  import { flatten } from '../lib/labels';
  import { UNLABELED } from '../types';
  import ExcerptsTab from './sidebar/ExcerptsTab.svelte';

  const options = $derived(flatten(store.labelTree));
</script>

<aside class="panel sidebar">
  <div class="panel-head">
    <h2>コード <em>{store.excerpts.length}</em></h2>
    {#if store.labels.length}
      <select
        class="label-select focus-select"
        class:on={!!store.focus}
        value={store.focus ?? ''}
        onchange={(e) => (store.focus = e.currentTarget.value || null)}
        title="ラベルで絞り込み（配下のラベルを含む）"
      >
        <option value="">すべてのラベル</option>
        <option value={UNLABELED}>ラベル未付与</option>
        {#each options as n (n.label.id)}
          <option value={n.label.id}>{'　'.repeat(n.depth)}{n.depth ? '└ ' : ''}{n.label.name}</option>
        {/each}
      </select>
    {/if}
  </div>
  <div class="sidebar-scroll">
    <ExcerptsTab />
  </div>
</aside>
