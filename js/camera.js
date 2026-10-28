import { h, icons, sheet, store, tick, toast } from './ui.js';

/*
 * Silent camera: the system shutter is never used. The preview is a plain <video>
 * of the camera stream and the shutter copies the current frame onto a canvas,
 * so iOS plays no shutter sound (same approach as the earlier 無音カメラ app).
 */

// ---------- storage (IndexedDB) ----------
const DB = 'quint-camera';
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('photos', mode);
    const res = fn(t.objectStore('photos'));
    t.oncomplete = () => resolve(res?.result);
    t.onerror = () => reject(t.error);
  });
}
const putPhoto = (p) => tx('readwrite', (s) => s.put(p));
const delPhoto = (id) => tx('readwrite', (s) => s.delete(id));
const allPhotos = () => tx('readonly', (s) => s.getAll()).then((x) => (x || []).sort((a, b) => b.id - a.id));

const FILTERS = [
  { key: 'A', label: 'AUTO', css: 'none' },
  { key: 'M', label: 'MONO', css: 'grayscale(1) contrast(1.15)' },
  { key: 'W', label: 'WARM', css: 'sepia(.25) saturate(1.15) contrast(1.05)' },
  { key: 'F', label: 'FADE', css: 'contrast(.86) brightness(1.08) saturate(.8)' },
];
const EV_MIN = -2, EV_MAX = 2;
const MAX_ZOOM = 10;

function cameraErrorText(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'カメラへのアクセスが許可されていません。\nSafari のアドレスバー左の「ぁあ」→「Webサイトの設定」→「カメラ」を「許可」にしてください。';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'カメラが見つかりませんでした。';
    case 'NotReadableError':
    case 'AbortError':
      return 'カメラを起動できませんでした。\n他のアプリがカメラを使っていないか確認してください。';
    default:
      return `カメラを起動できませんでした（${err?.name || 'エラー'}）。`;
  }
}

// A knurled cylinder you roll with a finger. onStep(+1/-1) fires every `pitch` px.
function drum({ vertical = false, pitch = 14, onStep, label }) {
  const lbl = h('div', { class: 'lbl' });
  const el = h('div', { class: `drum well ${vertical ? 'vertical' : ''}` }, h('div', { class: 'cyl' }), lbl);
  let last = null, acc = 0, off = 0, hideT = 0;
  el.addEventListener('pointerdown', (e) => { last = vertical ? e.clientY : e.clientX; el.setPointerCapture(e.pointerId); flash(); });
  el.addEventListener('pointermove', (e) => {
    if (last == null) return;
    const p = vertical ? e.clientY : e.clientX;
    const d = p - last;
    last = p;
    off += d;
    el.style.setProperty('--off', `${off}px`);
    acc += d;
    while (Math.abs(acc) >= pitch) {
      const dir = acc > 0 ? 1 : -1;
      acc -= dir * pitch;
      onStep(vertical ? -dir : dir);
      tick(2600, 0.008, 0.05);
      flash();
    }
  });
  const end = () => { last = null; acc = 0; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  function flash() {
    lbl.textContent = label();
    el.classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(() => el.classList.remove('show'), 1000);
  }
  return el;
}

export default function camera() {
  const prefs = Object.assign({ facing: 'environment', filter: 0, grid: true, timer: 0, ev: 0 }, store.get('camera.prefs', {}));
  const savePrefs = () => store.set('camera.prefs', prefs);
  let stream = null, track = null, alive = true, startSeq = 0;
  let zoomCaps = null, zoom = 1, evCaps = null, torchOn = false;

  const video = h('video', { autoplay: true, playsinline: true, muted: true });
  video.muted = true;
  const msg = h('div', { class: 'cam-msg' });
  const flash = h('div', { class: 'cam-flash' });
  const badge = h('div', { class: 'cam-badge' });
  const grid = h('div', { class: 'cam-grid' });
  const count = h('div', { class: 'cam-count' });
  const view = h('div', { class: 'cam-view' }, video, grid, flash, badge, count, msg);

  // ----- controls -----
  const letter = h('span', { class: 'letter' });
  const filterKnob = h('button', { class: 'knob', 'aria-label': 'フィルター', onclick: () => {
    prefs.filter = (prefs.filter + 1) % FILTERS.length;
    savePrefs(); tick(); applyLook(); showBadge(FILTERS[prefs.filter].label);
  } }, letter);
  const settingsKnob = h('button', { class: 'knob', 'aria-label': '設定', html: icons.sliders, onclick: openSettings });

  const evDrum = drum({ pitch: 16, onStep: (d) => setEv(prefs.ev + d / 3), label: () => `EV ${prefs.ev >= 0 ? '+' : ''}${prefs.ev.toFixed(1)}` });
  const zoomDrum = drum({ vertical: true, pitch: 10, onStep: (d) => setZoom(zoom * (d > 0 ? 1.06 : 1 / 1.06)), label: () => `${zoom.toFixed(1)}×` });

  const flip = h('button', { class: 'switch well', 'aria-label': '前面/背面カメラ', onclick: () => {
    prefs.facing = prefs.facing === 'user' ? 'environment' : 'user';
    savePrefs(); tick(1400); startCamera();
  } }, h('span', { class: 'knob' }));

  const lensReel = h('div', { class: 'reel' });
  const lens = h('button', { class: 'lens well', 'aria-label': 'ズーム', onclick: () => cyclePreset() }, h('div', { class: 'face' }, lensReel));

  const thumb = h('button', { class: 'cam-thumb', 'aria-label': 'ギャラリー', onclick: () => openGallery() });
  const shutter = h('button', { class: 'knob shutter', 'aria-label': '撮影', onclick: () => shoot(),
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' });

  const el = h('div', { class: 'screen camera' },
    h('div', { class: 'cam-top' },
      h('div', { class: 'cam-col' },
        h('div', { class: 'holder well' }, settingsKnob),
        h('div', { class: 'holder well' }, filterKnob)),
      evDrum,
      flip),
    view,
    h('div', { class: 'cam-bottom' },
      h('div', { class: 'cam-col' }, lens, thumb),
      h('div', { class: 'shutter-well well' }, shutter),
      zoomDrum));

  // ----- look: filter, exposure fallback, digital zoom -----
  function cssFilter() {
    const f = FILTERS[prefs.filter].css;
    const ev = evCaps ? '' : `brightness(${Math.pow(2, prefs.ev * 0.5).toFixed(3)})`;
    return [f === 'none' ? '' : f, ev].filter(Boolean).join(' ') || 'none';
  }
  function applyLook() {
    letter.textContent = FILTERS[prefs.filter].key;
    video.style.filter = cssFilter();
    const digital = zoomCaps ? 1 : zoom;
    video.style.transform = `${prefs.facing === 'user' ? 'scaleX(-1) ' : ''}scale(${digital})`;
    grid.style.display = prefs.grid ? '' : 'none';
    flip.classList.toggle('on', prefs.facing === 'user');
    paintLens();
  }
  let badgeT = 0;
  function showBadge(text) {
    badge.textContent = text;
    badge.classList.add('show');
    clearTimeout(badgeT);
    badgeT = setTimeout(() => badge.classList.remove('show'), 1100);
  }

  const presets = () => {
    const min = zoomCaps ? zoomCaps.min : 1;
    const max = zoomCaps ? Math.min(zoomCaps.max, MAX_ZOOM) : 5;
    return [0.5, 1, 2, 3, 5].filter((z) => z >= min - 0.01 && z <= max + 0.01);
  };
  function paintLens() {
    const list = presets();
    lensReel.replaceChildren(...list.map((z) => h('span', {}, String(z).replace(/^0\./, '.'))));
    let near = 0;
    list.forEach((z, i) => { if (Math.abs(z - zoom) < Math.abs(list[near] - zoom)) near = i; });
    lensReel.style.transform = `translateY(${-22 - near * 44}px)`;
  }
  function cyclePreset() {
    const list = presets();
    const next = list.find((z) => z > zoom + 0.05) ?? list[0];
    setZoom(next);
    tick(1500);
    showBadge(`${next}×`);
  }
  let zoomFrame = null;
  function setZoom(z) {
    const min = zoomCaps ? zoomCaps.min : 1;
    const max = zoomCaps ? Math.min(zoomCaps.max, MAX_ZOOM) : 5;
    zoom = Math.min(max, Math.max(min, z));
    if (zoomCaps && track && zoomFrame == null) {
      zoomFrame = requestAnimationFrame(() => {
        zoomFrame = null;
        track?.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
      });
    }
    applyLook();
  }
  function setEv(v) {
    prefs.ev = Math.round(Math.min(EV_MAX, Math.max(EV_MIN, v)) * 3) / 3;
    savePrefs();
    if (evCaps && track) {
      const val = Math.min(evCaps.max, Math.max(evCaps.min, prefs.ev));
      track.applyConstraints({ advanced: [{ exposureMode: 'continuous', exposureCompensation: val }] }).catch(() => {});
    }
    applyLook();
  }

  // ----- stream -----
  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null; track = null;
    video.srcObject = null;
  }
  function showMessage(text, retry) {
    msg.style.display = '';
    msg.replaceChildren(text, retry ? h('button', { onclick: startCamera }, '再試行') : '');
  }
  async function startCamera() {
    const seq = ++startSeq;
    stopCamera();
    applyLook();
    if (!window.isSecureContext) { showMessage('カメラは https:// で開いたページでのみ使えます。'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { showMessage('このブラウザではカメラを使えません。\niPhone の Safari で開いてください。'); return; }
    showMessage('カメラを起動しています…');
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: prefs.facing }, width: { ideal: 4032 }, height: { ideal: 3024 } }, audio: false,
      });
    } catch (err) {
      if (seq === startSeq) showMessage(cameraErrorText(err), true);
      return;
    }
    if (seq !== startSeq || !alive) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    track = s.getVideoTracks()[0];
    video.srcObject = s;
    try { await video.play(); } catch {}
    msg.style.display = 'none';
    const caps = track.getCapabilities?.() || {};
    zoomCaps = caps.zoom && caps.zoom.max > caps.zoom.min ? caps.zoom : null;
    zoom = zoomCaps ? (track.getSettings().zoom ?? zoomCaps.min) : 1;
    evCaps = caps.exposureCompensation && caps.exposureCompensation.max > caps.exposureCompensation.min ? caps.exposureCompensation : null;
    torchOn = false;
    setEv(prefs.ev);
  }

  // ----- capture -----
  let counting = false;
  async function shoot() {
    if (counting) return;
    if (!track || !video.videoWidth) { toast('カメラが準備できていません'); return; }
    if (prefs.timer) {
      counting = true;
      for (let n = prefs.timer; n > 0; n--) {
        count.textContent = n;
        tick(1000, 0.03, 0.05);
        await new Promise((r) => setTimeout(r, 1000));
        if (!alive) return;
      }
      count.textContent = '';
      counting = false;
    }
    const w = video.videoWidth, hgt = video.videoHeight;
    const digital = zoomCaps ? 1 : zoom;
    const c = document.createElement('canvas');
    c.width = w; c.height = hgt;
    const ctx = c.getContext('2d');
    ctx.filter = cssFilter();
    if (prefs.facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    const sw = w / digital, sh = hgt / digital;
    ctx.drawImage(video, (w - sw) / 2, (hgt - sh) / 2, sw, sh, 0, 0, w, hgt);
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    try {
      const blob = await new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('toBlob'))), 'image/jpeg', 0.92));
      await putPhoto({ id: Date.now(), blob, w, h: hgt });
      setThumb(blob);
    } catch {
      toast('写真を保存できませんでした');
    } finally {
      c.width = 0; c.height = 0;
    }
  }

  let thumbUrl;
  function setThumb(blob) {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = blob ? URL.createObjectURL(blob) : null;
    thumb.style.backgroundImage = thumbUrl ? `url(${thumbUrl})` : '';
  }

  // share sheet must open right after the tap, so no await before navigator.share
  function exportPhoto(ph) {
    const f = new File([ph.blob], `quint-${ph.id}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [f] })) {
      navigator.share({ files: [f] }).catch((e) => { if (e.name !== 'AbortError') toast('共有できませんでした'); });
    } else {
      const a = h('a', { href: URL.createObjectURL(f), download: f.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }
  }

  async function openGallery() {
    const photos = await allPhotos().catch(() => []);
    const urls = [];
    sheet((p, close) => {
      p.append(h('h3', {}, `写真 (${photos.length})`));
      if (!photos.length) p.append(h('div', { class: 'row' }, h('span', { class: 'val' }, 'まだ写真がありません')));
      p.append(h('div', { class: 'cam-gallery' }, photos.map((ph) => {
        const u = URL.createObjectURL(ph.blob);
        urls.push(u);
        return h('button', { style: { backgroundImage: `url(${u})` }, onclick: () => { close(); openPhoto(ph); } });
      })));
    });
    const obs = new MutationObserver(() => {
      if (!document.querySelector('.sheet-backdrop')) { obs.disconnect(); urls.forEach(URL.revokeObjectURL); }
    });
    obs.observe(document.getElementById('app'), { childList: true });
  }

  function openPhoto(ph) {
    const u = URL.createObjectURL(ph.blob);
    const close = () => { pv.remove(); URL.revokeObjectURL(u); };
    const pv = h('div', { class: 'photo-view' },
      h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', 'aria-label': '閉じる', html: icons.back, onclick: close })),
      h('img', { src: u, alt: '' }),
      h('div', { class: 'bar' },
        h('button', { onclick: () => exportPhoto(ph) }, '写真に保存 / 共有'),
        h('button', { style: { color: '#ff5a4a' }, onclick: async () => {
          if (!confirm('この写真を削除しますか？')) return;
          await delPhoto(ph.id);
          close();
          const rest = await allPhotos().catch(() => []);
          setThumb(rest[0]?.blob);
        } }, '削除')));
    document.getElementById('app').append(pv);
  }

  function openSettings() {
    sheet((p, close) => {
      const timerSeg = h('div', { class: 'seg' }, [0, 3, 10].map((t) => h('button', {
        class: prefs.timer === t ? 'on' : '', onclick: () => { prefs.timer = t; savePrefs(); close(); },
      }, t ? `${t}秒` : 'オフ')));
      const caps = track?.getCapabilities?.() || {};
      p.append(h('h3', {}, 'カメラ'),
        h('div', { class: 'row' }, h('span', {}, 'セルフタイマー'), timerSeg),
        h('button', { class: 'btn', onclick: () => { prefs.grid = !prefs.grid; savePrefs(); applyLook(); close(); } }, `グリッド: ${prefs.grid ? 'オン' : 'オフ'}`),
        caps.torch && h('button', { class: 'btn', onclick: async () => {
          try { await track.applyConstraints({ advanced: [{ torch: !torchOn }] }); torchOn = !torchOn; } catch {}
          close();
        } }, `ライト: ${torchOn ? 'オン' : 'オフ'}`),
        h('button', { class: 'btn', onclick: () => { setEv(0); setZoom(1); close(); } }, '露出とズームをリセット'),
        h('button', { class: 'btn', onclick: () => { close(); openGallery(); } }, 'ライブラリ'),
        h('div', { class: 'row' }, h('span', { class: 'val', style: { fontSize: '13px', lineHeight: '1.6' } },
          'シャッター音は鳴りません（映像の1コマを切り出して保存します）。上のダイヤルで明るさ、右のホイールと左下のレンズでズーム、右上のスイッチで前面/背面を切り替えます。')));
    });
  }

  const onKey = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); shoot(); } };
  window.addEventListener('keydown', onKey);
  const onVis = () => { if (document.hidden) stopCamera(); else if (alive) startCamera(); };
  document.addEventListener('visibilitychange', onVis);

  startCamera();
  allPhotos().then((ps) => setThumb(ps[0]?.blob)).catch(() => {});

  return {
    el,
    destroy: () => {
      alive = false;
      startSeq++;
      stopCamera();
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    },
  };
}
