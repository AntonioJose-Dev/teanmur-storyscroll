/**
 * marksUI.js
 * Renderiza cada marca como un trazo de rodillo de pintura (SVG con ruido).
 * Gestiona el panel de micro-preview y expone window.storyMarks.
 *
 * Comportamiento (sticky):
 *   - Las manchas aparecen al acercarse a frameStart.
 *   - Se QUEDAN visibles una vez alcanzado frameStart.
 *   - Solo desaparecen al retroceder el scroll por debajo de frameStart.
 */

import { MARKS } from './marks.js';
import { SECTION_CONTENT } from './sectionContent.js';
import { sectionPanel } from './sectionPanel.js';

const NS = 'http://www.w3.org/2000/svg';

const STROKE_COLORS = [
  '#C9A84C',  // who  — gold
  '#2E5B8A',  // pros — cobalt
  '#B8552E',  // part — terra cotta
  '#4E7A3C',  // news — forest green
  '#7B4F8A',  // map  — plum
];

// Mapa id → color de acento (mismo que el blob)
const ACCENT_COLORS = Object.fromEntries(
  MARKS.map((m, i) => [m.id, STROKE_COLORS[i % STROKE_COLORS.length]])
);

// ── Cursor: gota de pintura ───────────────────────────────────────────────────
function makePaintDropCursor(hexColor) {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="14" viewBox="0 0 26 34">` +
    `<path d="M13 1C6 9 1 17 1 23a12 12 0 0024 0C25 17 20 9 13 1z" fill="${hexColor}" opacity="0.92"/>` +
    `<ellipse cx="8.5" cy="19" rx="2" ry="3.2" fill="white" opacity="0.30" transform="rotate(-22 8.5 19)"/>` +
    `<path d="M13 31c0 0-1.2 2 0 3.2 1.2-1.2 0-3.2 0-3.2z" fill="${hexColor}" opacity="0.68"/>` +
    `</svg>`
  );
  // hotspot en la punta superior
  return `url("data:image/svg+xml,${svg}") 5 1, crosshair`;
}

// Cursores pre-generados por sección (uno por color)
const DROP_CURSORS = Object.fromEntries(
  MARKS.map((m, i) => [m.id, makePaintDropCursor(STROKE_COLORS[i % STROKE_COLORS.length])])
);

// ── PRNG seeded (LCG rápido) ─────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = s ^ (s >>> 16);
    return (s >>> 0) / 0x100000000;
  };
}

// ── SVG mancha de brocha + salpicadura ───────────────────────────────────────
function createPaintSVG(seed, color, W = 420, H = 115) {
  const rng = seededRng(seed);

  const w   = W * (0.78 + rng() * 0.38);
  const h   = H * (0.68 + rng() * 0.42);
  const hw  = w / 2;
  const hh  = h / 2;

  const tilt        = (rng() - 0.5) * 20;
  const noiseSeed   = Math.floor(rng() * 96) + 2;
  const dispScale   = 20 + rng() * 18;          // bordes muy rugosos
  const baseOpacity = 0.78 + rng() * 0.20;

  const filterId = `paint-f-${seed}`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `${-hw - 60} ${-hh - 50} ${w + 120} ${h + 100}`);
  svg.setAttribute('width',  w);
  svg.setAttribute('height', h);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.overflow  = 'visible';
  svg.style.transform = `rotate(${tilt}deg)`;

  const defs = document.createElementNS(NS, 'defs');

  // ── Filtro de borde rugoso ────────────────────────────────────────────────
  const flt = document.createElementNS(NS, 'filter');
  flt.id = filterId;
  flt.setAttribute('x', '-30%'); flt.setAttribute('y', '-50%');
  flt.setAttribute('width', '160%'); flt.setAttribute('height', '200%');
  flt.setAttribute('color-interpolation-filters', 'sRGB');

  const turb = document.createElementNS(NS, 'feTurbulence');
  turb.setAttribute('type', 'fractalNoise');
  turb.setAttribute('baseFrequency', '0.028 0.052');
  turb.setAttribute('numOctaves', '5');
  turb.setAttribute('seed', noiseSeed);
  turb.setAttribute('result', 'noise');
  flt.appendChild(turb);

  const disp = document.createElementNS(NS, 'feDisplacementMap');
  disp.setAttribute('in', 'SourceGraphic');
  disp.setAttribute('in2', 'noise');
  disp.setAttribute('scale', dispScale.toFixed(1));
  disp.setAttribute('xChannelSelector', 'R');
  disp.setAttribute('yChannelSelector', 'G');
  flt.appendChild(disp);

  defs.appendChild(flt);
  svg.appendChild(defs);

  // ── Blob central: N puntos en elipse, radio perturbado ───────────────────
  const N = 10 + Math.floor(rng() * 3);   // 10–12 puntos
  const blobPts = [];
  for (let i = 0; i < N; i++) {
    const angle   = (i / N) * Math.PI * 2 - Math.PI / 2;
    const radial  = 0.58 + rng() * 0.64;  // perturbación radial fuerte
    const rx      = hw * 0.86 * radial;
    const ry      = hh * 0.80 * (0.62 + rng() * 0.56);
    blobPts.push([Math.cos(angle) * rx, Math.sin(angle) * ry]);
  }

  // Suavizado: Q-bezier por los puntos medios (curva cerrada suave)
  let d = '';
  for (let i = 0; i < N; i++) {
    const cur  = blobPts[i];
    const next = blobPts[(i + 1) % N];
    const mid  = [(cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2];
    if (i === 0) d += `M ${mid[0].toFixed(1)} ${mid[1].toFixed(1)} `;
    d += `Q ${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${mid[0].toFixed(1)} ${mid[1].toFixed(1)} `;
  }
  d += 'Z';

  const blob = document.createElementNS(NS, 'path');
  blob.setAttribute('d', d);
  blob.setAttribute('fill', color);
  blob.setAttribute('fill-opacity', baseOpacity.toFixed(3));
  blob.setAttribute('filter', `url(#${filterId})`);
  svg.appendChild(blob);

  // ── Gotitas satelitales (salpicadura) ────────────────────────────────────
  const numDrops = 5 + Math.floor(rng() * 5);   // 5–9 gotas
  for (let i = 0; i < numDrops; i++) {
    const angle   = rng() * Math.PI * 2;
    const dist    = hw * (0.52 + rng() * 0.72);
    const dx      = Math.cos(angle) * dist;
    const dy      = Math.sin(angle) * dist * 0.42;   // aplanar (brocha es más ancha que alta)
    const dropRx  = 3 + rng() * 16;                  // eje largo
    const dropRy  = dropRx * (0.18 + rng() * 0.45);  // eje corto → elongada
    const dropOp  = 0.38 + rng() * 0.52;
    const rotDeg  = (angle * 180 / Math.PI).toFixed(1);

    const drop = document.createElementNS(NS, 'ellipse');
    drop.setAttribute('cx', dx.toFixed(1));
    drop.setAttribute('cy', dy.toFixed(1));
    drop.setAttribute('rx', dropRx.toFixed(1));
    drop.setAttribute('ry', dropRy.toFixed(1));
    drop.setAttribute('fill', color);
    drop.setAttribute('fill-opacity', dropOp.toFixed(3));
    drop.setAttribute('transform', `rotate(${rotDeg} ${dx.toFixed(1)} ${dy.toFixed(1)})`);
    // Solo desplazar las gotas más grandes
    if (dropRx > 8) drop.setAttribute('filter', `url(#${filterId})`);
    svg.appendChild(drop);
  }

  return svg;
}

// ── MarksUI ───────────────────────────────────────────────────────────────────
export class MarksUI {
  constructor(engine) {
    this._engine = engine;
    this._blobs  = new Map();
    this._previewEl    = null;
    this._openId       = null;
    this._closeTimer   = null;   // delay para evitar parpadeo al mover el ratón
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this._overlay = document.getElementById('overlay');
    if (!this._overlay) { console.error('[marksUI] Falta #overlay en HTML'); return; }

    this._buildBlobs();
    this._buildPreview();
    this._bindGlobalEvents();
    this._registerPublicAPI();
  }

  _buildBlobs() {
    MARKS.forEach((mark, i) => {
      const seed  = mark.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) * 137 + i * 31;
      const color = STROKE_COLORS[i % STROKE_COLORS.length];

      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'mark-blob';
      btn.dataset.id = mark.id;
      btn.tabIndex   = -1;
      btn.setAttribute('aria-label',  `Ver sección: ${mark.label}`);
      btn.setAttribute('aria-hidden', 'true');
      btn.style.cssText = [
        `left: ${mark.x * 100}%`,
        `top: ${mark.y * 100}%`,
        `z-index: ${10 + i}`,
        `opacity: 0`,
        `pointer-events: none`,
      ].join('; ');

      btn.style.cursor = DROP_CURSORS[mark.id] ?? 'crosshair';
      // Tamaño relativo al viewport: ~36% de ancho, entre 320px y 580px
      const splatW = Math.min(580, Math.max(320, Math.round(window.innerWidth * 0.36)));
      const splatH = Math.round(splatW * 0.28);
      btn.appendChild(createPaintSVG(seed, color, splatW, splatH));

      const lbl = document.createElement('span');
      lbl.className = 'mark-label';
      lbl.setAttribute('aria-hidden', 'true');
      lbl.textContent = mark.label;
      btn.appendChild(lbl);

      // Hover: abre al pasar el cursor, cierra con pequeño delay al salir
      btn.addEventListener('mouseenter', () => this._hoverOpen(mark.id));
      btn.addEventListener('mouseleave', () => this._hoverLeave());

      // Touch / teclado: click como respaldo
      btn.addEventListener('click', () => this._handleClick(mark.id));
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._handleClick(mark.id); }
      });

      this._overlay.appendChild(btn);
      this._blobs.set(mark.id, btn);
    });
  }

  _buildPreview() {
    const el = document.createElement('div');
    el.id        = 'mark-preview';
    el.className = 'mark-preview';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-label', 'Vista previa de sección');
    el.hidden = true;
    el.innerHTML = `
      <div class="mark-preview__accent-bar"></div>
      <button class="mark-preview__close" type="button" aria-label="Cerrar vista previa">✕</button>
      <span class="mark-preview__meta"></span>
      <h2 class="mark-preview__title"></h2>
      <p  class="mark-preview__desc"></p>
      <a  class="mark-preview__cta" role="button" tabindex="0"></a>
    `;
    el.querySelector('.mark-preview__close').addEventListener('click', () => this.close());

    // La tarjeta mantiene el hover activo mientras el cursor esté dentro
    el.addEventListener('mouseenter', () => this._cancelClose());
    el.addEventListener('mouseleave', () => this._hoverLeave());
    el.style.cursor = 'default';

    document.body.appendChild(el);
    this._previewEl = el;
  }

  _bindGlobalEvents() {
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this._openId) this.close(); });
    document.addEventListener('pointerdown', e => {
      if (!this._openId) return;
      if (!this._previewEl.contains(e.target) && !e.target.closest('.mark-blob')) this.close();
    });
    window.addEventListener('resize', () => {
      if (this._openId) this._positionPreview(this._openId);
      // Reescalar manchas si cambia el tamaño de ventana
      this._blobs.forEach((btn, id) => {
        const old = btn.querySelector('svg');
        if (old) old.remove();
        const mark = MARKS.find(m => m.id === id);
        const i    = MARKS.indexOf(mark);
        const seed = mark.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) * 137 + i * 31;
        const color = STROKE_COLORS[i % STROKE_COLORS.length];
        const splatW = Math.min(580, Math.max(320, Math.round(window.innerWidth * 0.36)));
        const splatH = Math.round(splatW * 0.28);
        btn.insertBefore(createPaintSVG(seed, color, splatW, splatH), btn.querySelector('.mark-label'));
      });
    });
  }

  render() {
    MARKS.forEach(mark => {
      const v  = this._engine.getVisibility(mark.id);
      const el = this._blobs.get(mark.id);
      if (!el) return;
      const visible = v > 0.04;
      el.style.opacity       = v;
      el.style.pointerEvents = visible ? 'auto' : 'none';
      el.tabIndex            = visible ? 0      : -1;
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (!this._reducedMotion.matches) {
        el.style.transform = `translate(-50%, -50%) scale(${(0.96 + v * 0.04).toFixed(3)})`;
      } else {
        el.style.transform = 'translate(-50%, -50%)';
      }
    });
  }

  _handleClick(id) {
    this._engine.triggerClick(id);
    // En touch, click alterna; en ratón el hover ya abrió la tarjeta, click la cierra
    if (this._openId === id) this.close(); else this.open(id);
  }

  _hoverOpen(id) {
    this._cancelClose();
    if (this._openId !== id) this.open(id);
  }

  _hoverLeave() {
    // Pequeño delay para que el cursor pueda moverse de la mancha a la tarjeta sin que se cierre
    this._closeTimer = setTimeout(() => this.close(), 120);
  }

  _cancelClose() {
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
  }

  open(id) {
    const mark    = MARKS.find(m => m.id === id);
    const content = SECTION_CONTENT[id];
    if (!mark || !content) return;

    const accent = ACCENT_COLORS[id] ?? '#C9A84C';
    this._openId = id;

    // Cursor de gota del color de esta sección
    this._previewEl.querySelector('.mark-preview__cta').style.cursor = DROP_CURSORS[id] ?? 'pointer';

    // Acento de color
    this._previewEl.querySelector('.mark-preview__accent-bar').style.background = accent;
    this._previewEl.style.setProperty('--preview-accent', accent);

    // Textos
    this._previewEl.querySelector('.mark-preview__meta').textContent  = content.metaLabel ?? '';
    this._previewEl.querySelector('.mark-preview__title').textContent = content.title;
    this._previewEl.querySelector('.mark-preview__desc').textContent  = content.shortDescription;

    // CTA — abre el panel lateral con el contenido completo de la sección
    const cta = this._previewEl.querySelector('.mark-preview__cta');
    cta.textContent = content.ctaLabel ?? 'Ver más →';
    cta.removeAttribute('href');
    cta.removeAttribute('target');
    cta.onclick = (e) => {
      e.preventDefault();
      this.close();              // cierra la preview card
      sectionPanel.open(id);    // abre el panel lateral
    };

    this._previewEl.hidden = false;
    void this._previewEl.offsetWidth;
    this._previewEl.classList.add('is-open');
    this._positionPreview(id);
    requestAnimationFrame(() => this._previewEl.querySelector('.mark-preview__close')?.focus());
  }

  close() {
    if (!this._openId) return;
    this._openId = null;
    this._previewEl.classList.remove('is-open');
    const delay = this._reducedMotion.matches ? 0 : 220;
    setTimeout(() => { if (!this._openId) this._previewEl.hidden = true; }, delay);
  }

  getOpenId() { return this._openId; }

  _positionPreview(id) {
    const mark = MARKS.find(m => m.id === id);
    if (!mark) return;
    const el  = this._previewEl;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const pw    = Math.min(268, vw - 32);
    const ph    = el.offsetHeight || 200;
    const gap   = 12;
    const mx    = mark.x * vw;
    const my    = mark.y * vh;

    let left, top;

    if (mark.y > 0.65) {
      // Mancha en la parte baja (ej. mapa): tarjeta centrada encima
      left = mx - pw / 2;
      top  = my - 44 - ph - gap;
    } else {
      // Resto: tarjeta al lado izquierdo o derecho según posición horizontal
      left = mark.x <= 0.5 ? mx + 130 + gap : mx - 130 - gap - pw;
      top  = my - ph / 2;
    }

    left = Math.max(gap, Math.min(vw - pw - gap, left));
    top  = Math.max(gap, Math.min(vh - ph - gap, top));
    el.style.left  = `${left}px`;
    el.style.top   = `${top}px`;
    el.style.width = `${pw}px`;
  }

  _registerPublicAPI() {
    const ui = this;
    window.storyMarks = {
      openMark(id)    { ui.open(id); },
      closeMark()     { ui.close(); },
      getActiveMark() { return ui.getOpenId(); },
    };
  }
}
