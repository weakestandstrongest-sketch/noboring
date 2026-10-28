import { h, emboss, iconBtn, topbar, sheet, store, toast } from './ui.js';

// WMO weather codes → [label, kind]
const CODES = {
  0: ['快晴', 'clear'], 1: ['晴れ', 'clear'], 2: ['晴れ時々曇り', 'partly'], 3: ['曇り', 'cloudy'],
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

const DEFAULT_PLACE = { name: '東京', lat: 35.6812, lon: 139.7671 };

function art(kind, isDay, scale = 1) {
  const box = h('div', { class: 'wx-art' });
  const add = (cls, x, y, size, delay = 0) => {
    const b = h('div', { class: `blob ${cls} floaty`, style: {
      left: `${x}%`, top: `${y}%`, width: `${size * scale}px`, height: `${size * scale}px`, animationDelay: `${delay}s`,
    } });
    box.append(b);
    return b;
  };
  const light = kind === 'snow' || kind === 'fog';
  const celestial = isDay ? 'sun' : 'moon';
  if (kind === 'clear') add(celestial, 34, 10, 200);
  if (kind === 'partly') { add(celestial, 46, 6, 170); add('cloud', 14, 30, 150, 0.5); add('cloud', 44, 34, 120, 1); add('cloud', 70, 42, 64, 1.5); add('cloud', 6, 50, 36, 2); }
  if (['cloudy', 'rain', 'storm', 'snow', 'fog'].includes(kind)) {
    const c = light ? 'cloud light' : 'cloud';
    if (kind === 'cloudy') add(celestial, 56, 4, 110);
    add(c, 8, 18, 170, 0); add(c, 40, 12, 190, 0.7); add(c, 66, 28, 120, 1.4); add(c, 2, 40, 54, 2); add(c, 82, 46, 40, 2.6);
  }
  if (kind === 'rain' || kind === 'storm') {
    for (let i = 0; i < 18; i++) {
      box.append(h('div', { class: 'drop', style: {
        left: `${12 + Math.random() * 76}%`, top: `${48 + Math.random() * 8}%`, height: `${14 + Math.random() * 16}px`,
        animationDelay: `${Math.random()}s`, animationDuration: `${0.7 + Math.random() * 0.5}s`,
      } }));
    }
  }
  if (kind === 'snow') {
    for (let i = 0; i < 16; i++) {
      box.append(h('div', { class: 'flake', style: {
        left: `${10 + Math.random() * 80}%`, top: `${46 + Math.random() * 10}%`, animationDelay: `${Math.random() * 3}s`,
      } }));
    }
  }
  if (kind === 'storm') {
    box.append(h('div', { style: { position: 'absolute', left: '48%', top: '50%', width: '0', height: '0',
      borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: `70px solid var(--accent-hot)`,
      transform: 'skewX(-18deg)', filter: 'drop-shadow(0 0 18px rgba(255,214,10,.6))' } }));
  }
  return box;
}

function miniIcon(kind, isDay = true) {
  const sun = isDay ? '#ff3b1f' : '#e8e2c8';
  const cloud = '<circle cx="12" cy="18" r="7" fill="#1a1a1a" stroke="#555" stroke-width=".6"/><circle cx="20" cy="17" r="8" fill="#1a1a1a" stroke="#555" stroke-width=".6"/><circle cx="26" cy="21" r="4" fill="#1a1a1a" stroke="#555" stroke-width=".6"/>';
  const m = {
    clear: `<circle cx="16" cy="16" r="9" fill="${sun}"/>`,
    partly: `<circle cx="20" cy="11" r="7" fill="${sun}"/>${cloud}`,
    cloudy: cloud,
    fog: `${cloud}<path d="M6 27h20M9 30h14" stroke="#888" stroke-width="2" stroke-linecap="round"/>`,
    rain: `${cloud}<path d="M11 26l-1 4M17 26l-1 4M23 26l-1 4" stroke="#5aa9ff" stroke-width="2" stroke-linecap="round"/>`,
    snow: `${cloud}<circle cx="11" cy="28" r="1.6" fill="#fff"/><circle cx="17" cy="29" r="1.6" fill="#fff"/><circle cx="23" cy="28" r="1.6" fill="#fff"/>`,
    storm: `${cloud}<path d="M17 23l-4 6h4l-2 4" stroke="#ffd60a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 34');
  s.setAttribute('class', 'ic');
  s.innerHTML = m[kind] || m.cloudy;
  return s;
}

async function fetchForecast(place, unit) {
  const p = new URLSearchParams({
    latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: 7,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset',
    temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius',
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

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ name: '現在地', lat: p.coords.latitude, lon: p.coords.longitude, gps: true }),
      reject, { timeout: 8000, maximumAge: 10 * 60000 });
  });
}

export default function weather({ back }) {
  let place = store.get('weather.place', null);
  const unit = () => store.get('weather.unit', 'C');
  const placeBtn = h('button', { class: 'title wx-place', onclick: () => openPlaces() });
  const scroll = h('div', { class: 'weather-scroll' });
  let alive = true;

  function message(text, retry) {
    scroll.replaceChildren(h('div', { class: 'wx-msg' }, text, h('br'),
      retry && h('button', { class: 'btn', onclick: retry }, '再読み込み')));
  }

  async function load() {
    if (!place) {
      try { place = await locate(); } catch { place = DEFAULT_PLACE; }
      store.set('weather.place', place);
    }
    placeBtn.textContent = place.name;
    const cached = store.get('weather.cache', null);
    if (cached && cached.key === `${place.lat},${place.lon},${unit()}`) renderData(cached.data);
    else message('読み込み中…');
    try {
      const data = await fetchForecast(place, unit());
      if (!alive) return;
      store.set('weather.cache', { key: `${place.lat},${place.lon},${unit()}`, at: Date.now(), data });
      renderData(data);
    } catch (e) {
      if (!alive) return;
      if (!cached) message('天気を取得できませんでした。通信状況を確認してください。', load);
      else toast('オフライン: 前回のデータを表示中');
    }
  }

  function renderData(d) {
    const c = d.current;
    const [label, kind] = code(c.weather_code);
    const isDay = !!c.is_day;
    const t = Math.round(c.temperature_2m);
    const hero = h('div', { class: 'wx-hero' },
      art(kind, isDay),
      h('div', { class: 'wx-temp' }, emboss(`${t}°`)),
      h('div', { class: 'wx-cond' },
        h('div', { class: 'c' }, label),
        h('div', { class: 's' }, `体感 ${Math.round(c.apparent_temperature)}°`),
        h('div', { class: 's' }, `${Math.round(d.daily.temperature_2m_max[0])}° / ${Math.round(d.daily.temperature_2m_min[0])}°`)));

    // next 24 hours from the current hour
    const nowIdx = Math.max(0, d.hourly.time.findIndex((x) => x >= c.time.slice(0, 13)));
    const hours = d.hourly.time.slice(nowIdx, nowIdx + 24).map((time, i) => ({
      time, t: d.hourly.temperature_2m[nowIdx + i], pp: d.hourly.precipitation_probability?.[nowIdx + i] ?? 0,
    }));
    const tmin = Math.min(...hours.map((x) => x.t));
    const tmax = Math.max(...hours.map((x) => x.t));
    const hourEls = hours.map((x, i) => h('div', { class: 'wx-hour' },
      h('div', { class: 'v' }, `${Math.round(x.t)}°`),
      h('div', { class: 'barbox' }, h('div', { class: `bar ${x.pp >= 50 ? 'rain' : ''}`, style: { height: `${20 + 70 * ((x.t - tmin) / ((tmax - tmin) || 1))}px` } })),
      h('div', { class: 't' }, i === 0 ? '今' : `${+x.time.slice(11, 13)}時`),
      h('div', { class: 't', style: { color: x.pp >= 30 ? '#5aa9ff' : 'transparent' } }, `${x.pp}%`)));

    const dmin = Math.min(...d.daily.temperature_2m_min);
    const dmax = Math.max(...d.daily.temperature_2m_max);
    const days = d.daily.time.map((day, i) => {
      const lo = d.daily.temperature_2m_min[i], hi = d.daily.temperature_2m_max[i];
      const span = (dmax - dmin) || 1;
      return h('div', { class: 'wx-day' },
        h('div', { class: 'd' }, i === 0 ? '今日' : `${WD[new Date(day + 'T00:00').getDay()]}曜`),
        miniIcon(code(d.daily.weather_code[i])[1]),
        h('div', { class: 'lo' }, `${Math.round(lo)}°`),
        h('div', { class: 'range' }, h('i', { style: { left: `${((lo - dmin) / span) * 100}%`, right: `${100 - ((hi - dmin) / span) * 100}%` } })),
        h('div', { class: 'hi' }, `${Math.round(hi)}°`));
    });

    const hm = (iso) => iso ? iso.slice(11, 16) : '—';
    const stats = h('div', { class: 'wx-stats' },
      stat('湿度', `${c.relative_humidity_2m}`, '%'),
      stat('風速', `${Math.round(c.wind_speed_10m)}`, 'km/h'),
      stat('降水確率', `${d.daily.precipitation_probability_max?.[0] ?? 0}`, '%'),
      stat('UV指数', `${Math.round(d.daily.uv_index_max?.[0] ?? 0)}`, ''),
      stat('日の出', hm(d.daily.sunrise?.[0]), ''),
      stat('日の入り', hm(d.daily.sunset?.[0]), ''));

    scroll.replaceChildren(hero,
      h('div', { class: 'wx-section' }, h('h4', {}, '24 HOURS'), h('div', { class: 'wx-hours' }, hourEls)),
      h('div', { class: 'wx-section' }, h('h4', {}, '7 DAYS'), days),
      h('div', { class: 'wx-section' }, h('h4', {}, 'DETAILS'), stats));
  }

  function stat(k, v, unitLabel) {
    return h('div', { class: 'wx-stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unitLabel && h('small', {}, ` ${unitLabel}`)));
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

  const el = h('div', { class: 'screen weather' },
    topbar({ left: [iconBtn('back', back, '戻る')], title: placeBtn, right: [iconBtn('sliders', openSettings, '設定')] }),
    scroll);
  load();
  return { el, destroy: () => { alive = false; } };
}
