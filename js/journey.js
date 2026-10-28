// 60-stage journey for the habit tracker: six chapters of ten stages each.
export const CHAPTERS = [
  { key: 'gate', name: '門' },
  { key: 'forest', name: '森' },
  { key: 'camp', name: '野営地' },
  { key: 'tower', name: '見張り塔' },
  { key: 'lake', name: '湖' },
  { key: 'peak', name: '頂' },
];

export const STAGES = [
  // 門
  ['はじまりの地', '何もない平らな土地。ここから何かが始まるとは、まだ誰も知りません。'],
  ['最初の石', '足もとに石をひとつ置きました。小さな印ですが、確かにあなたのものです。'],
  ['ふたつ目の石', '昨日の石の隣に、もうひとつ。並んだ石は道のように見えはじめます。'],
  ['柱', '石を積み上げると、一本の柱になりました。風が吹いても倒れません。'],
  ['もう一本の柱', '向かい合う二本の柱。あいだを通る風の音が少し変わりました。'],
  ['梁', '柱の上に梁を渡しました。それはもう、ただの石ではなく門です。'],
  ['門の影', '夕方、門は長い影を落とします。影の先には、まだ見ぬ道が続いています。'],
  ['通り抜ける', '門をくぐるのは思ったより簡単でした。むずかしかったのは、ここに来るまでです。'],
  ['振り返る', '後ろを見ると、来た道がはっきり見えます。あなたが作った道です。'],
  ['門の向こう', '一番難しい段階は越えました。門の向こうで、森が待っています。'],
  // 森
  ['若木', '一本の若木が芽を出しました。まだ細いけれど、まっすぐ上を向いています。'],
  ['二本の木', '若木に仲間ができました。森は一本ずつしか育ちません。'],
  ['木立', '数本の木が集まって、小さな木立になりました。鳥がとまりに来ます。'],
  ['木漏れ日', '葉のすき間から光がこぼれます。歩くリズムが体に馴染んできました。'],
  ['けもの道', '木々のあいだに細い道ができました。毎日通ったからこそできた道です。'],
  ['苔', '日陰の石に苔が生えはじめました。続けることは、静かに積もっていきます。'],
  ['深い森', '振り返ると、もう入口は見えません。それでも迷ってはいません。'],
  ['大樹', '森の真ん中に大きな木が立っています。あなたもいつか、こうなれるでしょうか。'],
  ['森の声', '風が葉を揺らす音が、あなたを励ましているように聞こえます。'],
  ['森の出口', '木々が途切れ、ひらけた土地が見えてきました。少し休む場所が必要です。'],
  // 野営地
  ['平らな地面', '休むのにちょうどいい、平らな場所を見つけました。'],
  ['テント', '小さなテントを張りました。続けるためには、休むことも大切です。'],
  ['焚き火', '火を起こしました。暖かさは、今日もここにいる理由になります。'],
  ['夜', '夜は長いけれど、火は消えていません。明日もまた火をつけられます。'],
  ['朝', '目が覚めると、テントの外が明るくなっていました。いつもの朝です。'],
  ['ふたつ目のテント', 'もうひとつテントが増えました。ここはもう、ただの通過点ではありません。'],
  ['道具', '使い慣れた道具がそろってきました。手が勝手に動くようになっています。'],
  ['地図', '地図を広げると、ここまでの道のりに線が引かれていました。'],
  ['荷造り', 'そろそろ出発の時。荷物は前よりも軽く感じます。'],
  ['遠くの塔', '丘の上に塔が見えます。あそこからなら、もっと遠くが見えるはずです。'],
  // 見張り塔
  ['土台', '塔の土台を据えました。高く上るには、まず低いところを固めます。'],
  ['一階', '一階ぶんの高さ。地面が少しだけ遠くなりました。'],
  ['二階', 'さらに一段。昨日より少しだけ遠くまで見渡せます。'],
  ['はしご', 'はしごを掛けました。一段ずつしか上れませんが、それで十分です。'],
  ['三階', '風が強くなってきました。それでも塔はびくともしません。'],
  ['屋根', '塔に屋根をつけました。雨の日も、ここでなら続けられます。'],
  ['見張り', '塔の上から、来た道がすべて見えます。思っていたより遠くまで来ました。'],
  ['灯り', '塔に灯りをともしました。遠くの誰かにも見えているかもしれません。'],
  ['嵐', '嵐が来ましたが、塔は立っています。積み重ねたものは簡単には崩れません。'],
  ['水平線', '塔の上から、きらきら光る湖が見えます。次はあそこです。'],
  // 湖
  ['水辺', '湖のほとりに着きました。水面はまだ波立っています。'],
  ['桟橋', '小さな桟橋を作りました。足もとに水の音が響きます。'],
  ['舟', '舟を浮かべました。漕ぎ出すには、少し勇気がいります。'],
  ['漕ぎ出す', '一度漕ぎ出してしまえば、あとは同じ動きを繰り返すだけです。'],
  ['凪', '波がおさまり、湖は鏡のように静かになりました。'],
  ['映る空', '水面に空が映っています。上も下も、同じくらい広く見えます。'],
  ['小島', '湖の真ん中に小島がありました。ここでひと息つきましょう。'],
  ['対岸', '対岸が近づいてきました。出発した岸はもう小さく見えます。'],
  ['上陸', '向こう岸に着きました。足もとが固い地面に戻ります。'],
  ['山の麓', '目の前に大きな山がそびえています。最後の旅が始まります。'],
  // 頂
  ['基盤', '「あなたはすでに一番難しい段階を乗り越えました」と声がします。あなたはうなずきます。'],
  ['登り口', '山道の入口。急な坂ですが、歩き方はもう知っています。'],
  ['岩場', '岩をひとつずつ越えていきます。急がなくても、止まらなければ進みます。'],
  ['森林限界', '木がなくなり、空が近くなりました。息は苦しくても、景色はすばらしい。'],
  ['雪渓', '夏でも溶けない雪の上を歩きます。足あとが一列に続いています。'],
  ['尾根', '尾根に出ました。両側に世界が広がっています。'],
  ['雲の上', '雲が足もとに見えます。ここまで来た人は多くありません。'],
  ['最後の坂', '頂上はすぐそこです。今日もいつもと同じ一歩を踏み出します。'],
  ['頂の光', '山頂が光りはじめました。あなたが積み重ねた日々の色です。'],
  ['頂上', '60日。あなたは頂に立っています。ここから見えるすべては、あなたが歩いた道です。'],
];

// Chapter icons for the bottom bar (24×24, filled).
export const CHAPTER_ICONS = {
  gate: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 4h20v2.4H2zM4 8.4h16v2H4z"/><rect x="5" y="6" width="2.6" height="15"/><rect x="16.4" y="6" width="2.6" height="15"/><rect x="10.8" y="8.4" width="2.4" height="4"/></svg>',
  forest: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3l4 10H8.5l3 7H2.5l3-7H3zM16 2l4.5 11H18l3.5 8h-11l3.5-8H11.5z"/></svg>',
  camp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5h11l3 15H5z"/><path d="M8 5L2 20h6z" opacity=".6"/></svg>',
  tower: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6l9-4 9 4v1.5H3z"/><rect x="5" y="8.5" width="14" height="2"/><path d="M6.5 10.5h2.2L12 16l3.3-5.5h2.2L13.3 17.5 17.5 22h-2.6L12 19l-2.9 3H6.5l4.2-4.5z"/></svg>',
  lake: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 8c2 2 4 2 5 0 1 2 3.5 2 5 0 1.5 2 4 2 5 0 1 2 3 2 5 0v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/></svg>',
  peak: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l11 20H1z"/><path d="M12 2l3.7 6.7-2.2-1.2L12 9l-1.5-1.5-2.2 1.2z" fill="#1f1f1f" opacity=".5"/></svg>',
};

// ---------- isometric scene ----------
const S = 15; // px per unit
const CX = 210, CY = 110;
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const P = (x, y, z = 0) => [CX + (x - y) * C30 * S, CY + (x + y) * S30 * S - z * S];
const pts = (...p) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const poly = (fill, ...p) => `<polygon points="${pts(...p)}" fill="${fill}"/>`;

const DARK = { top: '#303030', left: '#1d1d1d', right: '#262626' };
const LIT = { top: '#ffd60a', left: '#d87406', right: '#f0a20b' };
const WATER_LIT = { top: '#5aa9ff', left: '#1d5fb8', right: '#2f7fe0' };
const WATER_DARK = { top: '#1b2128', left: '#121212', right: '#161a1f' };

function box(x, y, w, d, hgt, c, z = 0) {
  const t = z + hgt;
  return poly(c.left, P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, t), P(x, y + d, t))
    + poly(c.right, P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, t), P(x + w, y, t))
    + poly(c.top, P(x, y, t), P(x + w, y, t), P(x + w, y + d, t), P(x, y + d, t));
}
function pyramid(cx, cy, b, hgt, c, z = 0) {
  const apex = P(cx, cy, z + hgt);
  return poly(c.left, P(cx - b, cy + b, z), P(cx + b, cy + b, z), apex)
    + poly(c.right, P(cx + b, cy + b, z), P(cx + b, cy - b, z), apex);
}
function prism(x, y, w, d, hgt, c) { // tent: ridge along y
  const mx = x + w / 2;
  return poly(c.right, P(x + w, y, 0), P(x + w, y + d, 0), P(mx, y + d, hgt), P(mx, y, hgt))
    + poly(c.left, P(x, y + d, 0), P(x + w, y + d, 0), P(mx, y + d, hgt))
    + poly('#0b0b0b', P(mx - w * 0.15, y + d, 0), P(mx + w * 0.15, y + d, 0), P(mx, y + d, hgt * 0.5));
}

// deterministic pseudo-random
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export function sceneSVG(stage, lit, locked) {
  const ch = Math.floor((stage - 1) / 10);
  const k = ((stage - 1) % 10) + 1; // 1..10 within chapter
  const c = locked ? { top: '#262626', left: '#1a1a1a', right: '#202020' } : lit ? LIT : DARK;
  const r = rnd(stage * 97 + 13);
  const items = []; // [depth, svg]
  const push = (x, y, s) => items.push([x + y, s]);

  // slab
  let out = box(0, 0, 10, 10, 0.9, { top: '#272727', left: '#161616', right: '#1c1c1c' }, -0.9);

  const key = CHAPTERS[ch].key;
  if (key === 'gate') {
    for (let i = 0; i < Math.min(k, 3); i++) push(2 + i * 1.6, 6.5 + r(), box(2 + i * 1.6, 6.5, 0.8, 0.8, 0.5, c));
    if (k >= 4) push(3.5, 3.5, box(3.5, 3.5, 0.9, 0.9, k >= 6 ? 4.6 : 3.6, c));
    if (k >= 5) push(6, 3.5, box(6, 3.5, 0.9, 0.9, k >= 6 ? 4.6 : 3.6, c));
    if (k >= 6) push(6.8, 4.4, box(2.6, 3.5, 5.3, 0.9, 0.7, c, 4.6) + box(3.3, 3.6, 3.9, 0.7, 0.4, c, 3.6));
    if (k >= 9) push(8, 8, box(7.6, 7.4, 0.6, 0.6, 0.4, c));
  } else if (key === 'forest') {
    const n = 1 + Math.round(k * 1.1);
    for (let i = 0; i < n; i++) {
      const x = 1.2 + r() * 7.6, y = 1.2 + r() * 7.6, s = 0.5 + r() * 0.5 + (k >= 8 && i === 0 ? 0.8 : 0);
      push(x, y, box(x - 0.15, y - 0.15, 0.3, 0.3, 0.6, DARK) + pyramid(x, y, s, 2.4 * s + 1, c, 0.5));
    }
  } else if (key === 'camp') {
    push(4, 4, prism(2.5, 3, 3, 3.2, 2.6, c));
    if (k >= 6) push(6.5, 1.5, prism(6, 1, 2.4, 2.6, 2, c));
    if (k >= 3) push(6.8, 6.8, box(6.4, 6.4, 0.8, 0.8, 0.2, DARK) + pyramid(6.8, 6.8, 0.35, k === 4 ? 0.6 : 1.2, lit ? { left: '#ff3b1f', right: '#ff7a1f' } : c, 0.2));
    if (k >= 7) push(8.5, 4, box(8, 3.6, 1, 0.7, 0.6, c));
  } else if (key === 'tower') {
    const floors = Math.min(4, Math.ceil(k / 2));
    for (let f = 0; f < floors; f++) {
      push(5 + f * 0.001, 5, box(3.6 + f * 0.2, 3.6 + f * 0.2, 2.8 - f * 0.4, 2.8 - f * 0.4, 1.6, f % 2 ? DARK : c, f * 1.6));
    }
    if (k >= 6) push(5.2, 5.2, pyramid(5, 5, 1.8, 1.6, c, floors * 1.6));
    if (k >= 8) push(5.3, 5.3, box(4.7, 4.7, 0.6, 0.6, 0.5, LIT, floors * 1.6 + 1.6));
  } else if (key === 'lake') {
    const w = lit ? WATER_LIT : WATER_DARK;
    out += poly(w.top, P(1.2, 1.2, 0.01), P(8.8, 1.2, 0.01), P(8.8, 8.8, 0.01), P(1.2, 8.8, 0.01));
    if (k >= 2) push(1.8, 7, box(0.4, 6, 2.4, 0.8, 0.25, c));
    if (k >= 3) push(4 + k * 0.25, 5, box(3.6 + k * 0.25, 4.6, 1.4, 0.7, 0.35, c));
    if (k >= 7) push(6.5, 2.5, pyramid(6.5, 2.5, 1, 1.4, c));
  } else {
    const H = 3 + k * 0.9;
    const b = 3.2;
    const apex = P(5, 5, H);
    out += poly(DARK.left, P(5 - b, 5 + b), P(5 + b, 5 + b), apex) + poly(DARK.right, P(5 + b, 5 + b), P(5 + b, 5 - b), apex);
    // lit summit cap grows with progress
    const cap = Math.min(0.95, 0.25 + k * 0.07);
    const lerp = (a, z) => [a[0] + (apex[0] - a[0]) * (1 - cap), a[1] + (apex[1] - a[1]) * (1 - cap)];
    const L = lerp(P(5 - b, 5 + b)), M = lerp(P(5 + b, 5 + b)), R = lerp(P(5 + b, 5 - b));
    const notch = (a, z) => [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2 + 6];
    out += poly(c.left, L, notch(L, M), M, apex) + poly(c.right, M, notch(M, R), R, apex);
  }

  items.sort((a, z) => a[0] - z[0]);
  out += items.map((i) => i[1]).join('');
  return `<svg viewBox="40 -30 340 320" xmlns="http://www.w3.org/2000/svg"><g class="lift">${out}</g></svg>`;
}
