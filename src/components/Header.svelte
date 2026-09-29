<script lang="ts">
  import { store } from '../store.svelte';
  import { ACCEPT, openFiles } from '../lib/files';
  import { exportExcerptsCsv, exportMarkdownReport, exportProjectJson } from '../lib/export';

  let input: HTMLInputElement;
  let menu = $state(false);

  function doExport(kind: 'json' | 'csv' | 'md') {
    const p = store.exportProject();
    if (kind === 'json') exportProjectJson(p);
    if (kind === 'csv') exportExcerptsCsv(p);
    if (kind === 'md') exportMarkdownReport(p);
    menu = false;
  }
</script>

<header class="header">
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">
      <i style:background="#f5c518"></i>
      <i style:background="#d2452b"></i>
      <i style:background="#5cc8a8"></i>
    </span>
    <span class="brand-name">Thematic Analyser</span>
    <span class="brand-sub">テーマ分析ワークベンチ</span>
  </div>

  <nav class="pages" aria-label="ページ">
    <button class:on={store.page === 'code'} onclick={() => store.setPage('code')}>
      <i>①</i>コーディング
    </button>
    <button class:on={store.page === 'label'} onclick={() => store.setPage('label')}>
      <i>②</i>ラベル整理
    </button>
  </nav>

  <input class="project-name" bind:value={store.name} aria-label="プロジェクト名" spellcheck="false" />

  <div class="header-actions">
    <span class="autosave" title="コード・テーマ・抜粋はブラウザに自動保存されます（メディアファイルは除く）">
      ● 自動保存
    </span>
    <button class="btn btn-ink" onclick={() => input.click()}>ファイルを開く</button>
    <input
      bind:this={input}
      type="file"
      multiple
      accept={ACCEPT}
      hidden
      onchange={(e) => {
        openFiles([...(e.currentTarget.files ?? [])]);
        e.currentTarget.value = '';
      }}
    />
    <div class="menu-wrap">
      <button class="btn" onclick={() => (menu = !menu)} aria-expanded={menu}>書き出し ▾</button>
      {#if menu}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="menu-scrim" onclick={() => (menu = false)}></div>
        <div class="menu" role="menu">
          <button onclick={() => doExport('json')}>
            <b>プロジェクト (.json)</b>
            <small>後で「ファイルを開く」から再開できます</small>
          </button>
          <button onclick={() => doExport('csv')}>
            <b>抜粋一覧 (.csv)</b>
            <small>Excel で開ける UTF-8 (BOM 付き)</small>
          </button>
          <button onclick={() => doExport('md')}>
            <b>テーマレポート (.md)</b>
            <small>テーマ → コード → 抜粋 の順に整理</small>
          </button>
        </div>
      {/if}
    </div>
    <button
      class="btn btn-ghost"
      onclick={() => {
        if (confirm('新しいプロジェクトを開始します。現在の内容は消去されます（必要なら先に書き出してください）。')) {
          store.newProject();
        }
      }}
    >
      新規
    </button>
  </div>
</header>
