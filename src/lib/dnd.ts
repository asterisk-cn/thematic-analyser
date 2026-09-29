/** ラベル整理ボードのドラッグ＆ドロップで使うデータ形式（値は ID のカンマ区切り） */
export const EXCERPT_MIME = 'text/x-excerpt-ids';
export const LABEL_MIME = 'text/x-label-ids';

/**
 * ドラッグ中のもの。dragover 中は dataTransfer の中身を読めないので、
 * 落とせない位置（自分自身や配下）を判定するためにここへ控えておく
 */
export const dragging: { mime: string; ids: string[] } = { mime: '', ids: [] };

export function startDrag(e: DragEvent, mime: string, ids: string[], image?: Element | null) {
  e.stopPropagation();
  dragging.mime = mime;
  dragging.ids = ids;
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(mime, ids.join(','));
  e.dataTransfer.effectAllowed = 'move';
  if (image) e.dataTransfer.setDragImage(image, 16, 14);
}

export function endDrag() {
  dragging.mime = '';
  dragging.ids = [];
}

export const draggedIds = (e: DragEvent, mime: string) =>
  (e.dataTransfer?.getData(mime) || '').split(',').filter(Boolean);

/** 要素の上下どこにいるか：ラベルは上 1/4・下 1/4 で前後、中央で中へ。コードは上半分／下半分 */
export function dropPlace(e: DragEvent, el: HTMLElement, withInside: boolean): 'before' | 'after' | 'inside' {
  const r = el.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  if (!withInside) return y < 0.5 ? 'before' : 'after';
  return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
}
