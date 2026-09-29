/** ラベル整理ボードのドラッグ＆ドロップで使うデータ形式（値は ID のカンマ区切り） */
export const EXCERPT_MIME = 'text/x-excerpt-ids';
export const LABEL_MIME = 'text/x-label-ids';

export function startDrag(e: DragEvent, mime: string, ids: string[], image?: Element | null) {
  e.stopPropagation();
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(mime, ids.join(','));
  e.dataTransfer.effectAllowed = 'move';
  if (image) e.dataTransfer.setDragImage(image, 16, 14);
}
