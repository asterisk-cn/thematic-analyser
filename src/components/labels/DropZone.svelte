<script lang="ts">
  import type { Snippet } from 'svelte';
  import { store } from '../../store.svelte';
  import { EXCERPT_MIME, LABEL_MIME, draggedIds, endDrag } from '../../lib/dnd';

  /**
   * ドロップ先。labelId は
   *  - ドロップされたコードに付けるラベル
   *  - ドロップされたラベルの新しい親
   * （null = ラベルを外す／トップレベルへ）
   */
  let { labelId, class: cls, children }: { labelId: string | null; class: string; children: Snippet } = $props();
  let over = $state(false);

  const accepts = (e: DragEvent) =>
    !!e.dataTransfer && (e.dataTransfer.types.includes(EXCERPT_MIME) || e.dataTransfer.types.includes(LABEL_MIME));
</script>

<div
  class="{cls} {over ? 'drop-over' : ''}"
  role="group"
  ondragover={(e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.stopPropagation(); // 入れ子のドロップ先では一番内側だけ反応させる
    over = true;
  }}
  ondragleave={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) over = false;
  }}
  ondrop={(e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.stopPropagation();
    over = false;
    const exIds = draggedIds(e, EXCERPT_MIME);
    const lbIds = draggedIds(e, LABEL_MIME);
    if (exIds.length) store.assignLabel(exIds, labelId);
    if (lbIds.length && store.moveLabels(lbIds, labelId) > 0) {
      store.toast('ラベルを自分自身や配下のラベルの下には移動できません', 'error');
    }
    store.clearSelection();
    endDrag();
  }}
>
  {@render children()}
</div>
