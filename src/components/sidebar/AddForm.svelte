<script lang="ts">
  let { placeholder, onadd }: { placeholder: string; onadd: (name: string) => void } = $props();
  let v = $state('');
</script>

<form
  class="add-form"
  onsubmit={(e) => {
    e.preventDefault();
    if (!v.trim()) return;
    onadd(v);
    v = '';
  }}
>
  <input bind:value={v} {placeholder} />
  <button class="btn btn-small btn-ink" type="submit" disabled={!v.trim()}>追加</button>
</form>
