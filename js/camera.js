import { h, iconBtn, topbar, sheet, store, tick, toast, icons } from './ui.js';

// Photos are kept in IndexedDB so they survive reloads.
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

const FILTERS = {
  natural: { label: 'NATURAL', css: 'contrast(1.02) saturate(.96)' },
  mono: { label: 'MONO', css: 'grayscale(1) contrast(1.15)' },
  warm: { label: 'WARM', css: 'sepia(.25) saturate(1.15) contrast(1.05)' },
  fade: { label: 'FADE', css: 'contrast(.86) brightness(1.08) saturate(.8)' },
};

export default function camera({ back }) {
  let facing = store.get('camera.facing', 'environment');
  let filter = store.get('camera.filter', 'natural');
  let stream = null;
  let alive = true;

  const video = h('video', { autoplay: true, playsinline: true, muted: true });
  video.muted = true;
  const msg = h('div', { class: 'cam-msg' }, 'カメラを起動しています…');
  const flash = h('div', { class: 'cam-flash' });
  const badge = h('div', { class: 'cam-badge' });
  const view = h('div', { class: 'cam-view' }, video, h('div', { class: 'cam-grid' }), flash, badge, msg);
  const thumb = h('button', { class: 'cam-thumb', 'aria-label': 'ギャラリー', onclick: () => openGallery() });

  function applyFilter() {
    video.style.filter = FILTERS[filter].css;
    video.classList.toggle('mirror', facing === 'user');
    badge.textContent = FILTERS[filter].label;
    filterBar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
  }

  async function startStream() {
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      msg.textContent = 'このブラウザではカメラを使えません。HTTPS で開いてください。';
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false,
      });
      if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      video.srcObject = s;
      msg.style.display = 'none';
    } catch (e) {
      msg.style.display = '';
      msg.textContent = e.name === 'NotAllowedError'
        ? 'カメラへのアクセスが許可されていません。設定から許可してください。'
        : 'カメラを起動できませんでした。';
    }
  }
  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function shoot() {
    if (!stream || !video.videoWidth) { toast('カメラが準備できていません'); return; }
    tick(500, 0.06, 0.12);
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    const w = video.videoWidth, hgt = video.videoHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = hgt;
    const ctx = c.getContext('2d');
    ctx.filter = FILTERS[filter].css;
    if (facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, hgt);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    const photo = { id: Date.now(), blob, filter };
    try { await putPhoto(photo); } catch { toast('保存できませんでした'); }
    setThumb(blob);
  }

  let thumbUrl;
  function setThumb(blob) {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = blob ? URL.createObjectURL(blob) : null;
    thumb.style.backgroundImage = thumbUrl ? `url(${thumbUrl})` : '';
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
    // free object URLs once the sheet is gone
    const obs = new MutationObserver(() => {
      if (!document.querySelector('.sheet-backdrop')) { obs.disconnect(); urls.forEach(URL.revokeObjectURL); }
    });
    obs.observe(document.getElementById('app'), { childList: true });
  }

  function openPhoto(ph) {
    const u = URL.createObjectURL(ph.blob);
    const close = () => { pv.remove(); URL.revokeObjectURL(u); };
    const file = () => new File([ph.blob], `quint-${ph.id}.jpg`, { type: 'image/jpeg' });
    const pv = h('div', { class: 'photo-view' },
      topbar({ left: [iconBtn('back', close, '閉じる')] }),
      h('img', { src: u, alt: '' }),
      h('div', { class: 'bar' },
        h('button', { onclick: async () => {
          const f = file();
          if (navigator.canShare?.({ files: [f] })) {
            try { await navigator.share({ files: [f] }); } catch {}
          } else {
            const a = h('a', { href: u, download: f.name });
            a.click();
          }
        } }, '保存 / 共有'),
        h('button', { style: { color: '#ff5a4a' }, onclick: async () => {
          await delPhoto(ph.id);
          close();
          const rest = await allPhotos().catch(() => []);
          setThumb(rest[0]?.blob);
        } }, '削除')));
    document.getElementById('app').append(pv);
  }

  const filterBar = h('div', { class: 'cam-filters' }, Object.entries(FILTERS).map(([k, f]) =>
    h('button', { 'data-f': k, onclick: () => { filter = k; store.set('camera.filter', k); tick(); applyFilter(); } }, f.label)));

  const el = h('div', { class: 'screen camera' },
    topbar({ left: [iconBtn('back', back, '戻る')], right: [iconBtn('sliders', () => openSettings(), '設定')] }),
    view,
    h('div', { class: 'cam-body' },
      filterBar,
      h('div', { class: 'cam-controls' },
        thumb,
        h('button', { class: 'shutter', 'aria-label': 'シャッター', onclick: shoot }),
        h('button', { class: 'cam-flip', 'aria-label': 'カメラ切替', html: icons.flip, onclick: () => {
          facing = facing === 'user' ? 'environment' : 'user';
          store.set('camera.facing', facing);
          tick(); applyFilter(); startStream();
        } }))));

  function openSettings() {
    sheet((p, close) => {
      const gridOn = store.get('camera.grid', true);
      p.append(h('h3', {}, 'カメラ'),
        h('button', { class: 'btn', onclick: () => { store.set('camera.grid', !gridOn); applyGrid(); close(); } }, `グリッド: ${gridOn ? 'オン' : 'オフ'}`),
        h('button', { class: 'btn', onclick: () => { close(); openGallery(); } }, 'ギャラリー'));
    });
  }
  const applyGrid = () => { view.querySelector('.cam-grid').style.display = store.get('camera.grid', true) ? '' : 'none'; };

  // keyboard shutter: space / enter
  const onKey = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); shoot(); } };
  window.addEventListener('keydown', onKey);
  const onVis = () => { if (document.hidden) stopStream(); else if (alive) startStream(); };
  document.addEventListener('visibilitychange', onVis);

  applyFilter();
  applyGrid();
  startStream();
  allPhotos().then((ps) => setThumb(ps[0]?.blob)).catch(() => {});

  return {
    el,
    destroy: () => {
      alive = false;
      stopStream();
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    },
  };
}
