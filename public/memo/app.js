(() => {
  const STORAGE_KEY = 'memo-app:memos';
  const $ = (id) => document.getElementById(id);

  // ---- データ ----
  let memos = load();
  let currentId = null;
  let saveTimer = null;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    } catch {
      toast('保存できませんでした（容量不足の可能性）');
    }
  }

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const findMemo = (id) => memos.find((m) => m.id === id);

  function titleOf(text) {
    const line = text.split('\n').find((l) => l.trim());
    return line ? line.trim() : '新しいメモ';
  }

  function previewOf(text) {
    const lines = text.split('\n').filter((l) => l.trim());
    return lines.slice(1).join(' ').slice(0, 80);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return time;
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ---- 一覧 ----
  function renderList() {
    const q = $('search').value.trim().toLowerCase();
    const list = $('memo-list');
    const shown = memos
      .filter((m) => !q || m.text.toLowerCase().includes(q))
      .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

    list.replaceChildren(
      ...shown.map((m) => {
        const li = document.createElement('li');
        li.className = 'memo-item';
        li.dataset.id = m.id;
        const title = document.createElement('div');
        title.className = 'memo-title';
        title.textContent = (m.pinned ? '📌 ' : '') + titleOf(m.text);
        const sub = document.createElement('div');
        sub.className = 'memo-sub';
        const date = document.createElement('span');
        date.className = 'memo-date';
        date.textContent = formatDate(m.updatedAt);
        const prev = document.createElement('span');
        prev.className = 'memo-preview';
        prev.textContent = previewOf(m.text) || '追加テキストなし';
        sub.append(date, prev);
        li.append(title, sub);
        return li;
      }),
    );

    const empty = $('empty');
    empty.classList.toggle('hidden', shown.length > 0);
    empty.innerHTML = q ? '見つかりませんでした' : 'メモはまだありません。<br />右下の＋から書いてみよう。';
  }

  // ---- 画面切り替え（スマホの「戻る」にも対応） ----
  function showList() {
    flushSave();
    // 空のメモは残さない
    const m = findMemo(currentId);
    if (m && !m.text.trim()) {
      memos = memos.filter((x) => x.id !== m.id);
      persist();
    }
    currentId = null;
    $('edit-view').classList.add('hidden');
    $('list-view').classList.remove('hidden');
    renderList();
  }

  function showEditor(id, focus) {
    const m = findMemo(id);
    if (!m) return showList();
    currentId = id;
    $('editor').value = m.text;
    updateMeta();
    $('list-view').classList.add('hidden');
    $('edit-view').classList.remove('hidden');
    if (focus) $('editor').focus();
    else $('editor').scrollTop = 0;
  }

  function openMemo(id, focus = false) {
    history.pushState({ memo: id }, '', '#' + id);
    showEditor(id, focus);
  }

  function closeMemo() {
    if (history.state && history.state.memo) history.back();
    else showList();
  }

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.memo) showEditor(e.state.memo);
    else showList();
  });

  function updateMeta() {
    const m = findMemo(currentId);
    if (!m) return;
    $('edit-meta').textContent = `${m.text.length}文字 ・ 更新 ${new Date(m.updatedAt).toLocaleString('ja-JP')}`;
    $('pin-btn').classList.toggle('active', !!m.pinned);
  }

  // ---- 編集（自動保存） ----
  function flushSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    persist();
  }

  $('editor').addEventListener('input', () => {
    const m = findMemo(currentId);
    if (!m) return;
    m.text = $('editor').value;
    m.updatedAt = Date.now();
    updateMeta();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 300);
  });

  // アプリを閉じたり切り替えたりしたときも確実に保存
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
  window.addEventListener('pagehide', flushSave);

  $('new-btn').addEventListener('click', () => {
    const now = Date.now();
    const m = { id: newId(), text: '', pinned: false, createdAt: now, updatedAt: now };
    memos.push(m);
    openMemo(m.id, true);
  });

  $('memo-list').addEventListener('click', (e) => {
    const li = e.target.closest('.memo-item');
    if (li) openMemo(li.dataset.id);
  });

  $('back-btn').addEventListener('click', closeMemo);

  $('pin-btn').addEventListener('click', () => {
    const m = findMemo(currentId);
    if (!m) return;
    m.pinned = !m.pinned;
    persist();
    updateMeta();
    toast(m.pinned ? 'ピン留めしました' : 'ピン留めを外しました');
  });

  $('delete-btn').addEventListener('click', () => {
    const m = findMemo(currentId);
    if (!m) return;
    if (m.text.trim() && !confirm('このメモを削除しますか？')) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    memos = memos.filter((x) => x.id !== m.id);
    persist();
    closeMemo();
    toast('削除しました');
  });

  $('search').addEventListener('input', renderList);

  // ---- メニュー（バックアップ・復元・インストール） ----
  const menu = $('menu');
  $('menu-btn').addEventListener('click', () => menu.showModal());
  $('menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('click', (e) => {
    if (e.target === menu) menu.close();
  });

  $('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'memo', version: 1, memos }, null, 2)], { type: 'application/json' });
    const d = new Date();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `memo-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    menu.close();
  });

  $('import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = (Array.isArray(data) ? data : data.memos || []).filter(
        (m) => m && typeof m.id === 'string' && typeof m.text === 'string',
      );
      if (!incoming.length) throw new Error('empty');
      // 同じIDは新しい方を残してマージ
      const byId = new Map(memos.map((m) => [m.id, m]));
      for (const m of incoming) {
        const cur = byId.get(m.id);
        if (!cur || (m.updatedAt || 0) > cur.updatedAt) {
          byId.set(m.id, {
            id: m.id,
            text: m.text,
            pinned: !!m.pinned,
            createdAt: m.createdAt || Date.now(),
            updatedAt: m.updatedAt || Date.now(),
          });
        }
      }
      memos = [...byId.values()];
      persist();
      renderList();
      menu.close();
      toast(`${incoming.length}件のメモを復元しました`);
    } catch {
      toast('ファイルを読み込めませんでした');
    }
  });

  // Android/Chrome のインストールボタン
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('install-btn').classList.remove('hidden');
  });
  $('install-btn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('install-btn').classList.add('hidden');
    menu.close();
  });

  // ---- トースト ----
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2000);
  }

  // ---- 起動 ----
  // 保存領域を消されにくくする（対応ブラウザのみ）
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

  const startId = location.hash.slice(1);
  history.replaceState(null, '', location.pathname);
  renderList();
  if (startId && findMemo(startId)) openMemo(startId);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  }
})();
