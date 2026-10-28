import { h, emboss, setEmboss, iconBtn, topbar, sheet, store, tick, audio, pop } from './ui.js';

const MAX = 99;
const pad = (n) => String(n).padStart(2, '0');

export default function timer() {
  // mode: idle | running | paused | done
  const st = Object.assign({ mode: 'idle', minutes: 5, endAt: 0, remaining: 0, total: 0 }, store.get('timer.state', {}));
  const save = () => store.set('timer.state', st);

  const stage = h('div', { class: 'timer-stage' });
  const hand = h('div', { class: 'timer-hand' }, h('i'));
  const reel = h('div', { class: 'timer-reel' });
  const slots = [-2, -1, 0, 1, 2].map((o) => {
    const num = emboss('0');
    const slot = h('div', { class: 'timer-num' }, num);
    reel.append(slot);
    return { o, slot, num };
  });
  const center = slots[2].num.firstElementChild;
  const read = h('div', { class: 'timer-read' });
  stage.append(hand, reel, read);

  let drag = 0; // px offset while dragging
  let step = 300;
  function measure() {
    const fs = parseFloat(getComputedStyle(slots[0].slot).fontSize) || 300;
    step = fs * 0.9;
  }

  function msLeft() {
    if (st.mode === 'running') return Math.max(0, st.endAt - Date.now());
    if (st.mode === 'paused') return st.remaining;
    return 0;
  }

  function paint() {
    const idle = st.mode === 'idle';
    const ms = msLeft();
    const s = Math.ceil(ms / 1000);
    const big = idle ? st.minutes : s < 60 ? s : Math.ceil(s / 60);
    const shift = drag / step;
    for (const { o, slot, num } of slots) {
      const v = big - o; // larger values sit above
      slot.style.visibility = (idle ? v >= 1 && v <= MAX : o === 0) ? 'visible' : 'hidden';
      slot.style.transform = `translateY(calc(-50% + ${(o + shift) * step}px))`;
      slot.style.opacity = o === 0 ? 1 : Math.max(0, 0.7 - Math.abs(o + shift) * 0.2);
      setEmboss(num, pad(v));
    }
    center.classList.toggle('white', st.mode === 'running' || st.mode === 'done');
    read.textContent = idle ? `${pad(st.minutes)}:00` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    read.classList.toggle('idle', idle || st.mode === 'paused');
    // the second hand sweeps once a minute while the timer runs
    hand.classList.toggle('on', !idle);
    if (!idle) hand.style.transform = `rotate(${((ms / 1000) % 60) / 60 * 360}deg)`;
    el.classList.toggle('timer-done', st.mode === 'done');
  }

  let raf = 0;
  let lastWhole = -1;
  function loop() {
    if (st.mode === 'running') {
      const left = st.endAt - Date.now();
      const whole = Math.ceil(left / 1000);
      if (whole !== lastWhole) { lastWhole = whole; if (whole <= 5 && whole > 0) tick(1200, 0.03, 0.06); }
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

  function tap() {
    audio(); // unlock audio inside the user gesture
    if (st.mode === 'idle') {
      st.total = st.minutes * 60000;
      st.endAt = Date.now() + st.total;
      st.mode = 'running';
      tick(700, 0.05);
    } else if (st.mode === 'running') {
      st.remaining = st.endAt - Date.now();
      st.mode = 'paused';
      tick(900);
    } else if (st.mode === 'paused') {
      st.endAt = Date.now() + st.remaining;
      st.mode = 'running';
      tick(700);
    } else {
      st.mode = 'idle';
      tick(600);
    }
    save();
    paint();
    pop(center);
  }

  function reset() {
    st.mode = 'idle';
    st.total = 0;
    save();
    paint();
    pop(center);
    tick(600);
  }

  // gestures: vertical drag adjusts minutes when idle; tap toggles; long press resets
  let y0 = null, moved = false, pressTimer = 0, lastSteps = 0;
  stage.addEventListener('pointerdown', (e) => {
    y0 = e.clientY; moved = false; lastSteps = 0;
    stage.setPointerCapture(e.pointerId);
    pressTimer = setTimeout(() => {
      if (!moved && (st.mode === 'paused' || st.mode === 'running')) { reset(); y0 = null; }
    }, 650);
  });
  stage.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    if (Math.abs(dy) > 8) { moved = true; clearTimeout(pressTimer); }
    if (!moved || st.mode !== 'idle') return;
    const steps = Math.round(dy / step);
    const target = Math.min(MAX, Math.max(1, st.minutes + (steps - lastSteps)));
    if (target !== st.minutes) { st.minutes = target; tick(2200, 0.012); }
    lastSteps = steps;
    drag = dy - steps * step;
    if ((st.minutes === MAX && drag > 0) || (st.minutes === 1 && drag < 0)) drag *= 0.3;
  });
  const end = () => {
    clearTimeout(pressTimer);
    if (y0 == null) return;
    y0 = null;
    if (!moved) { tap(); return; }
    const from = drag;
    const t0 = performance.now();
    const settle = (t) => {
      const k = Math.min(1, (t - t0) / 220);
      drag = from * (1 - k) ** 3;
      if (k < 1) requestAnimationFrame(settle); else drag = 0;
    };
    requestAnimationFrame(settle);
    save();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.addEventListener('wheel', (e) => {
    if (st.mode !== 'idle') return;
    e.preventDefault();
    st.minutes = Math.min(MAX, Math.max(1, st.minutes + (e.deltaY > 0 ? -1 : 1)));
    tick(2200, 0.012);
    save();
  }, { passive: false });

  function openSettings() {
    sheet((p, close) => {
      p.append(h('h3', {}, 'タイマー'));
      const presets = [1, 3, 5, 10, 15, 25, 30, 45, 60];
      p.append(h('div', { class: 'seg' }, presets.map((m) =>
        h('button', { class: st.minutes === m ? 'on' : '', onclick: () => { st.minutes = m; st.mode = 'idle'; save(); close(); pop(center); } }, `${m}分`))));
      p.append(
        h('div', { class: 'row' }, h('span', { class: 'val' }, 'タップ: スタート / 一時停止　長押し: リセット')),
        h('button', { class: 'btn', onclick: () => { reset(); close(); } }, 'リセット'),
        h('button', { class: 'btn', onclick: () => { store.set('settings.sound', !store.get('settings.sound', true)); close(); } },
          `操作音: ${store.get('settings.sound', true) ? 'オン' : 'オフ'}`));
    });
  }

  const el = h('div', { class: 'screen timer' },
    topbar({ right: [iconBtn('sliders', openSettings, '設定')] }),
    stage);

  requestAnimationFrame(() => { measure(); loop(); });
  const onResize = () => measure();
  window.addEventListener('resize', onResize);

  return { el, destroy: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); } };
}
