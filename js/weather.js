import { h, emboss, setEmboss, iconBtn, icons, topbar, sheet, store, toast, tick, pop } from './ui.js';
import { PAGES, createPanel, model as detailModel, sceneInfo } from './wxdetail.js';

// WMO weather codes → [label, kind]
const CODES = {
  0: ['晴天', 'clear'], 1: ['ほぼ快晴', 'clear'], 2: ['晴れ時々曇り', 'partly'], 3: ['曇り', 'cloudy'],
  45: ['霧', 'fog'], 48: ['霧氷', 'fog'],
  51: ['弱い霧雨', 'rain'], 53: ['霧雨', 'rain'], 55: ['強い霧雨', 'rain'], 56: ['着氷性の霧雨', 'rain'], 57: ['着氷性の霧雨', 'rain'],
  61: ['小雨', 'rain'], 63: ['雨', 'rain'], 65: ['大雨', 'rain'], 66: ['着氷性の雨', 'rain'], 67: ['着氷性の大雨', 'rain'],
  71: ['小雪', 'snow'], 73: ['雪', 'snow'], 75: ['大雪', 'snow'], 77: ['霧雪', 'snow'],
  80: ['にわか雨', 'rain'], 81: ['にわか雨', 'rain'], 82: ['激しいにわか雨', 'rain'],
  85: ['にわか雪', 'snow'], 86: ['激しいにわか雪', 'snow'],
  95: ['雷雨', 'storm'], 96: ['雹を伴う雷雨', 'storm'], 99: ['雹を伴う雷雨', 'storm'],
};
const code = (c) => CODES[c] || ['—', 'cloudy'];
const WD = ['日', '月', '火', '水', '木', '金', '土'];
// Moon phase 0..1 (0 = new, 0.5 = full) from a known new moon and the synodic month.
export function moonPhase(date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - ref) / 864e5;
  return (((days / 29.530588853) % 1) + 1) % 1;
}
function moonName(p) {
  const names = ['新月', '三日月', '上弦の月', '十三夜', '満月', '寝待月', '下弦の月', '有明月'];
  return names[Math.round(p * 8) % 8];
}

const DEFAULT_PLACE = { name: '東京', lat: 35.6812, lon: 139.7671 };

// ---------- art: glossy grainy spheres, like little sculptures ----------
function sphere(id, cx, cy, r, cls = '') {
  return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
}
function streak(x, y, w, rot, op = 1) {
  return `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="2.6" fill="currentColor" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`;
}

export function artSVG(kind, isDay) {
  const cloudGrad = kind === 'snow' || kind === 'fog' ? 'gCloudLight' : 'gCloud';
  const sun = isDay
    ? sphere('gSun', 200, 118, 112)
    : `<g>${sphere('gMoon', 200, 118, 112)}<path d="M266 30a112 112 0 0 1 0 176a120 120 0 0 0 0-176z" fill="#000" opacity=".55"/></g>`;
  const shadow = (x, w) => `<ellipse cx="${x}" cy="246" rx="${w}" ry="10" fill="currentColor" opacity="${isDay ? 0.08 : 0.25}" filter="url(#blur)"/>`;
  let body = '';
  const clouds = (list) => list.map(([x, y, r, d]) => `<g class="wx-float" style="animation-delay:${d}s">${sphere(cloudGrad, x, y, r)}</g>`).join('');

  if (kind === 'clear') {
    body = shadow(200, 90) + sun + streak(150, 30, 46, -6, 0.9) + streak(290, 44, 40, 8, 0.8);
  } else if (kind === 'partly') {
    body = shadow(170, 70) + shadow(300, 50) + sun
      + clouds([[92, 150, 46, 0], [80, 196, 30, 1], [140, 192, 34, 1.5], [200, 120, 40, .5], [250, 128, 44, 2], [190, 186, 54, 1], [345, 186, 18, 3]])
      + streak(140, 34, 44, -4) + streak(300, 30, 44, 6) + streak(150, 82, 34, -3) + streak(270, 148, 50, 10, .9) + streak(76, 168, 16, -20);
  } else {
    const bigSun = kind === 'cloudy' ? `<g opacity=".9" transform="translate(70 -10) scale(.6)">${sun}</g>` : '';
    body = shadow(200, 120) + bigSun
      + clouds([[110, 130, 58, 0], [190, 100, 66, .7], [270, 132, 56, 1.4], [160, 178, 50, 2], [235, 186, 46, .3], [70, 186, 30, 1.1], [330, 176, 26, 2.4]])
      + streak(110, 52, 40, -6) + streak(300, 60, 44, 8) + streak(200, 214, 60, 3, .8);
    if (kind === 'rain' || kind === 'storm') {
      for (let i = 0; i < 16; i++) {
        const x = 80 + ((i * 53) % 240), y = 200 + ((i * 29) % 20);
        body += `<rect class="wx-drop" style="animation-delay:${(i * 0.13) % 1}s" x="${x}" y="${y}" width="5" height="${16 + (i % 3) * 6}" rx="2.5" fill="#2f7fe0"/>`;
      }
    }
    if (kind === 'snow') {
      for (let i = 0; i < 14; i++) {
        body += `<circle class="wx-drop" style="animation-delay:${(i * 0.21) % 1}s;animation-duration:2.4s" cx="${80 + ((i * 47) % 240)}" cy="${205 + ((i * 13) % 20)}" r="5" fill="${isDay ? '#9a9a9a' : '#fff'}"/>`;
      }
    }
    if (kind === 'storm') body += '<path d="M205 190l-26 46h22l-12 40 40-56h-22l14-30z" fill="#ffd60a"/>';
    if (kind === 'fog') body += [0, 1, 2].map((i) => `<rect x="${70 + i * 20}" y="${206 + i * 16}" width="${260 - i * 40}" height="9" rx="4.5" fill="currentColor" opacity=".35"/>`).join('');
  }

  return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gSun" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ff5c52"/><stop offset=".55" stop-color="#ff1c22"/><stop offset="1" stop-color="#c8000c"/></radialGradient>
    <radialGradient id="gMoon" cx=".3" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e9ecec"/><stop offset="1" stop-color="#8e9a98"/></radialGradient>
    <radialGradient id="gCloud" cx=".35" cy=".28" r=".8"><stop offset="0" stop-color="#5a5a5a"/><stop offset=".35" stop-color="#1e1e1e"/><stop offset="1" stop-color="#030303"/></radialGradient>
    <radialGradient id="gCloudLight" cx=".35" cy=".28" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d4d4d4"/><stop offset="1" stop-color="#8a8a8a"/></radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n"/>
      <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" result="a"/>
      <feComposite in="a" in2="SourceGraphic" operator="in" result="g"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="g"/></feMerge>
    </filter>
    <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <g filter="url(#grain)">${body}</g>
</svg>`;
}

function miniIcon(kind) {
  const cloud = '<circle cx="12" cy="18" r="7" fill="#1a1a1a" stroke="#666" stroke-width=".6"/><circle cx="20" cy="17" r="8" fill="#1a1a1a" stroke="#666" stroke-width=".6"/><circle cx="26" cy="21" r="4" fill="#1a1a1a" stroke="#666" stroke-width=".6"/>';
  const m = {
    clear: '<circle cx="16" cy="16" r="10" fill="#ff1c22"/>',
    partly: `<circle cx="20" cy="11" r="8" fill="#ff1c22"/>${cloud}`,
    cloudy: cloud,
    fog: `${cloud}<path d="M6 27h20M9 31h14" stroke="#888" stroke-width="2" stroke-linecap="round"/>`,
    rain: `${cloud}<path d="M11 26l-1 5M17 26l-1 5M23 26l-1 5" stroke="#3b8cff" stroke-width="2" stroke-linecap="round"/>`,
    snow: `${cloud}<circle cx="11" cy="29" r="1.8" fill="#fff"/><circle cx="17" cy="30" r="1.8" fill="#fff"/><circle cx="23" cy="29" r="1.8" fill="#fff"/>`,
    storm: `${cloud}<path d="M17 23l-4 6h4l-2 4" stroke="#ffd60a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 34');
  s.setAttribute('class', 'ic');
  s.innerHTML = m[kind] || m.cloudy;
  return s;
}

const MOON_ICON = '<svg viewBox="0 0 16 16"><path d="M8 1a7 7 0 0 0 0 14z" fill="currentColor"/><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const SUN_ICON = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="#ff1c22"/></svg>';

// ---------- data ----------
async function fetchForecast(place, unit) {
  const p = new URLSearchParams({
    latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: 7,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover',
    hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,precipitation,precipitation_probability,is_day,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,pressure_msl,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,cloud_cover_mean',
    temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: 'ms',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function searchPlace(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: 8, language: 'ja' })}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((x) => ({ name: x.name, sub: [x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude }));
}

async function placeName(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: 'ja' })}`);
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || '現在地';
  } catch { return '現在地'; }
}

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const { latitude: lat, longitude: lon } = p.coords;
        resolve({ name: await placeName(lat, lon), lat, lon, gps: true });
      },
      reject, { timeout: 8000, maximumAge: 10 * 60000 });
  });
}

// ---------- screen ----------
export default function weather({ setTone }) {
  let place = store.get('weather.place', null);
  const unit = () => store.get('weather.unit', 'C');
  let data = null;
  let hours = [];   // next 24 hours [{t, code, pp, day, time}]
  let sel = null;   // index into hours while scrubbing

  const placeBtn = h('button', { class: 'title wx-place', onclick: () => openPlaces() });
  const main = h('div', { class: 'wx-main' });
  const el = h('div', { class: 'screen weather' },
    topbar({ title: placeBtn, right: [iconBtn('sliders', openSettings, '設定')] }),
    main);

  function setNight(night) {
    if (!alive) return;
    el.classList.toggle('night', night);
    setTone(night ? 'dark' : 'light');
  }

  function message(text, retry) {
    main.replaceChildren(h('div', { class: 'wx-msg' }, h('div', {}, text, h('br'),
      retry && h('button', { class: 'btn', onclick: retry }, '再読み込み'))));
  }

  async function load() {
    setNight(new Date().getHours() < 5 || new Date().getHours() >= 18);
    if (!place) {
      message('現在地を取得しています…');
      try { place = await locate(); } catch { place = DEFAULT_PLACE; }
      store.set('weather.place', place);
    }
    placeBtn.innerHTML = '';
    placeBtn.append(...(place.gps ? [h('span', { html: icons.location })] : []), place.name);
    const key = `${place.lat},${place.lon},${unit()},v2`;
    const cached = store.get('weather.cache', null);
    if (cached?.key === key) build(cached.data);
    else message('読み込み中…');
    try {
      const d = await fetchForecast(place, unit());
      if (!alive) return;
      store.set('weather.cache', { key, at: Date.now(), data: d });
      build(d);
    } catch {
      if (!alive) return;
      if (!cached || cached.key !== key) message('天気を取得できませんでした。\n通信状況を確認してください。', load);
      else toast('オフライン: 前回のデータを表示中');
    }
  }

  // detail pages, opened by tapping the numerals
  const dstate = { on: false, page: 0, range: 'day', index: 0 };
  let dm = null, panel = null;

  function toggleDetail() {
    dstate.on = !dstate.on;
    el.classList.toggle('detail', dstate.on);
    tick(1200);
    if (dstate.on) {
      dstate.index = sel ?? 0;
      dstate.range = 'day';
      panel.render();
      hero?.enterDetail(detailPages(), dstate.page);
      syncDetail(0);
    } else {
      hero?.exitDetail();
      shownKey = '';
      show(sel);
    }
  }

  // what each page's model shows at the selected time, and a key that changes when it must be rebuilt
  function detailPages() {
    return PAGES.map(({ id }) => {
      const info = sceneInfo(id, dm, dstate.range, dstate.index);
      const bucket = { temp: info.temp, precip: `${Math.round(info.rain * 2)}${info.snow}`, cloud: Math.round(info.cloud / 20) }[id] ?? '';
      return { page: id, info, key: `${id}:${bucket}` };
    });
  }

  function syncDetail(dir = 0) {
    if (!hero || !dstate.on) return;
    if (dir) hero.showPage(dstate.page);
    const pages = detailPages();
    pages.forEach((p, i) => hero.updateDetail(i, p.info, p.key));
    hero.setMoonPhase(pages[PAGES.findIndex((p) => p.id === 'moon')].info.phase);
  }

  // hero pieces, rebuilt by build() and updated by show()
  let hero = null, artBox, tempNum, condEl, scrub, cursor, bubble, track, shownKey = '';

  // the 3D scene loads on demand; if it cannot load, the flat version is used
  const wx3d = import('./wx3d.js').catch(() => null);

  async function build(d) {
    const mod = await wx3d;
    if (!alive) return;
    data = d;
    const c = d.current;
    const start = Math.max(0, d.hourly.time.findIndex((x) => x >= c.time.slice(0, 13)));
    hours = d.hourly.time.slice(start, start + 24).map((time, i) => ({
      time, t: d.hourly.temperature_2m[start + i], code: d.hourly.weather_code[start + i],
      pp: d.hourly.precipitation_probability?.[start + i] ?? 0, day: !!d.hourly.is_day?.[start + i],
      cc: d.hourly.cloud_cover?.[start + i] ?? null,
    }));
    // hour 0 is "now": use the current conditions
    if (hours[0]) Object.assign(hours[0], { t: c.temperature_2m, code: c.weather_code, day: !!c.is_day, cc: c.cloud_cover ?? hours[0].cc });

    // 3D scene you can spin; flat SVG + CSS numerals if WebGL is unavailable
    hero?.destroy();
    hero = null;
    const stage3d = h('div', { class: 'wx-3d' });
    try {
      if (!mod) throw new Error('3D unavailable');
      hero = mod.createWeather3D(stage3d, { onTap: toggleDetail });
    } catch {
      artBox = h('div', { class: 'wx-art' });
      tempNum = emboss('0', { variant: 'ink' });
      tempNum.addEventListener('click', () => { pop(tempNum.firstElementChild); toggleDetail(); });
      stage3d.classList.add('flat');
      stage3d.append(artBox, h('div', { class: 'wx-temp' }, tempNum));
    }
    condEl = h('div', { class: 'wx-cond' });

    // timeline bar
    const n = hours.length;
    const temps = hours.map((x) => x.t);
    const lo = Math.min(...temps), hi = Math.max(...temps);
    const segs = hours.map((x) => h('div', { class: 'seg-h', 'data-day': x.day ? 1 : 0, 'data-k': (x.t - lo) / ((hi - lo) || 1) }));
    track = h('div', { class: 'wx-track' }, segs);
    const pos = (i) => `${((i + 0.5) / n) * 100}%`;
    const iLo = temps.indexOf(lo), iHi = temps.indexOf(hi);
    const marks = [];
    if (iLo > 2) marks.push(h('span', { class: 'mark', style: { left: pos(iLo) } }, Math.round(lo)));
    if (iHi > 2 && Math.abs(iHi - iLo) > 2) marks.push(h('span', { class: 'mark', style: { left: pos(iHi) } }, Math.round(hi)));
    for (let i = 1; i < n; i++) {
      if (hours[i].day !== hours[i - 1].day && i > 2 && Math.abs(i - iLo) > 1 && Math.abs(i - iHi) > 1) {
        marks.push(h('span', { class: 'mark', style: { left: pos(i) }, html: hours[i].day ? SUN_ICON : MOON_ICON }));
      }
    }
    track.append(h('div', { class: 'now' }, Math.round(hours[0].t)), ...marks, cursor = h('div', { class: 'wx-cursor' }));
    const precip = h('div', { class: 'wx-precip' }, hours.map((x) => h('i', { style: { height: `${x.pp}%` } })));
    const labels = h('div', { class: 'wx-hours' }, hours.map((x, i) => {
      const hr = +x.time.slice(11, 13);
      if (i === 0) return h('span', { style: { left: pos(0) } }, '今');
      if (hr % 3 || i < 2) return null;
      return h('span', { style: { left: pos(i) } }, String(hr));
    }));
    bubble = h('div', { class: 'wx-bubble' });
    scrub = h('div', { class: 'wx-scrub' }, precip, bubble,
      h('div', { class: 'wx-row' }, track, h('button', { class: 'wx-more', 'aria-label': '詳細', html: icons.dots, onclick: openDetails })),
      labels);
    bindScrub();

    dm = detailModel(d);
    panel = createPanel({ getModel: () => dm, state: dstate, onChange: (st, dir) => syncDetail(dir) });
    main.replaceChildren(stage3d, condEl, scrub, panel.el);
    shownKey = '';
    show(null);
    if (dstate.on) { panel.render(); hero?.enterDetail(detailPages(), dstate.page); syncDetail(0); }
  }

  function show(i) {
    if (!alive) return;
    sel = i;
    const x = hours[i ?? 0];
    if (!x) return;
    let [label, kind] = code(x.code);
    // cloud cover in % (fallback guessed from the weather code)
    const cover = x.cc ?? { clear: 10, partly: 45, cloudy: 95 }[kind] ?? 90;
    if (x.code === 3 && cover < 90) label = 'ほぼ曇り';
    const night = !x.day;
    setNight(night);
    const key = `${kind}${night}${Math.round(cover / 15)}`;
    if (key !== shownKey) {
      shownKey = key;
      if (hero) hero.setScene(kind, x.day, cover, Math.round(cover) * 31 + x.code * 7 + 3);
      else {
        artBox.innerHTML = artSVG(kind, x.day);
        artBox.classList.remove('wx-swap'); void artBox.offsetWidth; artBox.classList.add('wx-swap');
      }
    }
    if (hero) {
      hero.setMoonPhase(moonPhase(new Date(x.time)));
      hero.setText(String(Math.round(x.t)));
    }
    else setEmboss(tempNum, String(Math.round(x.t)));
    condEl.textContent = label;
    // shade the bar: daylight hours darker on a light screen, lighter on a dark one
    track.style.background = night ? '#2c2c2c' : '#f1f1ef';
    for (const s of track.querySelectorAll('.seg-h')) {
      const k = +s.dataset.k;
      const day = s.dataset.day === '1';
      s.style.background = night
        ? (day ? `hsl(0 0% ${45 + k * 30}%)` : 'transparent')
        : (day ? `hsl(60 3% ${88 - k * 14}%)` : 'transparent');
    }
  }

  function bindScrub() {
    const idxAt = (clientX) => {
      const r = track.getBoundingClientRect();
      return Math.min(hours.length - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * hours.length)));
    };
    const move = (clientX) => {
      const i = idxAt(clientX);
      const r = track.getBoundingClientRect();
      const sr = scrub.getBoundingClientRect();
      const x = Math.min(r.right, Math.max(r.left, clientX));
      cursor.style.left = `${x - r.left}px`;
      bubble.style.left = `${x - sr.left}px`;
      bubble.textContent = `${+hours[i].time.slice(11, 13)}:00`;
      if (i !== sel) { show(i); tick(2400, 0.01, 0.05); }
    };
    let active = false;
    track.addEventListener('pointerdown', (e) => {
      active = true;
      track.setPointerCapture(e.pointerId);
      scrub.classList.add('active');
      move(e.clientX);
    });
    track.addEventListener('pointermove', (e) => { if (active) move(e.clientX); });
    const end = () => {
      if (!active) return;
      active = false;
      scrub.classList.remove('active');
      setTimeout(() => { if (!active) show(null); }, 250);
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
  }

  function openDetails() {
    if (!data) return;
    const d = data, c = d.current;
    const dmin = Math.min(...d.daily.temperature_2m_min), dmax = Math.max(...d.daily.temperature_2m_max);
    const hm = (iso) => iso ? iso.slice(11, 16) : '—';
    const stat = (k, v, u) => h('div', { class: 'wx-stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, u && h('small', {}, ` ${u}`)));
    sheet((p) => {
      p.append(h('h3', {}, place.name), h('h4', {}, '7 DAYS'));
      d.daily.time.forEach((day, i) => {
        const lo = d.daily.temperature_2m_min[i], hi = d.daily.temperature_2m_max[i], span = (dmax - dmin) || 1;
        p.append(h('div', { class: 'wx-day' },
          h('div', {}, i === 0 ? '今日' : `${WD[new Date(day + 'T00:00').getDay()]}曜`),
          miniIcon(code(d.daily.weather_code[i])[1]),
          h('div', { class: 'lo' }, `${Math.round(lo)}°`),
          h('div', { class: 'range' }, h('i', { style: { left: `${((lo - dmin) / span) * 100}%`, right: `${100 - ((hi - dmin) / span) * 100}%` } })),
          h('div', { class: 'hi' }, `${Math.round(hi)}°`)));
      });
      p.append(h('h4', {}, 'DETAILS'), h('div', { class: 'wx-stats' },
        stat('体感', `${Math.round(c.apparent_temperature)}°`),
        stat('湿度', `${c.relative_humidity_2m}`, '%'),
        stat('風速', `${Math.round(c.wind_speed_10m)}`, 'm/s'),
        stat('降水確率', `${d.daily.precipitation_probability_max?.[0] ?? 0}`, '%'),
        stat('日の出', hm(d.daily.sunrise?.[0])),
        stat('日の入り', hm(d.daily.sunset?.[0])),
        stat('月', moonName(moonPhase(new Date())))));
    });
  }

  function setPlace(p) {
    place = p;
    store.set('weather.place', p);
    load();
  }

  function openPlaces() {
    sheet((p, close) => {
      const input = h('input', { type: 'text', placeholder: '都市名で検索' });
      const results = h('div');
      let timerId;
      input.addEventListener('input', () => {
        clearTimeout(timerId);
        const q = input.value.trim();
        if (!q) { results.replaceChildren(); return; }
        timerId = setTimeout(async () => {
          try {
            const list = await searchPlace(q);
            results.replaceChildren(...list.map((x) => h('button', { class: 'row', style: { width: '100%' }, onclick: () => { close(); setPlace(x); } },
              h('span', {}, x.name), h('span', { class: 'val' }, x.sub))));
            if (!list.length) results.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'val' }, '見つかりません')));
          } catch { results.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'val' }, '検索できませんでした'))); }
        }, 300);
      });
      p.append(h('h3', {}, '場所'), input, results,
        h('button', { class: 'btn', onclick: async () => {
          close();
          try { setPlace(await locate()); } catch { toast('位置情報を取得できませんでした'); }
        } }, '現在地を使う'));
    });
  }

  function openSettings() {
    sheet((p, close) => {
      const seg = h('div', { class: 'seg' }, ['C', 'F'].map((u) => h('button', {
        class: unit() === u ? 'on' : '', onclick: () => { store.set('weather.unit', u); close(); load(); },
      }, `°${u}`)));
      p.append(h('h3', {}, '天気'), h('div', { class: 'row' }, h('span', {}, '単位'), seg),
        h('button', { class: 'btn', onclick: () => { close(); openPlaces(); } }, '場所を変更'),
        h('button', { class: 'btn', onclick: () => { close(); load(); } }, '更新'));
    });
  }

  let alive = true;
  load();
  return { el, destroy: () => { alive = false; hero?.destroy(); } };
}
