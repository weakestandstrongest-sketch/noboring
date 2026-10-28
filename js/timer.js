import { h, emboss, setEmboss, iconBtn, topbar, sheet, store, tick, audio, pop } from './ui.js';

const MAX = 99;
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function timer() {
  // mode: idle | running | paused | done
  const st = Object.assign({ mode: 'idle', minutes: 5, endAt: 0, remaining: 0, total: 0 }, store.get('timer.state', {}));
  const save = () => store.set('timer.state', st);

  const stage = h('div', { class: 'timer-stage' });
  const reel = h('div', { class: 'timer-reel' });
  const SLOTS = [-2, -1, 0, 1, 2];
  const slots = SLOTS.map(() => {
    const num = emboss('00');
    const slot = h('div', { class: 'timer-num' }, num);
    reel.append(slot);
    return { slot, num };
  });
  const read = h('div', { class: 'timer-read' });
  const hand = h('div', { class: 'timer-hand' }, h('i'));
  stage.append(hand, reel, read);
  const center = slots[2].num.firstElementChild;

  // The reel position is a continuous number of minutes: dragging moves it freely,
  // a flick keeps it spinning with friction, and it always comes to rest on a whole minute.
  let pos = st.minutes;
  let vel = 0;              // minutes per second
  let dragging = false;
  let snapping = false;
  let lastWhole = Math.round(pos);
  let step = 300;           // px between numbers

  function measure() {
    const fs = parseFloat(getComputedStyle(slots[0].slot).fontSize) || 300;
    step = fs * 0.8 * 1.24 + fs * 0.16;
  }

  const msLeft = () => (st.mode === 'running' ? Math.max(0, st.endAt - Date.now()) : st.mode === 'paused' ? st.remaining : 0);

  // the number shown in the middle while counting down
  function shownMinutes() {
    const s = Math.ceil(msLeft() / 1000);
    return s < 60 ? s : Math.ceil(s / 60);
  }

  function paint() {
    const counting = st.mode !== 'idle' && !dragging && !moving();
    const at = counting ? shownMinutes() : pos;
    const base = Math.round(at);
    const frac = counting ? 0 : at - base;
    slots.forEach(({ slot, num }, k) => {
      const o = SLOTS[k];
      const v = base - o;                         // larger numbers sit above
      const y = (o + frac) * step;
      slot.style.transform = `translate3d(0, calc(-50% + ${y.toFixed(1)}px), 0)`;
      slot.style.visibility = (counting ? o === 0 : v >= 1 && v <= MAX) ? 'visible' : 'hidden';
      setEmboss(num, pad(clamp(v, 0, 99)));
    });
    // once started: white numerals, a sweeping second hand and mm:ss at the bottom
    const ms = msLeft();
    const s = Math.ceil(ms / 1000);
    center.classList.toggle('white', counting && (st.mode === 'running' || st.mode === 'done'));
    read.textContent = counting ? `${pad(Math.floor(s / 60))}:${pad(s % 60)}` : '';
    read.classList.toggle('idle', st.mode === 'paused');
    hand.classList.toggle('on', counting);
    if (counting) hand.style.transform = `rotate(${((ms / 1000) % 60) / 60 * 360}deg)`;
    el.classList.toggle('timer-done', st.mode === 'done');
  }

  const moving = () => Math.abs(vel) > 0.01 || snapping;

  // ---- physics ----
  function physics(dt) {
    if (dragging) return;
    if (Math.abs(vel) > 0.6) {
      pos += vel * dt;
      vel *= Math.pow(0.22, dt);                  // friction: a flick coasts for a while
      if (pos < 1 || pos > MAX) { pos = clamp(pos, 1, MAX); vel = 0; }
    } else {
      // spring onto the nearest whole minute
      const target = clamp(Math.round(pos + vel * 0.15), 1, MAX);
      const k = 1 - Math.pow(0.0008, dt);
      pos += (target - pos) * k;
      vel = 0;
      snapping = Math.abs(target - pos) > 0.002;
      if (!snapping) {
        pos = target;
        if (st.minutes !== target) { st.minutes = target; save(); }
      }
    }
    const whole = Math.round(pos);
    if (whole !== lastWhole) { lastWhole = whole; tick(2400, 0.01, 0.045); }
  }

  let raf = 0, last = performance.now(), lastSec = -1;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    physics(dt);
    if (st.mode === 'running') {
      const left = st.endAt - Date.now();
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) { lastSec = sec; if (sec <= 5 && sec > 0) tick(1200, 0.03, 0.06); }
      if (left <= 0) { st.mode = 'done'; save(); pop(center); }
    }
    if (st.mode === 'done') ring();
    paint();
    raf = requestAnimationFrame(loop);
  }

  let lastRing = 0;
  function ring() {
    const now = performance.now();
    if (now - lastRing < 900) return;
    lastRing = now;
    const ctx = audio();
    if (ctx) {
      [0, 0.18, 0.36].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 1320;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.16);
      });
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function start() {
    audio(); // unlock audio inside the user gesture
    st.minutes = clamp(Math.round(pos), 1, MAX);
    pos = st.minutes;
    st.total = st.minutes * 60000;
    st.endAt = Date.now() + st.total;
    st.mode = 'running';
    save();
    tick(700, 0.05);
    pop(center);
  }

  function tap() {
    if (st.mode === 'idle') return start();
    if (st.mode === 'running') { st.remaining = st.endAt - Date.now(); st.mode = 'paused'; tick(900); }
    else if (st.mode === 'paused') { st.endAt = Date.now() + st.remaining; st.mode = 'running'; tick(700); }
    else { st.mode = 'idle'; pos = st.minutes; tick(600); }
    save();
    pop(center);
  }

  function reset() {
    st.mode = 'idle';
    st.total = 0;
    pos = st.minutes;
    save();
    pop(center);
    tick(600);
  }

  // ---- gestures: drag the reel freely (even while counting), tap to start/pause, hold to reset ----
  let y0 = 0, pos0 = 0, moved = false, pressTimer = 0, samples = [];
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    y0 = e.clientY;
    moved = false; samples = [];
    pressTimer = setTimeout(() => {
      if (!moved && (st.mode === 'paused' || st.mode === 'running')) { reset(); pressTimer = -1; }
    }, 650);
    // the reel only turns while choosing a time
    dragging = st.mode === 'idle';
    if (!dragging) return;
    vel = 0; snapping = false;
    pos0 = pos;
  });
  stage.addEventListener('pointermove', (e) => {
    const dy = e.clientY - y0;
    if (!moved && Math.abs(dy) > 6) { moved = true; clearTimeout(pressTimer); }
    if (!dragging) return;
    if (!moved) return;
    const now = performance.now();
    samples.push([now, e.clientY]);
    samples = samples.filter(([t]) => now - t < 90);
    let p = pos0 + dy / step;
    // rubber band past the ends
    if (p < 1) p = 1 - (1 - p) * 0.3;
    if (p > MAX) p = MAX + (p - MAX) * 0.3;
    pos = p;
  });
  const end = () => {
    const wasDragging = dragging;
    dragging = false;
    clearTimeout(pressTimer);
    if (pressTimer === -1) { pressTimer = 0; return; }
    if (!moved) { tap(); return; }
    if (!wasDragging) return;
    // fling speed from the last few samples; a finger that stopped before lifting doesn't fling
    const nowT = performance.now();
    samples = samples.filter(([t]) => nowT - t < 100);
    if (samples.length > 1) {
      const [t0, ya] = samples[0], [t1, yb] = samples[samples.length - 1];
      vel = t1 > t0 ? (((yb - ya) / step) / ((t1 - t0) / 1000)) * 1.6 : 0;
      vel = clamp(vel, -80, 80);
    }
    if (pos < 1 || pos > MAX) vel = 0;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (st.mode !== 'idle') return;
    pos = clamp(pos - e.deltaY / step, 1, MAX);
    vel = 0;
  }, { passive: false });

  function openSettings() {
    sheet((p, close) => {
      p.append(h('h3', {}, 'タイマー'));
      const presets = [1, 3, 5, 10, 15, 25, 30, 45, 60];
      p.append(h('div', { class: 'seg' }, presets.map((m) =>
        h('button', { class: st.minutes === m ? 'on' : '', onclick: () => { reset(); st.minutes = m; pos = m; save(); close(); } }, `${m}分`))));
      p.append(
        h('div', { class: 'row' }, h('span', { class: 'val' }, '上下にスワイプで時間を選ぶ　タップ: スタート / 一時停止　長押し: リセット')),
        h('button', { class: 'btn', onclick: () => { reset(); close(); } }, 'リセット'),
        h('button', { class: 'btn', onclick: () => { store.set('settings.sound', !store.get('settings.sound', true)); close(); } },
          `操作音: ${store.get('settings.sound', true) ? 'オン' : 'オフ'}`));
    });
  }

  const el = h('div', { class: 'screen timer' },
    topbar({ right: [iconBtn('sliders', openSettings, '設定')] }),
    stage);

  requestAnimationFrame(() => { measure(); raf = requestAnimationFrame(loop); });
  const onResize = () => measure();
  window.addEventListener('resize', onResize);

  return { el, destroy: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); } };
}
