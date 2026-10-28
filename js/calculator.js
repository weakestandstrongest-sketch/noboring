import { h, emboss, setEmboss, iconBtn, topbar, sheet, store, tick, icons, pop } from './ui.js';

const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

// Recursive-descent evaluator. A trailing % after a term means "percent of the
// left operand" for + and − (12 + 25% = 15) and "÷100" everywhere else.
export function evaluate(src) {
  const toks = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|\d+\.|[-+*/%]/g) || [];
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  function factor() {
    let t = next();
    if (t === '-') return -factor();
    if (t === '+') return factor();
    if (t == null || isNaN(parseFloat(t))) throw new Error('syntax');
    return parseFloat(t);
  }
  function term() {
    let v = factor();
    let pct = false;
    if (peek() === '%') { next(); pct = true; }
    while (peek() === '*' || peek() === '/') {
      const op = next();
      let r = factor();
      if (peek() === '%') { next(); r /= 100; }
      v = op === '*' ? v * r : v / r;
      pct = false;
    }
    return { v, pct };
  }
  function expr() {
    let { v, pct } = term();
    if (pct) v /= 100;
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const r = term();
      const rv = r.pct ? v * r.v / 100 : r.v;
      v = op === '+' ? v + rv : v - rv;
    }
    return v;
  }
  const v = expr();
  if (i < toks.length) throw new Error('syntax');
  return v;
}

export function format(n) {
  if (!isFinite(n)) return 'Error';
  if (Object.is(n, -0)) n = 0;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-7)) return n.toExponential(5).replace(/\.?0+e/, 'e');
  const s = parseFloat(n.toPrecision(12)).toString();
  const [int, dec] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${grouped}.${dec}` : grouped;
}

export default function calculator() {
  let expr = store.get('calc.expr', '');
  let justEvaluated = false;
  const history = store.get('calc.history', []);

  const exprEl = h('div', { class: 'calc-expr' });
  const result = emboss('0');
  const resultBox = h('div', { class: 'calc-result' }, result);
  result.addEventListener('click', () => { pop(result.firstElementChild); tick(); });

  function preview() {
    if (!expr) return '0';
    try {
      const trimmed = expr.replace(/[-+*/]+$/, '');
      return trimmed ? format(evaluate(trimmed)) : '0';
    } catch { return '…'; }
  }

  function paint() {
    exprEl.replaceChildren(...[...expr].map((c) =>
      OPS[c] ? h('span', { class: 'op' }, OPS[c]) : c === '%' ? h('span', { class: 'op' }, '%') : c));
    exprEl.scrollLeft = exprEl.scrollWidth;
    const text = justEvaluated ? format(evaluate(expr || '0')) : preview();
    setEmboss(result, text);
    // shrink to fit: big numbers get smaller
    const len = text.length;
    const base = Math.min(window.innerWidth * 0.36, 168);
    result.firstElementChild.style.fontSize = `${Math.max(48, base * Math.min(1, 5.2 / Math.max(len, 1)))}px`;
    store.set('calc.expr', expr);
  }

  function input(k) {
    tick(k === '=' ? 900 : 1600);
    const last = expr.slice(-1);
    if (k === 'C') { expr = ''; justEvaluated = false; }
    else if (k === '⌫') { expr = justEvaluated ? '' : expr.slice(0, -1); justEvaluated = false; }
    else if (k === '=') {
      if (!expr) return;
      try {
        const v = evaluate(expr.replace(/[-+*/]+$/, ''));
        if (!isFinite(v)) throw 0;
        history.unshift({ e: expr, r: v });
        history.length = Math.min(history.length, 50);
        store.set('calc.history', history);
        expr = String(parseFloat(v.toPrecision(12)));
        justEvaluated = true;
        setTimeout(() => pop(result.firstElementChild));
      } catch { flashError(); return; }
    }
    else if ('+-*/'.includes(k)) {
      justEvaluated = false;
      if (!expr && k !== '-') expr = '0';
      expr = '+-*/'.includes(last) && last ? expr.slice(0, -1) + k : expr + k;
    }
    else if (k === '%') {
      if (/[\d.]$/.test(expr)) expr += '%';
      justEvaluated = false;
    }
    else if (k === '±') {
      const m = expr.match(/(^|[-+*/])(-?)([\d.]+%?)$/);
      if (m) {
        const start = expr.length - m[0].length + m[1].length;
        expr = expr.slice(0, start) + (m[2] ? '' : '-') + m[3];
      } else if (!expr) expr = '-';
      justEvaluated = false;
    }
    else { // digit or dot
      if (justEvaluated) { expr = ''; justEvaluated = false; }
      if (last === '%') expr += '*';
      const num = expr.match(/[\d.]*$/)[0];
      if (k === '.' && num.includes('.')) return;
      if (k === '.' && !num) expr += '0';
      if (num === '0' && k !== '.') expr = expr.slice(0, -1);
      if (num.replace('.', '').length >= 15) return;
      expr += k;
    }
    paint();
  }

  function flashError() {
    resultBox.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }], { duration: 260 });
  }

  const layout = [
    ['C', 'fn'], ['±', 'fn'], ['%', 'fn'], ['/', 'op'],
    ['7'], ['8'], ['9'], ['*', 'op'],
    ['4'], ['5'], ['6'], ['-', 'op'],
    ['1'], ['2'], ['3'], ['+', 'op'],
    ['0'], ['.'], ['⌫', 'fn'], ['=', 'eq'],
  ];
  const keyEls = {};
  const keys = h('div', { class: 'calc-keys' }, layout.map(([k, cls = '']) => {
    const label = k === '⌫' ? null : OPS[k] || k;
    const b = h('button', { class: `key ${cls}`, 'data-k': k, html: k === '⌫' ? icons.backspace : null }, label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); lite(b); input(k); });
    keyEls[k] = b;
    return b;
  }));

  function lite(b) {
    b.classList.remove('lit');
    void b.offsetWidth;
    b.classList.add('lit');
  }

  function onKey(e) {
    const map = { Enter: '=', Backspace: '⌫', Escape: 'C', '×': '*', '÷': '/' };
    const k = map[e.key] || e.key;
    if (keyEls[k]) {
      e.preventDefault();
      keyEls[k].classList.add('down');
      lite(keyEls[k]);
      setTimeout(() => keyEls[k].classList.remove('down'), 90);
      input(k);
    }
  }
  window.addEventListener('keydown', onKey);

  function openHistory() {
    sheet((p, close) => {
      p.append(h('h3', {}, '履歴'));
      if (!history.length) p.append(h('div', { class: 'row' }, h('span', { class: 'val' }, 'まだ計算がありません')));
      history.forEach((it) => p.append(h('button', {
        class: 'row', style: { width: '100%' },
        onclick: () => { expr = String(it.r); justEvaluated = true; paint(); close(); },
      }, h('span', { class: 'val' }, it.e.replace(/[-+*/]/g, (c) => ` ${OPS[c]} `)), h('span', {}, format(it.r)))));
      p.append(
        h('button', { class: 'btn danger', onclick: () => { history.length = 0; store.set('calc.history', []); close(); } }, '履歴を消去'),
        h('button', { class: 'btn', onclick: () => { store.set('settings.sound', !store.get('settings.sound', true)); close(); } },
          `操作音: ${store.get('settings.sound', true) ? 'オン' : 'オフ'}`));
    });
  }

  const el = h('div', { class: 'screen calculator' },
    topbar({ right: [iconBtn('sliders', openHistory, '履歴と設定')] }),
    h('div', { class: 'calc-display' }, exprEl, resultBox),
    keys);

  // swipe left/right on the display deletes the last character
  let sx = null;
  el.querySelector('.calc-display').addEventListener('pointerdown', (e) => { sx = e.clientX; });
  el.querySelector('.calc-display').addEventListener('pointerup', (e) => {
    if (sx != null && Math.abs(e.clientX - sx) > 50) input('⌫');
    sx = null;
  });

  requestAnimationFrame(paint);
  return { el, destroy: () => window.removeEventListener('keydown', onKey) };
}
