const { t, locale } = spotcat.i18n;

const STORAGE_KEY = 'notes';
const $ = (id) => document.getElementById(id);
const listEl = $('list'), searchEl = $('search'), editor = $('editor');

/** @type {{ id: string, text: string, created: number, updated: number, pinned?: boolean }[]} */
let notes = [];
let selectedId = null;
let query = '';
let saveTimer = null;

// MARK: - 存储

async function load() {
  const stored = await spotcat.storage.get(STORAGE_KEY);
  notes = Array.isArray(stored) ? stored : [];
}

/** 空白笔记不落盘；正在编辑的空白笔记保留在内存里 */
function persist() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const saved = notes.filter((n) => n.text.trim());
  syncSearch(saved);
  return spotcat.storage.set(STORAGE_KEY, saved);
}

/** 交给 Spotcat 主搜索框：输入笔记里的内容就能直接搜到（旧版 Spotcat 没有这个接口） */
function syncSearch(saved) {
  if (!spotcat.search) return;
  const items = [...saved]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated)
    .slice(0, 2000)
    .map((n) => {
      const [title, ...rest] = lines(n.text);
      return { id: n.id, code: 'list', title: title.slice(0, 200), subtitle: rest[0]?.slice(0, 200), text: n.text.slice(0, 5000) };
    });
  spotcat.search.setItems(items).catch(() => {});
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}

const newID = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function createNote(text = '') {
  const now = Date.now();
  const note = { id: newID(), text, created: now, updated: now };
  notes.unshift(note);
  return note;
}

/** 离开一条空白笔记时把它丢掉 */
function dropEmpty(exceptId) {
  notes = notes.filter((n) => n.id === exceptId || n.text.trim());
}

// MARK: - 列表

const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const titleOf = (note) => lines(note.text)[0] || '';

function sorted() {
  return [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
}

function visible() {
  const q = query.trim().toLowerCase();
  const all = sorted();
  return q ? all.filter((n) => n.text.toLowerCase().includes(q)) : all;
}

const selected = () => notes.find((n) => n.id === selectedId) || null;

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return t('justNow');
  if (diff < 3_600_000) return t('minutesAgo', { n: Math.floor(diff / 60_000) });
  const date = new Date(ts), now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(locale, sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}

/** 把匹配到的搜索词包进 <mark> */
function highlight(el, text) {
  const q = query.trim();
  if (!q) { el.textContent = text; return; }
  const lower = text.toLowerCase(), needle = q.toLowerCase();
  let i = 0, at;
  while ((at = lower.indexOf(needle, i)) !== -1) {
    el.append(text.slice(i, at));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(at, at + q.length);
    el.append(mark);
    i = at + q.length;
  }
  el.append(text.slice(i));
}

/** 预览：搜索时显示命中的那一行，否则显示第二行 */
function previewOf(note) {
  const rest = lines(note.text).slice(1);
  const q = query.trim().toLowerCase();
  const hit = q && rest.find((l) => l.toLowerCase().includes(q));
  const line = hit || rest[0] || '';
  if (!hit) return line;
  const at = line.toLowerCase().indexOf(q);
  return at > 20 ? '…' + line.slice(at - 10) : line;
}

function renderList() {
  const items = visible();
  listEl.replaceChildren(...items.map((note) => {
    const li = document.createElement('li');
    li.dataset.id = note.id;
    if (note.id === selectedId) li.className = 'selected';

    const title = document.createElement('div');
    const titleText = titleOf(note);
    title.className = 'title' + (titleText ? '' : ' untitled') + (note.pinned ? ' pinned' : '');
    const span = document.createElement('span');
    highlight(span, titleText || t('untitled'));
    title.append(span);

    const sub = document.createElement('div');
    sub.className = 'sub';
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(note.updated);
    const preview = document.createElement('span');
    preview.className = 'preview';
    highlight(preview, previewOf(note));
    sub.append(time, preview);

    li.append(title, sub);
    li.addEventListener('mousedown', () => select(note.id));
    return li;
  }));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'list-empty';
    empty.textContent = query.trim() ? t('noResults') : t('empty');
    listEl.append(empty);
  }
  const saved = notes.filter((n) => n.text.trim()).length;
  $('count').textContent = saved ? t('count', { n: saved }) : '';
  listEl.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}

// MARK: - 编辑区

function renderEditor() {
  const note = selected();
  document.body.classList.toggle('no-note', !note);
  $('empty').textContent = notes.some((n) => n.text.trim()) ? '' : t('empty');
  if (!note) return;
  if (editor.value !== note.text) editor.value = note.text;
  $('pin').textContent = note.pinned ? t('unpin') : t('pin');
  renderMeta();
}

function renderMeta() {
  const note = selected();
  if (note) $('meta').textContent = `${formatTime(note.updated)} · ${t('chars', { n: note.text.length })}`;
}

function select(id) {
  if (id === selectedId) return;
  selectedId = id;
  dropEmpty(id);
  renderList();
  renderEditor();
}

/** 选中搜索结果里的上一条/下一条 */
function move(step) {
  const items = visible();
  if (!items.length) return;
  const index = items.findIndex((n) => n.id === selectedId);
  const next = index === -1 ? 0 : Math.min(items.length - 1, Math.max(0, index + step));
  select(items[next].id);
}

function newNote(text = '') {
  query = searchEl.value = '';
  const note = createNote(text);
  select(note.id);
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
  return note;
}

function focusEditorEnd() {
  if (!selected()) return;
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
  editor.scrollTop = editor.scrollHeight;
}

// MARK: - 操作

let toastTimer = null;
function toast(text, action, onAction) {
  $('toast-text').textContent = text;
  const button = $('toast-action');
  button.textContent = action || '';
  button.onclick = () => { $('toast').classList.remove('show'); onAction?.(); };
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), action ? 4000 : 1500);
}

function deleteSelected() {
  const note = selected();
  if (!note) return;
  const items = visible();
  const index = items.findIndex((n) => n.id === note.id);
  const neighbor = items[index + 1] || items[index - 1];
  notes = notes.filter((n) => n.id !== note.id);
  selectedId = null;
  if (neighbor) select(neighbor.id); else { renderList(); renderEditor(); }
  persist();
  if (note.text.trim()) {
    toast(t('deleted'), t('undo'), () => {
      notes.push(note);
      persist();
      selectedId = null;
      select(note.id);
    });
  }
}

editor.addEventListener('input', () => {
  const note = selected();
  if (!note) return;
  note.text = editor.value;
  note.updated = Date.now();
  renderList();
  renderMeta();
  scheduleSave();
});

searchEl.addEventListener('input', () => {
  query = searchEl.value;
  const items = visible();
  if (!items.some((n) => n.id === selectedId)) {
    selectedId = null;
    if (items[0]) select(items[0].id); else renderEditor();
  }
  renderList();
});

searchEl.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  else if (e.key === 'Enter' && !e.metaKey) {
    e.preventDefault();
    // 没有匹配时，回车把搜索词记成一条新笔记
    if (selected()) focusEditorEnd(); else if (searchEl.value.trim()) { newNote(searchEl.value); scheduleSave(); }
  }
});

$('new').addEventListener('click', () => newNote());

$('pin').addEventListener('click', () => {
  const note = selected();
  if (!note) return;
  note.pinned = !note.pinned;
  renderList();
  renderEditor();
  persist();
});

$('copy').addEventListener('click', async () => {
  const note = selected();
  if (!note?.text) return;
  await spotcat.copyText(note.text);
  toast(t('copied'));
});

$('ask-ai').addEventListener('click', () => {
  const note = selected();
  if (!note?.text.trim()) return;
  const title = titleOf(note);
  spotcat.chat.open({
    title: t('chatTitle', { title: title.length > 30 ? title.slice(0, 30) + '…' : title }),
    context: [{ title: t('ctxNote'), content: note.text }],
  });
});

$('delete').addEventListener('click', deleteSelected);

document.addEventListener('keydown', (e) => {
  if (!e.metaKey || e.isComposing) return;
  const key = e.key.toLowerCase();
  if (key === 'n') { e.preventDefault(); newNote(); }
  else if (key === 'f') { e.preventDefault(); searchEl.focus(); searchEl.select(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    persist().then(() => spotcat.hideWindow());
  } else if (e.key === 'Backspace' && document.activeElement !== editor) {
    e.preventDefault();
    deleteSelected();
  }
});

// 离开页面前把还没写盘的改动存下来
window.addEventListener('pagehide', () => { if (saveTimer) persist(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) persist(); });

// MARK: - 进入

spotcat.onEnter(async ({ code, type, payload }) => {
  await load();
  selectedId = null;
  query = searchEl.value = '';

  if (type === 'item' && notes.some((n) => n.id === payload)) {
    // 从主搜索框里的笔记条目进入
    select(payload);
    focusEditorEnd();
  } else if (code === 'add' && type === 'match' && payload.trim()) {
    // 从搜索框带内容进来：直接保存
    newNote(payload);
    await persist();
    toast(t('saved'));
  } else if (code === 'add') {
    newNote();
  } else {
    const first = sorted()[0];
    if (first) select(first.id); else { renderList(); renderEditor(); }
    searchEl.focus();
    // 安装前就有的笔记、或在旧版 Spotcat 里写的笔记，进入时补一次索引
    syncSearch(notes.filter((n) => n.text.trim()));
  }
});
