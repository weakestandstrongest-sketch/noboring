// Weather detail pages, opened by tapping the numerals: each page has a title,
// a table for the selected hour (or day), a chart and a scrubber, with a 日/週 switch.
import { h, tick } from './ui.js';

export const PAGES = [
  { id: 'temp', title: '温度' },
  { id: 'precip', title: '降水量' },
  { id: 'sun', title: '太陽' },
  { id: 'air', title: '大気' },
  { id: 'cloud', title: '雲' },
  { id: 'moon', title: '月' },
];

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const DIRS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhaseAt(date) {
  const days = (date.getTime() - NEW_MOON_REF) / 864e5;
  return (((days / SYNODIC) % 1) + 1) % 1;
}
const moonLight = (p) => Math.round(((1 - Math.cos(p * Math.PI * 2)) / 2) * 100);
function moonName(p) {
  return ['新月', '三日月', '上弦の月', '十三夜', '満月', '寝待月', '下弦の月', '有明月'][Math.round(p * 8) % 8];
}
// next time the phase reaches `target` (0 = new, 0.5 = full) after `date`
function nextPhase(date, target) {
  const p = moonPhaseAt(date);
  const wait = (((target - p) % 1) + 1) % 1 || 1;
  return new Date(date.getTime() + wait * SYNODIC * 864e5);
}
const ymd = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
const hm = (iso) => (iso ? iso.slice(11, 16).replace(/^0/, '') : '--');
const r0 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v));
const dash = (v, unit = '') => (v == null || Number.isNaN(v) ? '--' : `${v}${unit}`);

function kindOf(code) {
  if (code == null) return '--';
  if (code >= 95) return '雷雨';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '雪';
  if (code >= 51) return '雨';
  return 'なし';
}

// Read the forecast into tidy per-hour / per-day records.
export function model(d) {
  const c = d.current;
  const start = Math.max(0, d.hourly.time.findIndex((x) => x >= c.time.slice(0, 13)));
  const H = (k, i) => d.hourly[k]?.[start + i];
  const hours = Array.from({ length: Math.min(24, d.hourly.time.length - start) }, (_, i) => ({
    time: d.hourly.time[start + i],
    t: H('temperature_2m', i), feels: H('apparent_temperature', i), rh: H('relative_humidity_2m', i), dew: H('dew_point_2m', i),
    rain: H('precipitation', i), pp: H('precipitation_probability', i), code: H('weather_code', i),
    wind: H('wind_speed_10m', i), gust: H('wind_gusts_10m', i), dir: H('wind_direction_10m', i),
    vis: H('visibility', i), hpa: H('pressure_msl', i), uv: H('uv_index', i), cloud: H('cloud_cover', i),
  }));
  if (hours[0]) {
    Object.assign(hours[0], {
      t: c.temperature_2m ?? hours[0].t, feels: c.apparent_temperature ?? hours[0].feels, rh: c.relative_humidity_2m ?? hours[0].rh,
      wind: c.wind_speed_10m ?? hours[0].wind, gust: c.wind_gusts_10m ?? hours[0].gust, dir: c.wind_direction_10m ?? hours[0].dir,
      hpa: c.pressure_msl ?? hours[0].hpa, cloud: c.cloud_cover ?? hours[0].cloud, code: c.weather_code ?? hours[0].code,
    });
  }
  const D = (k, i) => d.daily[k]?.[i];
  const days = d.daily.time.map((day, i) => ({
    day, hi: D('temperature_2m_max', i), lo: D('temperature_2m_min', i), feelsHi: D('apparent_temperature_max', i),
    rain: D('precipitation_sum', i), pp: D('precipitation_probability_max', i), code: D('weather_code', i),
    uv: D('uv_index_max', i), rise: D('sunrise', i), set: D('sunset', i),
    wind: D('wind_speed_10m_max', i), gust: D('wind_gusts_10m_max', i), dir: D('wind_direction_10m_dominant', i),
    cloud: D('cloud_cover_mean', i),
  }));
  const dayOf = (iso) => Math.max(0, days.findIndex((x) => x.day === iso.slice(0, 10)));
  return { hours, days, dayOf };
}

const dirName = (deg) => (deg == null ? '--' : DIRS[Math.round(deg / 45) % 8]);
const dateOf = (m, range, i) => (range === 'day' ? new Date(m.hours[i].time) : new Date(`${m.days[i].day}T21:00`));

// The table rows: the first is the headline, shown in a black pill.
function rows(page, m, range, i) {
  const hr = m.hours[i], dy = range === 'day' ? m.days[m.dayOf(hr.time)] : m.days[i];
  const one = range === 'day' ? hr : dy;
  switch (page) {
    case 'temp': return range === 'day'
      ? [['温度', dash(r0(hr.t), '°C')], ['高', dash(r0(dy?.hi), '°C')], ['低', dash(r0(dy?.lo), '°C')], ['体感', dash(r0(hr.feels), '°C')], ['湿度', dash(r0(hr.rh), '%')], ['露点', dash(r0(hr.dew), '°C')]]
      : [['温度', dash(r0(i === 0 ? m.hours[0].t : dy.hi), '°C')], ['高', dash(r0(dy.hi), '°C')], ['低', dash(r0(dy.lo), '°C')], ['体感', dash(r0(dy.feelsHi), '°C')], ['湿度', '--'], ['露点', '--']];
    case 'precip': return [
      ['降水量', range === 'day' ? `${(one.rain ?? 0).toFixed(1)} MM/時` : `${(one.rain ?? 0).toFixed(1)} MM/日`],
      ['確率', dash(r0(one.pp), '%')], ['種類', (one.rain ?? 0) > 0 || (one.pp ?? 0) >= 30 ? kindOf(one.code) : 'なし']];
    case 'sun': return [['UV指数', dash(r0(one.uv))], ['日の出', hm(dy?.rise)], ['日の入り', hm(dy?.set)]];
    case 'air': return [
      ['風速', one.wind == null ? '--' : `秒速${Math.round(one.wind)}M`], ['突風', one.gust == null ? '--' : `秒速${Math.round(one.gust)}M`],
      ['風向', dirName(one.dir)], ['視界', range === 'day' && hr.vis != null ? `${(hr.vis / 1000).toFixed(1)}KM` : '--'],
      ['気圧', range === 'day' && hr.hpa != null ? `${Math.round(hr.hpa)}HPA` : '--']];
    case 'cloud': return [['雲量', dash(r0(one.cloud), '%')]];
    case 'moon': {
      const date = dateOf(m, range, i);
      const p = moonPhaseAt(date);
      return [['明るさ', `${moonLight(p)}%`], ['月齢', `${(p * SYNODIC).toFixed(1)}日`], ['名前', moonName(p)],
        ['満月', ymd(nextPhase(date, 0.5))], ['新月', ymd(nextPhase(date, 0))]];
    }
    default: return [];
  }
}

// Chart series: [{ values, kind: 'line'|'area', tone }]
function series(page, m, range) {
  const L = range === 'day' ? m.hours : m.days;
  const pick = (k) => L.map((x) => x[k] ?? null);
  switch (page) {
    case 'temp': return range === 'day'
      ? [{ values: pick('feels'), kind: 'line', tone: 'soft' }, { values: pick('t'), kind: 'line', tone: 'ink' }]
      : [{ values: pick('lo'), kind: 'line', tone: 'soft' }, { values: pick('hi'), kind: 'line', tone: 'ink' }];
    case 'precip': return [{ values: pick('rain').map((v) => v ?? 0), kind: 'area', tone: 'blue', floor: 0, min: 2 }];
    case 'sun': return [{ values: pick('uv'), kind: 'line', tone: 'ink', floor: 0, min: 5 }];
    case 'air': return [{ values: pick('gust'), kind: 'line', tone: 'soft', floor: 0 }, { values: pick('wind'), kind: 'line', tone: 'ink', floor: 0 }];
    case 'cloud': return [{ values: pick('cloud'), kind: 'area', tone: 'grey', floor: 0, ceil: 100 }];
    case 'moon': return [{ values: L.map((_, i) => moonLight(moonPhaseAt(dateOf(m, range, i)))), kind: 'area', tone: 'ink', floor: 0, ceil: 100 }];
    default: return [];
  }
}

// smooth path through points (Catmull-Rom → cubic Bézier)
function smooth(pts, yMax = Infinity) {
  if (pts.length < 2) return '';
  const cy = (y) => Math.min(yMax, Math.max(0, y)); // keep curves from overshooting the axis
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cy(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cy(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const W = 300, CH = 92;
function chartSVG(list, sel) {
  const all = list.flatMap((s) => s.values.filter((v) => v != null));
  let lo = Math.min(...all, ...list.map((s) => s.floor ?? Infinity));
  let hi = Math.max(...all, ...list.map((s) => s.min ?? -Infinity));
  if (list.some((s) => s.ceil != null)) hi = Math.max(...list.map((s) => s.ceil ?? -Infinity));
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
  if (hi - lo < 1) hi = lo + 1;
  const pad = (hi - lo) * 0.12;
  if (!list.some((s) => s.floor != null)) lo -= pad;
  hi += pad;
  const n = list[0].values.length;
  const X = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const Y = (v) => CH - ((v - lo) / (hi - lo)) * CH;
  let out = '';
  for (const s of list) {
    const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    const path = smooth(pts, CH);
    if (s.kind === 'area') out += `<path class="area ${s.tone}" d="${path} L${pts.at(-1)[0]},${CH} L${pts[0][0]},${CH} Z"/>`;
    else out += `<path class="line ${s.tone}" d="${path}"/>`;
  }
  const main = list.at(-1).values[sel];
  if (main != null) out += `<circle class="dot" cx="${X(sel)}" cy="${Y(main)}" r="4"/>`;
  // three y-axis labels on the right
  const ticks = [hi - pad, (hi + lo) / 2, lo + (list.some((s) => s.floor != null) ? 0 : pad)];
  const labels = ticks.map((t) => `<text x="${W + 10}" y="${Y(t) + 4}">${Math.round(t)}</text>`).join('');
  return `<svg viewBox="0 -6 ${W + 34} ${CH + 12}" preserveAspectRatio="xMidYMid meet">${out}${labels}</svg>`;
}

function xLabels(m, range, sel) {
  if (range === 'week') {
    return m.days.map((d, i) => h('span', { class: i === sel ? 'on' : '', style: { left: `${(i / (m.days.length - 1)) * 100}%` } },
      i === 0 ? '今日' : WD[new Date(`${d.day}T00:00`).getDay()]));
  }
  const n = m.hours.length;
  return m.hours.map((x, i) => {
    const hr = +x.time.slice(11, 13);
    if (i !== 0 && (hr % 6 || i < 2)) return null;
    return h('span', { class: i === sel ? 'on' : '', style: { left: `${(i / (n - 1)) * 100}%` } }, i === 0 ? '今' : String(hr));
  });
}

// Build the panel. onChange({ page, range, index }) fires whenever the user moves something.
export function createPanel({ getModel, state, onChange }) {
  const el = h('div', { class: 'wxd' });

  function render(dir = 0) {
    const m = getModel();
    if (!m) return;
    const n = state.range === 'day' ? m.hours.length : m.days.length;
    state.index = Math.min(state.index, n - 1);
    const page = PAGES[state.page];
    const r = rows(page.id, m, state.range, state.index);
    const body = h('div', { class: `wxd-body ${dir ? (dir > 0 ? 'in-right' : 'in-left') : ''}` },
      h('h2', {}, page.title),
      h('div', { class: 'wxd-rows' }, r.map(([k, v], i) => h('div', { class: `wxd-row ${i === 0 ? 'head' : ''}` }, h('span', {}, k), h('i'), h('b', {}, v)))),
      h('div', { class: 'wxd-x' }, xLabels(m, state.range, state.index)),
      h('div', { class: 'wxd-chart', html: chartSVG(series(page.id, m, state.range), state.index) }));
    const old = el.querySelector('.wxd-body');
    if (old) old.replaceWith(body); else el.prepend(body);
    paintScrub(n);
    sw.classList.toggle('on', state.range === 'week');
  }

  // scrubber: a dotted track with a knob; every step gives a haptic tick
  const knob = h('span', { class: 'wxd-knob' });
  const fill = h('span', { class: 'fill' });
  const dots = h('span', { class: 'dots' });
  const scrub = h('div', { class: 'wxd-scrub' }, dots, fill, knob);
  function paintScrub(n) {
    const pct = n > 1 ? (state.index / (n - 1)) * 100 : 0;
    knob.style.left = `${pct}%`;
    fill.style.width = `${pct}%`;
    if (+dots.dataset.n !== n) {
      dots.dataset.n = n;
      dots.replaceChildren(...Array.from({ length: n }, (_, i) => h('i', { style: { left: `${(i / (n - 1)) * 100}%` } })));
    }
  }
  let dragging = false;
  const pick = (clientX) => {
    const m = getModel();
    const n = state.range === 'day' ? m.hours.length : m.days.length;
    const rc = scrub.getBoundingClientRect();
    const i = Math.round(Math.min(1, Math.max(0, (clientX - rc.left) / rc.width)) * (n - 1));
    if (i !== state.index) {
      state.index = i;
      tick(2400, 0.01, 0.04);
      render();
      onChange(state);
    }
  };
  scrub.addEventListener('pointerdown', (e) => { dragging = true; scrub.setPointerCapture(e.pointerId); pick(e.clientX); e.stopPropagation(); });
  scrub.addEventListener('pointermove', (e) => { if (dragging) pick(e.clientX); });
  scrub.addEventListener('pointerup', () => { dragging = false; });
  scrub.addEventListener('pointercancel', () => { dragging = false; });

  // 日 / 週 switch
  const sw = h('button', { class: 'wxd-switch', 'aria-label': '日／週', onclick: () => {
    state.range = state.range === 'day' ? 'week' : 'day';
    state.index = 0;
    tick(1400);
    render();
    onChange(state);
  } }, h('i'));
  el.append(scrub, h('div', { class: 'wxd-range' }, h('span', {}, '日'), sw, h('span', {}, '週')));

  // swipe sideways to flip pages
  let sx = null, sy = null;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  el.addEventListener('pointerup', (e) => {
    if (sx == null || dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    flip(dx < 0 ? 1 : -1);
  });
  function flip(dir) {
    state.page = (state.page + dir + PAGES.length) % PAGES.length;
    tick(1600);
    render(dir);
    onChange(state, dir);
  }

  return { el, render, flip };
}

// What the 3D scene needs to show for a page at the selected time.
export function sceneInfo(page, m, range, i) {
  const one = range === 'day' ? m.hours[i] : m.days[i];
  const date = dateOf(m, range, i);
  return {
    temp: Math.round(range === 'day' ? one.t : (i === 0 ? m.hours[0].t : one.hi)),
    rain: one.rain ?? 0, snow: kindOf(one.code) === '雪',
    wind: one.wind ?? 0, dir: one.dir ?? 0, cloud: one.cloud ?? 50,
    phase: moonPhaseAt(date),
  };
}
