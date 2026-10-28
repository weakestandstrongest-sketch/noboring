import { h, store } from './ui.js';
import { playSplash } from './splash.js';

// Lucide-style line icons (24×24, stroked).
const I = {
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  weather: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  habits: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
};

const APPS = [
  { id: 'calculator', label: '電卓', load: () => import('./calculator.js') },
  { id: 'weather', label: '天気', load: () => import('./weather.js') },
  { id: 'timer', label: 'タイマー', load: () => import('./timer.js') },
  { id: 'habits', label: '習慣', load: () => import('./habits.js') },
  { id: 'camera', label: 'カメラ', load: () => import('./camera.js') },
];

const root = document.getElementById('app');
const stage = h('div', { class: 'stage' });
let current = null; // { el, destroy }

// Floating translucent tab bar with a sliding, jelly-bouncing highlight (same as Jam).
const pill = h('span', { class: 'tab-pill-track' }, h('span', { class: 'tab-pill' }));
const tabs = APPS.map((a) => h('li', {},
  h('a', { href: `#${a.id}`, class: 'tab', 'data-tab': a.id, 'aria-label': a.label },
    h('span', { class: 'tab-ico', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${I[a.id]}</svg>` }),
    a.label)));
const bar = h('nav', { class: 'tabbar', 'aria-label': 'メインナビゲーション' },
  h('ul', { class: 'glass-bar' }, pill, tabs));
pill.style.width = `calc((100% - 8px) / ${APPS.length})`;

root.append(stage, bar);

function setActive(index) {
  pill.style.transform = `translateX(${index * 100}%)`;
  // restart the jelly squash on every change
  const inner = pill.firstElementChild;
  inner.classList.remove('jelly');
  void inner.offsetWidth;
  inner.classList.add('jelly');
  tabs.forEach((li, i) => li.firstElementChild.toggleAttribute('aria-current', i === index));
}

// Screens tell the shell whether they are light or dark so the bar can match.
export function setTone(tone) {
  document.body.dataset.tone = tone;
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  let id = location.hash.slice(1);
  let index = APPS.findIndex((a) => a.id === id);
  if (index < 0) {
    id = store.get('lastApp', 'weather');
    index = Math.max(0, APPS.findIndex((a) => a.id === id));
    history.replaceState(null, '', `#${APPS[index].id}`);
  }
  setActive(index);
  // each screen is its own module, so one that fails to load cannot take down the others
  let mod;
  try {
    mod = (await APPS[index].load()).default;
  } catch {
    mod = null;
  }
  if (seq !== renderSeq) return;
  if (current?.destroy) current.destroy();
  root.querySelectorAll('.sheet-backdrop, .photo-view').forEach((n) => n.remove());
  setTone('dark');
  current = mod ? mod({ setTone }) : { el: h('div', { class: 'screen' }, h('div', { class: 'wx-msg' }, '読み込めませんでした。\n通信状況を確認して開き直してください。')) };
  stage.replaceChildren(current.el);
  store.set('lastApp', APPS[index].id);
}

window.addEventListener('hashchange', render);
playSplash();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // reload once when a new version takes over, so the update shows without relaunching
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    // never loop: at most one automatic reload every 30 seconds
    try {
      const last = +sessionStorage.getItem('quint.swReload') || 0;
      if (Date.now() - last < 30000) return;
      sessionStorage.setItem('quint.swReload', String(Date.now()));
    } catch { return; }
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // home-screen apps stay alive in the background: check for updates on every return
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
