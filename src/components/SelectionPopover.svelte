<script lang="ts">
  let {
    x,
    y,
    preview,
    onapply,
    onclose,
  }: {
    x: number;
    y: number;
    preview: string;
    onapply: (code: string) => void;
    onclose: () => void;
  } = $props();

  let code = $state('');
  let input: HTMLTextAreaElement;

  $effect(() => input.focus({ preventScroll: true }));

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      onapply(code.trim());
    }
  }

  // 画面外にはみ出さないよう位置調整
  const W = 340;
  const H = 210;
  const left = $derived(Math.min(Math.max(8, x - W / 2), window.innerWidth - W - 8));
  const top = $derived(y + 12 + H > window.innerHeight ? Math.max(8, y - H - 10) : y + 12);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="popover"
  style:left="{left}px"
  style:top="{top}px"
  style:width="{W}px"
  onmousedown={(e) => e.stopPropagation()}
  role="dialog"
  aria-label="切片にコードを付ける"
  tabindex="-1"
>
  <div class="pop-quote">「{preview.length > 80 ? preview.slice(0, 80) + '…' : preview}」</div>

  <label class="pop-field">
    <span>この切片が言っていること（コード）</span>
    <textarea
      bind:this={input}
      class="pop-code"
      rows="2"
      placeholder="例：仕事と私生活の境目があいまいになる"
      bind:value={code}
      onkeydown={onKey}
    ></textarea>
  </label>

  <div class="pop-foot">
    <span class="pop-hint"><kbd>Enter</kbd> 作成　<kbd>Shift</kbd>+<kbd>Enter</kbd> 改行　<kbd>Esc</kbd> 取消</span>
    <button class="btn btn-small btn-ink" onclick={() => onapply(code.trim())}>切片を作成</button>
  </div>
</div>
