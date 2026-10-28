import { h, iconBtn, topbar, sheet, prompt, store, tick, todayKey, toast } from './ui.js';
import { CHAPTERS, STAGES, CHAPTER_ICONS, sceneSVG } from './journey.js';

const TOTAL = STAGES.length;

export default function habits({ back }) {
  let list = store.get('habits.list', []);
  let selId = store.get('habits.sel', list[0]?.id);
  let view = null; // stage being viewed (1..TOTAL); null = current

  const save = () => { store.set('habits.list', list); store.set('habits.sel', selId); };
  const cur = () => list.find((x) => x.id === selId) || list[0];
  const count = (hb) => hb.days.length;
  const doneToday = (hb) => hb.days.includes(todayKey());
  const currentStage = (hb) => Math.min(TOTAL, Math.max(1, count(hb)));

  const body = h('div', { class: 'habit-body' });
  const nameBtn = h('button', { class: 'habit-name-btn', onclick: () => openList() });
  const hint = h('div', { class: 'habit-hint' });

  function paint() {
    const hb = cur();
    if (!hb) {
      nameBtn.textContent = '';
      hint.textContent = '';
      body.replaceChildren(h('div', { class: 'habit-empty' },
        h('div', {}, '続けたい習慣を追加しましょう。', h('br'), '1日1回の記録で、60段階の旅が進みます。',
          h('br'), h('br'), h('button', { class: 'btn', style: { padding: '12px 22px', background: '#333', borderRadius: '22px' }, onclick: add }, '＋ 習慣を追加'))));
      return;
    }
    const reached = currentStage(hb);
    const stage = view ?? reached;
    const locked = stage > reached;
    const today = doneToday(hb);
    const lit = !locked && stage === reached && today;
    const [title, desc] = locked ? ['？？？', 'まだこの先には進めません。毎日続けると道が開けます。'] : STAGES[stage - 1];

    nameBtn.textContent = hb.name;
    nameBtn.classList.toggle('done', today);

    const copy = h('div', { class: 'habit-copy' }, h('h2', {}, title), h('p', {}, desc));
    const scene = h('div', { class: 'habit-scene', html: sceneSVG(stage, lit, locked) });
    const chapIdx = Math.floor((stage - 1) / 10);
    const chapters = h('div', { class: 'habit-chapters' },
      CHAPTERS.map((c, i) => {
        const first = i * 10 + 1;
        const b = h('button', {
          class: `chap ${first <= reached ? 'reached' : ''} ${Math.floor((reached - 1) / 10) === i ? 'cur' : ''} ${chapIdx === i ? 'sel' : ''}`,
          'aria-label': c.name, html: CHAPTER_ICONS[c.key],
          onclick: () => { tick(); view = Math.min(i * 10 + 10, Math.max(first, reached)); if (view === reached) view = null; paint(); },
        });
        return b;
      }),
      h('button', { class: 'chap', 'aria-label': 'その他', onclick: () => openList(),
        html: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>' }));

    const progress = h('div', { class: 'habit-progress' },
      `${stage} / ${TOTAL}`,
      h('div', { class: 'track' }, h('i', { style: { width: `${(count(hb) / TOTAL) * 100}%` } })));

    scene.addEventListener('click', () => {
      if (stage !== reached) { view = null; paint(); return; }
      toggleToday();
    });

    body.replaceChildren(copy, scene, progress, chapters);
    hint.textContent = stage !== reached ? 'タップで現在地に戻る' : today ? '今日は記録済み · タップで取り消し' : 'タップして今日を記録';
  }

  function toggleToday() {
    const hb = cur();
    const k = todayKey();
    const before = currentStage(hb);
    if (doneToday(hb)) {
      hb.days = hb.days.filter((d) => d !== k);
      tick(900);
    } else {
      hb.days.push(k);
      hb.days.sort();
      tick(600, 0.06, 0.1);
      if (currentStage(hb) > before) setTimeout(() => toast(`ステージ ${currentStage(hb)} に到達`), 200);
      if (count(hb) === TOTAL) setTimeout(() => toast('🏔 60日達成！'), 300);
    }
    view = null;
    save();
    paint();
    const sc = body.querySelector('.habit-scene svg');
    sc?.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-14px) scale(1.03)' }, { transform: 'translateY(0) scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  async function add() {
    const name = await prompt('新しい習慣', '', '例: 朝起きる');
    if (!name) return;
    const hb = { id: Date.now().toString(36), name, days: [], created: todayKey() };
    list.push(hb);
    selId = hb.id;
    view = null;
    save();
    paint();
  }

  function streak(hb) {
    let n = 0;
    const d = new Date();
    if (!doneToday(hb)) d.setDate(d.getDate() - 1);
    while (hb.days.includes(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function dots(hb) {
    const cells = [];
    const d = new Date();
    d.setDate(d.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const k = todayKey(d);
      cells.push(h('i', { class: `${hb.days.includes(k) ? 'on' : ''} ${i === 29 ? 'today' : ''}` }));
      d.setDate(d.getDate() + 1);
    }
    return h('div', { class: 'dots' }, cells);
  }

  function openList() {
    sheet((p, close) => {
      p.append(h('h3', {}, '習慣'));
      const wrap = h('div', { class: 'habit-list' });
      list.forEach((hb) => wrap.append(h('div', { class: 'row' },
        h('button', { onclick: () => { selId = hb.id; view = null; save(); close(); paint(); } },
          h('div', { style: { textDecoration: doneToday(hb) ? 'line-through' : 'none', fontWeight: hb.id === cur()?.id ? 700 : 400 } }, hb.name),
          h('div', { class: 'val', style: { fontSize: '13px', marginTop: '4px' } }, `${count(hb)} / ${TOTAL} · 連続 ${streak(hb)}日`)))));
      p.append(wrap, h('button', { class: 'btn primary', onclick: () => { close(); add(); } }, '＋ 習慣を追加'));
    });
  }

  function openSettings() {
    const hb = cur();
    sheet((p, close) => {
      if (!hb) {
        p.append(h('h3', {}, '習慣'), h('button', { class: 'btn primary', onclick: () => { close(); add(); } }, '＋ 習慣を追加'));
        return;
      }
      p.append(h('h3', {}, hb.name),
        h('div', { class: 'row' }, h('span', {}, '合計'), h('span', { class: 'val' }, `${count(hb)}日`)),
        h('div', { class: 'row' }, h('span', {}, '連続'), h('span', { class: 'val' }, `${streak(hb)}日`)),
        h('div', { class: 'row', style: { display: 'block' } }, h('div', { style: { marginBottom: '10px' } }, '過去30日'), dots(hb)),
        h('button', { class: 'btn', onclick: async () => {
          close();
          const name = await prompt('名前を変更', hb.name);
          if (name) { hb.name = name; save(); paint(); }
        } }, '名前を変更'),
        h('button', { class: 'btn', onclick: () => { close(); openList(); } }, '習慣を切り替え'),
        h('button', { class: 'btn danger', onclick: () => {
          if (!confirm(`「${hb.name}」を削除しますか？`)) return;
          list = list.filter((x) => x.id !== hb.id);
          selId = list[0]?.id;
          save(); close(); paint();
        } }, '削除'));
    });
  }

  // horizontal swipe browses stages already reached
  let sx = null, sy = null;
  body.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  body.addEventListener('pointerup', (e) => {
    const hb = cur();
    if (sx == null || !hb) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const reached = currentStage(hb);
    const s = view ?? reached;
    const next = Math.min(Math.min(TOTAL, reached + 1), Math.max(1, s + (dx < 0 ? 1 : -1)));
    view = next === reached ? null : next;
    tick(2000, 0.012);
    paint();
    body.dataset.swiped = '1';
  });
  // a swipe should not also count as a tap on the scene
  body.addEventListener('click', (e) => {
    if (body.dataset.swiped) { e.stopPropagation(); delete body.dataset.swiped; }
  }, true);

  const el = h('div', { class: 'screen habits' },
    h('div', { class: 'topbar habit-head' },
      h('div', { class: 'group' }, iconBtn('back', back, '戻る'), iconBtn('plus', add, '習慣を追加')),
      nameBtn,
      h('div', { class: 'group' }, iconBtn('sliders', openSettings, '設定'))),
    body, hint);

  // refresh at midnight so "today" rolls over
  let day = todayKey();
  const iv = setInterval(() => { if (todayKey() !== day) { day = todayKey(); paint(); } }, 30000);

  paint();
  return { el, destroy: () => clearInterval(iv) };
}
