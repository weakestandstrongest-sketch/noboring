// Launch animation, once per app launch: a new moon waxes to full under a few
// stars, the name rises in, then the moon swells and opens onto the app.
import { h } from './ui.js';

export function playSplash() {
  try {
    if (sessionStorage.getItem('quint.splash')) return;
    sessionStorage.setItem('quint.splash', '1');
  } catch {}
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const stars = [[14, 18, 3], [82, 24, 2.5], [76, 72, 3], [20, 66, 2], [52, 12, 2], [90, 48, 2], [8, 44, 2.5]]
    .map(([x, y, r], i) => h('i', { style: { left: `${x}%`, top: `${y}%`, width: `${r * 2}px`, height: `${r * 2}px`, animationDelay: `${0.15 + i * 0.07}s` } }));
  const word = h('div', { class: 'sp-word' }, [...'(Quint)'].map((c, i) =>
    h('span', { style: { animationDelay: `${0.55 + i * 0.05}s` } }, c)));
  const el = h('div', { class: 'splash', 'aria-hidden': 'true' },
    h('div', { class: 'sp-stars' }, stars),
    h('div', { class: 'sp-moon', html: `
      <svg viewBox="0 0 300 300">
        <defs>
          <radialGradient id="spM" cx=".32" cy=".3"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#eceeec"/><stop offset="1" stop-color="#a9b0ae"/></radialGradient>
          <clipPath id="spC"><circle cx="150" cy="150" r="140"/></clipPath>
        </defs>
        <circle cx="150" cy="150" r="140" fill="url(#spM)"/>
        <g clip-path="url(#spC)"><circle class="sp-shadow" cx="150" cy="150" r="146" fill="#1f1f1f" opacity=".94"/></g>
      </svg>` }),
    word);

  const finish = () => {
    el.classList.add('done');
    document.querySelector('.tabbar')?.classList.add('enter');
    setTimeout(() => el.remove(), 520);
  };
  const timer = setTimeout(finish, 1750);
  el.addEventListener('pointerdown', () => { clearTimeout(timer); finish(); }, { once: true });
  document.getElementById('app').append(el);
}
