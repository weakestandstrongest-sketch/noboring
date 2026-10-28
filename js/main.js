import { h, svg, store, todayKey } from './ui.js';
import calculator from './calculator.js';
import weather from './weather.js';
import timer from './timer.js';
import habits from './habits.js';
import camera from './camera.js';

// App glyphs: black, chunky, softly shaded shapes on a white tile.
const G = {
  calc: `<svg viewBox="0 0 100 100"><defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#141414"/></linearGradient></defs>
    <path d="M36 18h28v18h18v28H64v18H36V64H18V36h18z" fill="#bdbdbd" transform="translate(-4 4)" opacity=".55"/>
    <path d="M38 14h24v22h22v24H62v22H38V60H16V36h22z" fill="url(#gc)"/>
    <path d="M38 14h24l-6 6H44zM16 36h22l-6 6H22z" fill="#555"/></svg>`,
  weather: `<svg viewBox="0 0 100 100"><defs><radialGradient id="gs" cx=".35" cy=".3"><stop offset="0" stop-color="#ff7a5c"/><stop offset=".5" stop-color="#ff3b1f"/><stop offset="1" stop-color="#c4200b"/></radialGradient><radialGradient id="gk" cx=".32" cy=".26"><stop offset="0" stop-color="#666"/><stop offset=".4" stop-color="#262626"/><stop offset="1" stop-color="#050505"/></radialGradient></defs>
    <ellipse cx="52" cy="80" rx="34" ry="5" fill="#000" opacity=".12"/>
    <circle cx="60" cy="34" r="18" fill="url(#gs)"/>
    <circle cx="40" cy="56" r="18" fill="url(#gk)"/><circle cx="62" cy="58" r="15" fill="url(#gk)"/><circle cx="78" cy="64" r="9" fill="url(#gk)"/><circle cx="20" cy="66" r="6" fill="url(#gk)"/></svg>`,
  timer: `<svg viewBox="0 0 100 100"><defs><radialGradient id="gt" cx=".4" cy=".35"><stop offset="0" stop-color="#3c3c3c"/><stop offset="1" stop-color="#151515"/></radialGradient></defs>
    <circle cx="46" cy="54" r="34" fill="#d0d0d0" opacity=".6"/>
    <circle cx="50" cy="50" r="34" fill="url(#gt)"/>
    <path d="M50 18c3 0 4 14 5 26a5 5 0 0 1-10 0c1-12 2-26 5-26z" fill="#f4f4f2"/><circle cx="50" cy="46" r="7" fill="#f4f4f2"/></svg>`,
  habits: `<svg viewBox="0 0 100 100"><defs><linearGradient id="gh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#444"/><stop offset="1" stop-color="#111"/></linearGradient></defs>
    <ellipse cx="50" cy="84" rx="30" ry="4" fill="#000" opacity=".12"/>
    <path d="M14 50l14-12 16 16 34-36 10 12-44 44z" fill="#2a2a2a" transform="translate(4 4)"/>
    <path d="M14 50l14-12 16 16 34-36 10 12-44 44z" fill="url(#gh)"/>
    <path d="M78 18l10 12-4 2-8-10z" fill="#666"/></svg>`,
  camera: `<svg viewBox="0 0 100 100"><defs><radialGradient id="gl" cx=".5" cy=".5"><stop offset="0" stop-color="#5b3f8f"/><stop offset=".35" stop-color="#21173a"/><stop offset=".7" stop-color="#0b0b0f"/></radialGradient></defs>
    <rect x="66" y="12" width="20" height="16" rx="3" fill="#1a1a1a"/><rect x="70" y="15" width="12" height="10" rx="2" fill="#444"/>
    <circle cx="50" cy="56" r="32" fill="#1c1c1c"/>
    <circle cx="50" cy="56" r="32" fill="none" stroke="#333" stroke-width="5" stroke-dasharray="3 3"/>
    <circle cx="50" cy="56" r="21" fill="url(#gl)" stroke="#111" stroke-width="3"/>
    <ellipse cx="44" cy="49" rx="5" ry="3.5" fill="#c9b3ff" opacity=".6"/></svg>`,
};

const APPS = [
  { id: 'calculator', name: '電卓', sub: 'CALCULATOR', glyph: G.calc, mod: calculator },
  { id: 'weather', name: '天気', sub: 'WEATHER', glyph: G.weather, mod: weather },
  { id: 'timer', name: 'タイマー', sub: 'TIMER', glyph: G.timer, mod: timer },
  { id: 'habits', name: '習慣', sub: 'HABITS', glyph: G.habits, mod: habits },
  { id: 'camera', name: 'カメラ', sub: 'CAMERA', glyph: G.camera, mod: camera },
];

const root = document.getElementById('app');
let current = null; // { el, destroy }

function home() {
  const d = new Date();
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  const el = h('div', { class: 'screen home' },
    h('div', { class: 'home-head' },
      h('div', { class: 'brand' }, h('span', {}, '('), 'Quint', h('span', {}, ')')),
      h('div', { class: 'date' }, `${todayKey(d).replaceAll('-', '.')} ${wd}`)),
    h('div', { class: 'home-grid' }, APPS.map((a) =>
      h('button', { class: 'app-tile', 'data-app': a.id, onclick: () => go(a.id) },
        h('div', { class: 'ico' }, svg(a.glyph)),
        h('div', { class: 'name' }, a.name),
        h('div', { class: 'sub' }, a.sub)))));
  return { el };
}

function go(id) {
  location.hash = id ? '#' + id : '';
}

function render() {
  const id = location.hash.slice(1);
  const app = APPS.find((a) => a.id === id);
  if (current?.destroy) current.destroy();
  root.querySelectorAll('.sheet-backdrop, .photo-view').forEach((n) => n.remove());
  current = app ? app.mod({ back: () => go('') }) : home();
  root.replaceChildren(current.el);
  if (app) store.set('lastApp', id);
}

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
