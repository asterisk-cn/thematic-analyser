<script lang="ts">
  import { PALETTE } from '../../store.svelte';

  let { value, onchange }: { value: string; onchange: (c: string) => void } = $props();
</script>

<div class="palette">
  {#each PALETTE as c (c)}
    <button class="pal" class:on={c === value} style:background={c} onclick={() => onchange(c)} aria-label={c}></button>
  {/each}
  <label class="pal custom" title="任意の色">
    <input type="color" {value} oninput={(e) => onchange(e.currentTarget.value)} />
  </label>
</div>
