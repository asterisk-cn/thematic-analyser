import { store } from '../store.svelte';
import type { ProjectFile } from '../types';
import { isProjectFile, parseTranscriptFile } from './parse';

const MEDIA_EXT = /\.(mp4|m4v|mov|webm|mkv|ogv|mp3|wav|m4a|aac|ogg|oga|flac|opus|weba)$/i;
const TEXT_EXT = /\.(txt|md|json|srt|vtt|text)$/i;

export const ACCEPT = '.txt,.md,.json,.srt,.vtt,video/*,audio/*';

export async function openFiles(files: File[]) {
  const st = store;
  let docs = 0;
  let media = 0;
  for (const file of files) {
    try {
      if (file.type.startsWith('video/') || file.type.startsWith('audio/') || MEDIA_EXT.test(file.name)) {
        const t = st.addTrack(file);
        media++;
        if (t.offset !== 0) st.toast(`${file.name}: 前回の同期オフセット (${t.offset.toFixed(2)}s) を復元しました`);
        continue;
      }
      if (!TEXT_EXT.test(file.name) && !file.type.startsWith('text/') && file.type !== 'application/json') {
        st.toast(`${file.name}: 未対応の形式です`, 'error');
        continue;
      }
      const content = await file.text();
      if (/\.json$/i.test(file.name)) {
        const data = JSON.parse(content);
        if (isProjectFile(data)) {
          const cur = store;
          if (cur.docs.length || cur.excerpts.length) {
            if (!confirm(`プロジェクト「${(data as ProjectFile).name}」を読み込みます。現在の作業内容は置き換えられます。よろしいですか？`)) continue;
          }
          st.importProject(data as ProjectFile);
          st.toast(`プロジェクト「${(data as ProjectFile).name}」を読み込みました`);
          continue;
        }
      }
      const segments = parseTranscriptFile(file.name, content);
      if (!segments.length) {
        st.toast(`${file.name}: テキストが見つかりませんでした`, 'error');
        continue;
      }
      st.addDoc({ name: file.name.replace(/\.[^.]+$/, ''), segments });
      docs++;
    } catch (err) {
      st.toast(`${file.name}: 読み込みに失敗しました（${(err as Error).message}）`, 'error');
    }
  }
  const parts = [docs && `トランスクリプト ${docs} 件`, media && `メディア ${media} 件`].filter(Boolean);
  if (parts.length) st.toast(`${parts.join('・')}を追加しました`);
}
