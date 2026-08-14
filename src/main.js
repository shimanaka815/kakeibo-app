import './style.css';
import { db, ensureDefaults } from './db.js';
import { applyDueRecurring } from './recurringEngine.js';
import { route, startRouter, navigate } from './router.js';
import { renderHome } from './views/home.js';
import { renderAdd } from './views/add.js';
import { renderStats } from './views/stats.js';
import { renderBudget } from './views/budget.js';
import { renderRecurring } from './views/recurring.js';
import { renderAccounts } from './views/accounts.js';
import { renderSettings } from './views/settings.js';

const app = document.getElementById('app');

app.innerHTML = `
  <header class="topbar"><h1>家計簿</h1></header>
  <main id="view"></main>
  <button id="fab" class="fab" aria-label="入力を追加">＋</button>
  <nav class="bottom-nav">
    <a href="#/home" data-path="/home"><span class="nav-icon">🏠</span><span>ホーム</span></a>
    <a href="#/stats" data-path="/stats"><span class="nav-icon">📊</span><span>集計</span></a>
    <a href="#/budget" data-path="/budget"><span class="nav-icon">🎯</span><span>予算</span></a>
    <a href="#/recurring" data-path="/recurring"><span class="nav-icon">🔁</span><span>固定費</span></a>
    <a href="#/settings" data-path="/settings"><span class="nav-icon">⚙️</span><span>設定</span></a>
  </nav>
`;

const viewEl = document.getElementById('view');
const fab = document.getElementById('fab');

route('/home', (params) => renderHome(viewEl, params));
route('/add', (params) => renderAdd(viewEl, params));
route('/stats', (params) => renderStats(viewEl, params));
route('/budget', () => renderBudget(viewEl));
route('/recurring', () => renderRecurring(viewEl));
route('/accounts', () => renderAccounts(viewEl));
route('/settings', () => renderSettings(viewEl));

fab.addEventListener('click', () => navigate('#/add'));

window.addEventListener('routechange', (e) => {
  const path = e.detail.path;
  document.querySelectorAll('.bottom-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.path === path);
  });
  fab.classList.toggle('hidden', path === '/add');
});

async function init() {
  await ensureDefaults();
  await applyDueRecurring();
  startRouter('#/home');
}

init();

if (import.meta.env.DEV) {
  window.__db = db;
}
