// Shared UI helpers: element builder, icons, sheets, toasts, storage, feedback.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

// 3D extruded text. The ::before pseudo-element draws the extrusion from data-t.
export function emboss(text, { size, variant = '', cls = '' } = {}) {
  const el = h('span', { class: `emboss ${variant} ${cls}`, 'data-t': text });
  el.textContent = text;
  if (size) el.style.fontSize = size;
  return h('span', { class: 'emboss-wrap' }, el);
}
// Replays the white flash on a number.
export function pop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}
export function setEmboss(wrap, text) {
  const el = wrap.firstElementChild;
  if (el.textContent === text) return;
  el.textContent = text;
  el.dataset.t = text;
}

export const icons = {
  location: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 2.5 2.8 10.6c-.8.4-.7 1.5.1 1.7l7.2 1.6 1.6 7.2c.2.9 1.3 1 1.7.1z"/></svg>',
  dots: '<svg viewBox="0 0 6 30" fill="currentColor"><circle cx="3" cy="3" r="2.6"/><circle cx="3" cy="15" r="2.6"/><circle cx="3" cy="27" r="2.6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="6.2" width="20" height="2.6" rx="1.3"/><rect x="2" y="15.2" width="20" height="2.6" rx="1.3"/><circle cx="8" cy="7.5" r="3.3"/><circle cx="16" cy="16.5" r="3.3"/><circle cx="20.2" cy="7.5" r="1.5" fill="#1f1f1f"/><circle cx="3.8" cy="16.5" r="1.5" fill="#1f1f1f"/></svg>',
  backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5"/><path d="M20 3.5v5h-5"/></svg>',
};

export function iconBtn(name, onClick, label) {
  return h('button', { class: 'icon-btn', 'aria-label': label || name, onclick: onClick, html: icons[name] });
}

export function topbar({ left = [], title = null, right = [] }) {
  return h('div', { class: 'topbar' },
    h('div', { class: 'group' }, left),
    title,
    h('div', { class: 'group' }, right));
}

export function sheet(build) {
  const root = document.getElementById('app');
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', { class: 'sheet' }, h('div', { class: 'grab' }));
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  build(panel, close);
  backdrop.append(panel);
  root.append(backdrop);
  return close;
}

export function prompt(title, value = '', placeholder = '') {
  return new Promise((resolve) => {
    let done = false;
    const close = sheet((p, close) => {
      const input = h('input', { type: 'text', value, placeholder, maxlength: 40 });
      const ok = () => { done = true; close(); resolve(input.value.trim() || null); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      p.append(h('h3', {}, title), input,
        h('button', { class: 'btn primary', onclick: ok }, 'OK'),
        h('button', { class: 'btn', onclick: () => { close(); } }, 'キャンセル'));
      setTimeout(() => input.focus(), 50);
    });
    // resolve null if dismissed by tapping the backdrop
    const obs = new MutationObserver(() => {
      if (!document.querySelector('.sheet-backdrop')) { obs.disconnect(); if (!done) resolve(null); }
    });
    obs.observe(document.getElementById('app'), { childList: true });
    return close;
  });
}

export function toast(msg, ms = 1800) {
  const t = h('div', { class: 'toast' }, msg);
  document.getElementById('app').append(t);
  setTimeout(() => t.remove(), ms);
}

export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('quint.' + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('quint.' + key, JSON.stringify(value)); } catch {}
  },
};

let audioCtx;
export function audio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Short synthesized click, used as a tactile substitute where vibration is unavailable (iOS).
export function tick(freq = 1800, dur = 0.018, gain = 0.08) {
  if (!store.get('settings.sound', true)) return;
  const ctx = audio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur + 0.01);
  if (navigator.vibrate) navigator.vibrate(8);
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
