/**
 * sectionPanel.js
 * ───────────────
 * Modal central con salpicaduras en los bordes al abrir.
 * Cada sección tiene su propio color de acento.
 *
 * API pública:
 *   sectionPanel.open(sectionId, options?)
 *     options.detailSlug — pros|part: ficha del hub.
 *     options.activeStoreId — map: id de tienda (murcia | cartagena | cieza).
 *   sectionPanel.close()
 *   sectionPanel.getOpenSectionId() → string|null (para contexto del asistente de voz)
 */

import { PANEL_CONTENT } from './sectionPanelContent.js';

// ── Un color diferente por sección ────────────────────────────────────────────
const SECTION_COLORS = {
  who:  '#C9A84C',   // oro       — Empresa / Marca
  pros: '#5B9BD5',   // azul      — Profesionales / Industrial
  part: '#D4785A',   // terracota — Particulares / Hogar
  news: '#5FAD8E',   // verde     — Novedades / Lanzamientos
  map:  '#A07BC8',   // violeta   — Contacto / Mapa
};

const BG      = '#0E0D0B';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

// ── Utilidades ────────────────────────────────────────────────────────────────
function makeRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0x100000000;
  };
}

function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Convierte '#rrggbb' → 'r,g,b'  para usar en rgba(var(--sp-accent-rgb), 0.35)
function hexToRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

// ── Salpicadura SVG (blob + regueros + satélites) ─────────────────────────────
function generateSplat(rng, color) {
  const NS = 'http://www.w3.org/2000/svg';
  const VB = 200, cx = 100, cy = 100;

  // 1. Blob central con pinchos irregulares
  const N = 18 + Math.floor(rng() * 8);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.20;
    const spike = rng();
    const r = spike > 0.55 ? 38 + rng() * 38
             : spike > 0.30 ? 20 + rng() * 15
             :                  6 + rng() * 12;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  let blobD = '';
  for (let i = 0; i < N; i++) {
    const c = pts[i], nx = pts[(i+1) % N];
    const m = [(c[0]+nx[0])/2, (c[1]+nx[1])/2];
    if (i === 0) blobD += `M${m[0].toFixed(1)},${m[1].toFixed(1)} `;
    blobD += `Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)} `;
  }
  blobD += 'Z';

  const g = document.createElementNS(NS, 'g');
  const blob = document.createElementNS(NS, 'path');
  blob.setAttribute('d', blobD);
  blob.setAttribute('fill', color);
  g.appendChild(blob);

  // 2. Regueros finos
  for (let s = 0, n = 4 + Math.floor(rng() * 4); s < n; s++) {
    const a = rng() * Math.PI * 2, dist = 52 + rng() * 48;
    const sx = cx + Math.cos(a) * dist, sy = cy + Math.sin(a) * dist;
    const el = document.createElementNS(NS, 'ellipse');
    el.setAttribute('cx', sx.toFixed(1)); el.setAttribute('cy', sy.toFixed(1));
    el.setAttribute('rx', (2 + rng() * 5).toFixed(1));
    el.setAttribute('ry', (8 + rng() * 22).toFixed(1));
    el.setAttribute('fill', color);
    el.setAttribute('transform', `rotate(${(a*180/Math.PI).toFixed(1)},${sx.toFixed(1)},${sy.toFixed(1)})`);
    g.appendChild(el);
  }

  // 3. Gotitas satélite
  for (let i = 0, n = 6 + Math.floor(rng() * 6); i < n; i++) {
    const a = rng() * Math.PI * 2, dist = 62 + rng() * 58;
    const ci = document.createElementNS(NS, 'circle');
    ci.setAttribute('cx', (cx + Math.cos(a) * dist).toFixed(1));
    ci.setAttribute('cy', (cy + Math.sin(a) * dist).toFixed(1));
    ci.setAttribute('r',  (1.5 + rng() * 7).toFixed(1));
    ci.setAttribute('fill', color);
    g.appendChild(ci);
  }

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VB} ${VB}`);
  svg.style.display = 'block';
  svg.appendChild(g);
  return svg;
}

// ── Swatch de pintura para tarjetas de producto (HTML string) ─────────────────
function makeSwatchSVG(productName, color) {
  const rng = makeRng(hashStr(productName));
  const N = 9;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push({ x: 5 + t * 190, y: 38 + (rng() - 0.5) * 16, hw: Math.sin(Math.PI * t) * (13 + rng() * 9) + 2 });
  }
  let upper = `M${pts[0].x.toFixed(1)},${(pts[0].y - pts[0].hw).toFixed(1)}`;
  let lower = '';
  for (let i = 1; i <= N; i++) upper += ` L${pts[i].x.toFixed(1)},${(pts[i].y - pts[i].hw).toFixed(1)}`;
  for (let i = N; i >= 0; i--) lower += ` L${pts[i].x.toFixed(1)},${(pts[i].y + pts[i].hw).toFixed(1)}`;

  let drops = '';
  for (let d = 0; d < 7; d++) {
    const dx = 15 + rng() * 170, dy = 10 + rng() * 55, dr = 1.5 + rng() * 5;
    drops += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${dr.toFixed(1)}" fill="${color}" opacity="${(0.2 + rng() * 0.5).toFixed(2)}"/>`;
  }

  return `<svg viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg" width="100%" height="70">
    <rect width="200" height="70" fill="#090807"/>
    <path d="${upper}${lower} Z" fill="${color}" opacity="0.55"/>
    ${drops}
  </svg>`;
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  /* CSS vars actualizadas por JS en cada apertura */
  #sp-root {
    --sp-accent: #C9A84C;
    --sp-accent-rgb: 201,168,76;
    /* z-index alto: salpicaduras van dentro de este root; por encima de canvas, marcas y asistente */
    position: fixed; inset: 0; z-index: 2147483000;
    pointer-events: none;
    display: flex; align-items: center; justify-content: center;
  }
  #sp-root.is-open { pointer-events: auto; }

  #sp-backdrop {
    position: absolute; inset: 0; background: transparent;
    transition: background 0.28s ease;
  }
  #sp-root.is-open #sp-backdrop { background: rgba(0,0,0,0.72); }

  #sp-modal {
    position: relative; z-index: 160;
    width: min(820px, calc(100vw - 24px));
    max-height: 84vh;
    background: ${BG};
    border: 1px solid rgba(var(--sp-accent-rgb), 0.38);
    border-top: 3px solid rgba(var(--sp-accent-rgb), 0.70);
    border-radius: 20px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 32px 100px rgba(0,0,0,0.80), 0 0 0 1px rgba(var(--sp-accent-rgb),0.08);
    opacity: 0; transform: scale(0.87); pointer-events: none;
    transition: opacity 0.30s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1);
  }
  #sp-root.is-open #sp-modal { opacity: 1; transform: scale(1); pointer-events: auto; }
  @media (prefers-reduced-motion: reduce) {
    #sp-backdrop, #sp-modal { transition: opacity 0.12s ease !important; transform: none !important; }
  }

  #sp-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 22px 26px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
  }
  #sp-header-text { display: flex; flex-direction: column; gap: 4px; }
  #sp-tag {
    font-size: 0.66rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--sp-accent);
  }
  #sp-title {
    font-size: 1.42rem; font-weight: 800; color: #f0ebe0;
    letter-spacing: -0.02em; line-height: 1.2;
    font-family: system-ui, -apple-system, sans-serif;
  }
  #sp-close {
    background: rgba(255,255,255,0.07); border: none;
    color: rgba(255,255,255,0.45); cursor: pointer;
    width: 32px; height: 32px; border-radius: 8px; font-size: 0.95rem;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-left: 12px;
    transition: background 0.12s, color 0.12s;
    font-family: system-ui, -apple-system, sans-serif;
  }
  #sp-close:hover { background: rgba(255,255,255,0.14); color: #fff; }
  #sp-close:focus-visible { outline: 2px solid var(--sp-accent); outline-offset: 2px; }

  #sp-body {
    flex: 1; overflow-y: auto; padding: 22px 26px 26px;
    scroll-behavior: smooth;
    scrollbar-width: thin; scrollbar-color: rgba(var(--sp-accent-rgb),0.22) transparent;
    display: flex; flex-direction: column; gap: 18px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* ── Salpicaduras ── */
  .sp-drop { position: fixed; pointer-events: none; z-index: 25; transform-origin: center; will-change: transform, opacity; }
  @keyframes sp-splat-in {
    0%   { opacity: 0; transform: rotate(var(--rot)) scale(0); }
    65%  { opacity: var(--op); transform: rotate(var(--rot)) scale(1.10); }
    100% { opacity: var(--op); transform: rotate(var(--rot)) scale(1); }
  }
  @keyframes sp-splat-out {
    from { opacity: var(--op); transform: rotate(var(--rot)) scale(1); }
    to   { opacity: 0;         transform: rotate(var(--rot)) scale(0.35); }
  }

  /* ── Intro ── */
  .sp-intro { font-size: 0.87rem; color: rgba(255,255,255,0.50); line-height: 1.70; }

  /* ── Productos — grid 2 col ── */
  .sp-products { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
  @media (max-width: 520px) { .sp-products { grid-template-columns: 1fr; } }

  .sp-product {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden;
    display: flex; flex-direction: column;
    transition: transform 0.18s ease, border-color 0.18s;
    cursor: default;
  }
  .sp-product:hover { transform: translateY(-2px); border-color: rgba(var(--sp-accent-rgb),0.40); }

  .sp-product-swatch { display: block; flex-shrink: 0; overflow: hidden; line-height: 0; }
  .sp-product-swatch svg { display: block; width: 100%; }

  .sp-product-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .sp-product-tag {
    font-size: 0.59rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
    color: var(--sp-accent);
    background: rgba(var(--sp-accent-rgb),0.13); border: 1px solid rgba(var(--sp-accent-rgb),0.28);
    padding: 3px 9px; border-radius: 20px; align-self: flex-start;
  }
  .sp-product-name { font-size: 0.94rem; font-weight: 700; color: #f0ebe0; line-height: 1.25; }
  .sp-product-desc { font-size: 0.77rem; color: rgba(255,255,255,0.44); line-height: 1.60; margin: 0; flex: 1; }

  /* ── Marca ── */
  .sp-brand-body { display: flex; flex-direction: column; gap: 14px; }
  .sp-brand-para { font-size: 0.88rem; color: rgba(255,255,255,0.57); line-height: 1.72; }
  .sp-brand-intro {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .sp-brand-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sp-brand-img-wrap {
    flex-shrink: 0;
    width: 170px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.50);
  }
  .sp-brand-img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }
  .sp-values-title { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; color: var(--sp-accent); margin-top: 6px; }
  .sp-values { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .sp-value  { display: flex; align-items: center; gap: 10px; font-size: 0.84rem; color: rgba(255,255,255,0.72); }
  .sp-value::before { content:''; width:6px; height:6px; border-radius:50%; background: var(--sp-accent); flex-shrink:0; }

  /* ── Novedades ── */
  .sp-news { display: flex; flex-direction: column; }
  .sp-news-item { padding: 18px 0; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 6px; }
  .sp-news-item:last-child { border-bottom: none; }
  .sp-news-date  { font-size: 0.64rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--sp-accent); }
  .sp-news-title { font-size: 0.92rem; font-weight: 700; color: #f0ebe0; line-height: 1.3; }
  .sp-news-desc  { font-size: 0.80rem; color: rgba(255,255,255,0.48); line-height: 1.60; }

  /* ── Contacto ── */
  .sp-contact { display: flex; flex-direction: column; gap: 18px; }
  .sp-contact-row { display: flex; flex-direction: column; gap: 4px; }
  .sp-contact-label { font-size: 0.64rem; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: var(--sp-accent); }
  .sp-contact-value { font-size: 0.88rem; color: rgba(255,255,255,0.74); line-height: 1.55; white-space: pre-line; }
  .sp-contact-value a { color: rgba(255,255,255,0.74); text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.20); transition: color 0.14s, border-color 0.14s; }
  .sp-contact-value a:hover { color: var(--sp-accent); border-color: var(--sp-accent); }
  .sp-hours { display: flex; flex-direction: column; gap: 6px; }
  .sp-hours-row { display: flex; justify-content: space-between; gap: 16px; font-size: 0.83rem; color: rgba(255,255,255,0.55); }
  .sp-hours-row span:first-child { color: rgba(255,255,255,0.78); }
  .sp-cta {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--sp-accent); color: ${BG}; border: none;
    padding: 11px 22px; border-radius: 10px;
    font-size: 0.81rem; font-weight: 700; letter-spacing: 0.03em;
    cursor: pointer; text-decoration: none;
    transition: opacity 0.14s, transform 0.14s;
    align-self: flex-start; margin-top: 4px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .sp-cta:hover  { opacity: 0.84; transform: translateY(-1px); }
  .sp-cta:active { opacity: 1;    transform: translateY(0); }

  /* ── Hub servicios (Profesionales / Particulares) ── */
  .sp-hub-animate {
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 0.38s ease, transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .sp-hub-animate.is-in { opacity: 1; transform: translateY(0); }
  @media (prefers-reduced-motion: reduce) {
    .sp-hub-animate { opacity: 1; transform: none; transition: none; }
  }

  .sp-hub-img-wrap {
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 14px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.45);
    max-height: 160px;
  }
  .sp-hub-img {
    display: block;
    width: 100%;
    height: 160px;
    object-fit: cover;
    object-position: center;
  }

  .sp-hub-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  @media (max-width: 520px) {
    .sp-hub-grid { grid-template-columns: 1fr; }
  }

  .sp-hub-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }
  .sp-hub-card:hover {
    transform: translateY(-2px);
    border-color: rgba(var(--sp-accent-rgb), 0.42);
    background: rgba(255, 255, 255, 0.06);
  }
  .sp-hub-card:focus-visible {
    outline: 2px solid var(--sp-accent);
    outline-offset: 2px;
  }
  .sp-hub-card-icon { font-size: 1.5rem; line-height: 1; flex-shrink: 0; }
  .sp-hub-card-title {
    font-size: 0.84rem;
    font-weight: 700;
    color: #f0ebe0;
    line-height: 1.28;
  }

  .sp-hub-detail { display: flex; flex-direction: column; gap: 16px; }
  .sp-hub-media {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    background: linear-gradient(145deg, #2a2825 0%, #1a1917 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }
  .sp-hub-media--img {
    background: none;
    border: none;
  }
  .sp-hub-media-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
  .sp-hub-detail-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #f0ebe0;
    margin: 0;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }
  .sp-hub-detail-body {
    font-size: 0.86rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.68;
    margin: 0;
  }
  .sp-hub-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 4px; }

  .sp-hub-cta-matte {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 20px;
    border-radius: 10px;
    border: 1px solid rgba(180, 150, 80, 0.35);
    background: linear-gradient(180deg, #a68b4a 0%, #7a6234 100%);
    color: #141210;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-decoration: none;
    cursor: pointer;
    font-family: system-ui, -apple-system, sans-serif;
    transition: opacity 0.14s ease, transform 0.14s ease, filter 0.14s ease;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.22);
  }
  .sp-hub-cta-matte:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    filter: brightness(1.04);
  }
  .sp-hub-cta-matte:active { transform: translateY(0); opacity: 1; }

  .sp-hub-back {
    display: inline-flex;
    align-items: center;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    font-family: system-ui, -apple-system, sans-serif;
    transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
  }
  .sp-hub-back:hover {
    background: rgba(255, 255, 255, 0.09);
    color: #f0ebe0;
    border-color: rgba(255, 255, 255, 0.22);
  }

  /* ── Contacto multi-tienda + mapa simulado (misma vista modal) ── */
  .sp-stores-wrap { display: flex; flex-direction: column; gap: 16px; }
  .sp-stores-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 1.12fr);
    gap: 18px;
    align-items: stretch;
  }
  @media (max-width: 640px) {
    .sp-stores-layout {
      grid-template-columns: 1fr;
    }
    .sp-contact-map {
      max-height: none;
      min-height: 240px;
      aspect-ratio: 4 / 3;
    }
  }
  .sp-stores-col-data {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .sp-stores-col-map {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 0;
  }
  .sp-contact-map-caption {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
    margin: 0;
  }
  .sp-stores-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  @media (max-width: 560px) {
    .sp-stores-grid { grid-template-columns: 1fr; }
  }
  .sp-store-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px 14px 16px;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    font: inherit;
    cursor: pointer;
    color: #f0ebe0;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease;
  }
  .sp-store-card:hover {
    background: rgba(255, 255, 255, 0.055);
    border-color: rgba(var(--sp-accent-rgb), 0.35);
    transform: translateY(-1px);
  }
  .sp-store-card.is-active {
    border-color: rgba(var(--sp-accent-rgb), 0.65);
    background: rgba(var(--sp-accent-rgb), 0.10);
    box-shadow: 0 0 0 1px rgba(var(--sp-accent-rgb), 0.25), 0 12px 32px rgba(0, 0, 0, 0.35);
  }
  .sp-store-card-name {
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: #f0ebe0;
  }
  .sp-store-card-meta {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.42);
    line-height: 1.35;
  }

  .sp-store-detail {
    padding: 16px 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sp-store-detail-name {
    font-size: 1.02rem;
    font-weight: 800;
    color: #f0ebe0;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .sp-store-detail-row { display: flex; flex-direction: column; gap: 3px; }
  .sp-store-detail-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--sp-accent);
  }
  .sp-store-detail-value {
    font-size: 0.84rem;
    color: rgba(255, 255, 255, 0.72);
    line-height: 1.55;
    white-space: pre-line;
  }
  .sp-store-detail-value a {
    color: rgba(255, 255, 255, 0.78);
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.18);
    transition: color 0.14s, border-color 0.14s;
  }
  .sp-store-detail-value a:hover { color: var(--sp-accent); border-color: var(--sp-accent); }

  .sp-contact-map {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 200px;
    aspect-ratio: 16 / 10;
    max-height: min(42vh, 320px);
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: #0e0d0b;
  }
  .sp-contact-leaflet-root {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }
  .sp-contact-map .leaflet-container {
    width: 100%;
    height: 100%;
    background: #121110;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .sp-contact-map .leaflet-control-attribution {
    font-size: 0.58rem;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: rgba(14, 13, 11, 0.88) !important;
    color: rgba(255, 255, 255, 0.42);
    border-radius: 6px 0 0 0;
  }
  .sp-contact-map .leaflet-control-attribution a {
    color: var(--sp-accent);
  }
  .sp-leaflet-divicon {
    background: transparent !important;
    border: none !important;
  }
  .sp-leaflet-pin {
    width: 16px;
    height: 16px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: linear-gradient(145deg, #6a5f4d 0%, #3d3830 100%);
    border: 2px solid rgba(255, 255, 255, 0.28);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
  }
  .sp-leaflet-pin.is-active {
    width: 19px;
    height: 19px;
    margin: -1.5px 0 0 -1.5px;
    background: linear-gradient(145deg, #c9a84c 0%, #8a7038 100%);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(var(--sp-accent-rgb), 0.35), 0 6px 16px rgba(0, 0, 0, 0.55);
    z-index: 1000;
  }
  .sp-contact-map-fallback-msg {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.52);
    text-align: center;
    z-index: 2;
  }

  .sp-contact-global-mail {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.45);
  }
  .sp-contact-global-mail a {
    color: var(--sp-accent);
    text-decoration: none;
    font-weight: 600;
    border-bottom: 1px solid rgba(var(--sp-accent-rgb), 0.35);
  }
  .sp-contact-global-mail a:hover { opacity: 0.9; }

  .sp-store-nav-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    margin-top: 2px;
    padding: 9px 14px;
    border-radius: 10px;
    font-size: 0.76rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    text-decoration: none;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    font-family: system-ui, -apple-system, sans-serif;
    transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
  }
  .sp-store-nav-secondary:hover {
    color: var(--sp-accent);
    border-color: rgba(var(--sp-accent-rgb), 0.45);
    background: rgba(var(--sp-accent-rgb), 0.08);
  }

  /* ── Responsive móvil ──────────────────────────────────────────────── */
  @media (max-width: 480px) {
    #sp-modal {
      width: calc(100vw - 16px);
      max-height: 92vh;
      border-radius: 14px;
    }
    #sp-header {
      padding: 16px 18px 12px;
    }
    #sp-body {
      padding: 14px 16px 18px;
      gap: 14px;
    }

    /* Imagen lateral de Quiénes somos: demasiado ancha en pantallas pequeñas */
    .sp-brand-img-wrap {
      width: 100px;
    }

    /* Imagen de cabecera del hub */
    .sp-hub-img-wrap { max-height: 110px; }
    .sp-hub-img      { height: 110px; }

    /* CTAs a ancho completo para mejor área de toque */
    .sp-cta,
    .sp-hub-cta-matte,
    .sp-hub-back,
    .sp-store-nav-secondary {
      width: 100%;
      justify-content: center;
      text-align: center;
      box-sizing: border-box;
    }
    .sp-hub-actions {
      flex-direction: column;
    }

    /* Contacto: horarios en columna para evitar overflow */
    .sp-hours-row {
      flex-direction: column;
      gap: 2px;
    }

    /* Mapa: altura ajustada */
    .sp-contact-map {
      min-height: 180px;
      max-height: 220px;
    }
  }
`;
document.head.appendChild(style);

// ── DOM ───────────────────────────────────────────────────────────────────────
const root = document.createElement('div');
root.id = 'sp-root';
root.setAttribute('aria-hidden', 'true');
root.innerHTML = `
  <div id="sp-backdrop"></div>
  <div id="sp-modal" role="dialog" aria-modal="true" aria-label="Panel de sección">
    <header id="sp-header">
      <div id="sp-header-text">
        <span id="sp-tag"></span>
        <h2 id="sp-title"></h2>
      </div>
      <button id="sp-close" aria-label="Cerrar">✕</button>
    </header>
    <div id="sp-body"></div>
  </div>
`;
document.body.appendChild(root);

const backdrop = root.querySelector('#sp-backdrop');
const modal    = root.querySelector('#sp-modal');
const tagEl    = root.querySelector('#sp-tag');
const titleEl  = root.querySelector('#sp-title');
const bodyEl   = root.querySelector('#sp-body');
const closeBtn = root.querySelector('#sp-close');

bodyEl.addEventListener('click', (e) => {
  if (!openSectionId) return;
  const content = PANEL_CONTENT[openSectionId];

  if (content?.type === 'contactStores') {
    const hit = e.target.closest('[data-sp-store-card]');
    if (hit) {
      e.preventDefault();
      const id = hit.getAttribute('data-sp-store-card');
      if (id && content.stores.some((s) => s.id === id)) {
        activeStoreId = id;
        renderContactStores(content);
      }
      return;
    }
  }

  if (!content || content.type !== 'serviceHub') return;

  if (e.target.closest('[data-sp-hub-back]')) {
    e.preventDefault();
    hubPanelState = { sectionId: openSectionId, mode: 'list', optionId: null };
    renderServiceHub(content, openSectionId);
    return;
  }
  const card = e.target.closest('[data-sp-hub-card]');
  if (card) {
    const optId = card.getAttribute('data-sp-hub-card');
    if (!optId) return;
    hubPanelState = { sectionId: openSectionId, mode: 'detail', optionId: optId };
    renderServiceHub(content, openSectionId);
  }
});

// ── Salpicaduras a lo largo del borde del modal ───────────────────────────────
let activeDrops = [];
/** Sección del panel actualmente abierto (null si cerrado). */
let openSectionId = null;

/**
 * Vista lista vs detalle del hub (Profesionales / Particulares).
 * @type {{ sectionId: string|null, mode: 'list'|'detail', optionId: string|null }}
 */
let hubPanelState = { sectionId: null, mode: 'list', optionId: null };

/** Tienda seleccionada en el panel Contacto (sección map). */
let activeStoreId = null;

let contactLeafletMap = null;
let leafletLoadPromise = null;

function destroyContactLeafletMap() {
  if (contactLeafletMap) {
    try {
      contactLeafletMap.off();
      contactLeafletMap.remove();
    } catch (_) {
      /* ignore */
    }
    contactLeafletMap = null;
  }
}

function loadLeafletOnce() {
  if (typeof window !== 'undefined' && window.L) return Promise.resolve(window.L);
  if (!leafletLoadPromise) {
    leafletLoadPromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.async = true;
      s.onload = () => {
        if (window.L) resolve(window.L);
        else reject(new Error('Leaflet'));
      };
      s.onerror = () => reject(new Error('Leaflet'));
      document.head.appendChild(s);
    });
  }
  return leafletLoadPromise;
}

function storeDivIcon(L, isActive) {
  return L.divIcon({
    className: 'sp-leaflet-divicon',
    html: `<div class="sp-leaflet-pin${isActive ? ' is-active' : ''}"></div>`,
    iconSize: isActive ? [28, 28] : [24, 24],
    iconAnchor: isActive ? [14, 26] : [12, 22],
  });
}

function mountContactStoresMap(c, stores, sel) {
  const host = bodyEl.querySelector('#sp-contact-leaflet');
  if (!host) return;

  loadLeafletOnce()
    .then((L) => {
      if (!bodyEl.contains(host)) return;

      const map = L.map(host, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const bounds = L.latLngBounds(stores.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds.pad(0.22));

      stores.forEach((s) => {
        const isSel = s.id === sel;
        const marker = L.marker([s.lat, s.lng], {
          icon: storeDivIcon(L, isSel),
          title: s.name,
        }).addTo(map);
        marker.on('click', () => {
          if (activeStoreId === s.id) return;
          activeStoreId = s.id;
          renderContactStores(c);
        });
      });

      contactLeafletMap = map;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (contactLeafletMap === map) map.invalidateSize();
        });
      });
    })
    .catch(() => {
      host.innerHTML =
        '<p class="sp-contact-map-fallback-msg">No se ha podido cargar el mapa. Usa «Cómo llegar» para abrir la ruta en Google Maps.</p>';
    });
}

// Devuelve un punto en el perímetro del rect con la normal exterior
function getEdgePoint(t, rect) {
  const { left, top, width, height } = rect;
  const perim = 2 * (width + height);
  let d = ((t % 1) + 1) % 1 * perim;
  if (d < width)   return { x: left + d,         y: top,              nx:  0, ny: -1 };
  d -= width;
  if (d < height)  return { x: left + width,      y: top + d,          nx:  1, ny:  0 };
  d -= height;
  if (d < width)   return { x: left + width - d,  y: top + height,     nx:  0, ny:  1 };
  d -= width;
  return             { x: left,                y: top + height - d,  nx: -1, ny:  0 };
}

function spawnDrops(rect, color) {
  if (REDUCED.matches) return;

  const rng   = makeRng(Date.now());
  const vw    = window.innerWidth, vh = window.innerHeight;
  const count = 2 + Math.floor(rng() * 2);   // 2-3 salpicaduras

  // Posiciones fijas en esquinas/lados opuestos para que no se apelotonen
  const anchorTs = [0.10, 0.52, 0.78, 0.30]; // top-left, bottom, right, top-right

  for (let i = 0; i < count; i++) {
    const size = 110 + rng() * 80;   // 110-190px

    // Usar anchorTs para separar las salpicaduras por el perímetro
    const t    = anchorTs[i] + (rng() - 0.5) * 0.08;
    const edge = getEdgePoint(t, rect);

    // Desplazamiento perpendicular: siempre hacia afuera del borde
    const reach = size * (0.25 + rng() * 0.35);
    const px = edge.x + edge.nx * reach - size / 2;
    const py = edge.y + edge.ny * reach - size / 2;

    const cpx = Math.max(-size * 0.40, Math.min(vw - size * 0.60, px));
    const cpy = Math.max(-size * 0.40, Math.min(vh - size * 0.60, py));

    const rot = (rng() - 0.5) * 60;
    const op  = (0.65 + rng() * 0.20).toFixed(2);
    const del = i * 60 + rng() * 20;

    const div = document.createElement('div');
    div.className = 'sp-drop';
    div.style.cssText = `
      left:${cpx.toFixed(1)}px; top:${cpy.toFixed(1)}px;
      width:${size.toFixed(1)}px; height:${size.toFixed(1)}px;
      --rot:${rot.toFixed(1)}deg; --op:${op};
      animation: sp-splat-in 0.52s cubic-bezier(0.34,1.56,0.64,1) ${del.toFixed(0)}ms forwards;
    `;

    const svg = generateSplat(rng, color);
    svg.setAttribute('width',  size.toFixed(1));
    svg.setAttribute('height', size.toFixed(1));
    div.appendChild(svg);
    /* Dentro de #sp-root: si van a body con z>150 tapaban todo el modal (capa “pillada”). */
    root.appendChild(div);
    activeDrops.push({ el: div, op });
  }
}

function removeDrops(callback) {
  if (!activeDrops.length) { callback?.(); return; }
  activeDrops.forEach(({ el, op }, i) => {
    el.style.animation = `sp-splat-out 0.22s ease ${i * 12}ms forwards`;
    el.style.setProperty('--op', op);
  });
  const total = 250 + activeDrops.length * 12;
  setTimeout(() => { activeDrops.forEach(({ el }) => el.remove()); activeDrops = []; callback?.(); }, total);
}

// ── Render ────────────────────────────────────────────────────────────────────
function esc(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderProducts(c, color) {
  bodyEl.innerHTML = `
    <p class="sp-intro">${esc(c.intro)}</p>
    <div class="sp-products">
      ${c.products.map(p => `
        <div class="sp-product">
          <div class="sp-product-swatch">${makeSwatchSVG(p.name, color)}</div>
          <div class="sp-product-body">
            <span class="sp-product-tag">${esc(p.tag)}</span>
            <span class="sp-product-name">${esc(p.name)}</span>
            <p class="sp-product-desc">${esc(p.description)}</p>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderBrand(c) {
  bodyEl.innerHTML = `
    <div class="sp-brand-body">
      <div class="sp-brand-intro">
        <div class="sp-brand-text">
          ${c.body.map(p => `<p class="sp-brand-para">${esc(p)}</p>`).join('')}
        </div>
        <div class="sp-brand-img-wrap">
          <img
            src="public/quienes-somos-equipo.jpg"
            alt="Equipo TEANMUR – Eficientes, Resolutivos, Responsables"
            class="sp-brand-img"
            loading="lazy"
          />
        </div>
      </div>
      <span class="sp-values-title">Nuestros valores</span>
      <div class="sp-values">${c.values.map(v => `<div class="sp-value">${esc(v)}</div>`).join('')}</div>
    </div>`;
}

function renderNews(c) {
  bodyEl.innerHTML = `
    <div class="sp-news">
      ${c.items.map(item => `
        <div class="sp-news-item">
          <span class="sp-news-date">${esc(item.date)}</span>
          <span class="sp-news-title">${esc(item.title)}</span>
          <p class="sp-news-desc">${esc(item.description)}</p>
        </div>`).join('')}
    </div>`;
}

function runHubEnterAnimation(rootEl) {
  const el = rootEl?.querySelector?.('.sp-hub-animate');
  if (!el) return;
  if (REDUCED.matches) {
    el.classList.add('is-in');
    return;
  }
  el.classList.remove('is-in');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('is-in'));
  });
}

function renderServiceHub(content, sectionId) {
  const { mode, optionId } = hubPanelState;
  if (mode === 'detail' && optionId) {
    const opt = content.options.find((o) => o.id === optionId);
    if (!opt) {
      hubPanelState = { sectionId, mode: 'list', optionId: null };
      return renderServiceHub(content, sectionId);
    }
    const detailImgHtml = opt.image
      ? `<div class="sp-hub-media sp-hub-media--img">
           <img src="${esc(opt.image)}" alt="${esc(opt.title)}" class="sp-hub-media-img" loading="lazy"/>
         </div>`
      : `<div class="sp-hub-media" role="img" aria-label="Ilustración (próximamente)"></div>`;

    bodyEl.innerHTML = `
      <div class="sp-hub-animate sp-hub-detail">
        ${detailImgHtml}
        <h3 class="sp-hub-detail-title">${esc(opt.title)}</h3>
        <p class="sp-hub-detail-body">${esc(opt.body)}</p>
        <div class="sp-hub-actions">
          <a class="sp-hub-cta-matte" href="${esc(opt.ctaHref)}">${esc(opt.ctaLabel)}</a>
          <button type="button" class="sp-hub-back" data-sp-hub-back>← Volver</button>
        </div>
      </div>`;
    runHubEnterAnimation(bodyEl);
    return;
  }

  const hubImgHtml = content.image
    ? `<div class="sp-hub-img-wrap">
         <img src="${esc(content.image)}" alt="" class="sp-hub-img" loading="lazy" aria-hidden="true"/>
       </div>`
    : '';

  bodyEl.innerHTML = `
    <p class="sp-intro">${esc(content.intro)}</p>
    ${hubImgHtml}
    <div class="sp-hub-animate sp-hub-grid">
      ${content.options
        .map(
          (o) => `
        <button type="button" class="sp-hub-card" data-sp-hub-card="${esc(o.id)}">
          <span class="sp-hub-card-icon" aria-hidden="true">${esc(o.icon)}</span>
          <span class="sp-hub-card-title">${esc(o.title)}</span>
        </button>`
        )
        .join('')}
    </div>`;
    runHubEnterAnimation(bodyEl);
}

function renderContactStores(c) {
  destroyContactLeafletMap();

  const stores = c.stores || [];
  if (!stores.length) return;

  const sel =
    activeStoreId && stores.some((s) => s.id === activeStoreId) ? activeStoreId : stores[0].id;
  activeStoreId = sel;
  const active = stores.find((s) => s.id === sel) || stores[0];

  const cardSubtitle = (addr) => String(addr || '').split('\n')[0].slice(0, 56);

  bodyEl.innerHTML = `
    <div class="sp-stores-wrap">
      <p class="sp-intro">${esc(c.intro || '')}</p>
      <div class="sp-stores-grid">
        ${stores
          .map(
            (s) => `
        <button type="button" class="sp-store-card${s.id === sel ? ' is-active' : ''}" data-sp-store-card="${esc(s.id)}">
          <span class="sp-store-card-name">${esc(s.name)}</span>
          <span class="sp-store-card-meta">${esc(cardSubtitle(s.address))}</span>
        </button>`
          )
          .join('')}
      </div>
      <div class="sp-stores-layout">
        <div class="sp-stores-col-data">
          <div class="sp-store-detail">
            <h3 class="sp-store-detail-name">${esc(active.name)}</h3>
            <div class="sp-store-detail-row">
              <span class="sp-store-detail-label">Dirección</span>
              <span class="sp-store-detail-value">${esc(active.address)}</span>
            </div>
            <div class="sp-store-detail-row">
              <span class="sp-store-detail-label">Teléfono</span>
              <span class="sp-store-detail-value"><a href="tel:${String(active.phone).replace(/\s/g, '')}">${esc(active.phone)}</a></span>
            </div>
            ${
              active.phoneExtra
                ? `<div class="sp-store-detail-row">
              <span class="sp-store-detail-label">Móvil</span>
              <span class="sp-store-detail-value"><a href="tel:${String(active.phoneExtra).replace(/\s/g, '')}">${esc(active.phoneExtra)}</a></span>
            </div>`
                : ''
            }
            ${
              active.email
                ? `<div class="sp-store-detail-row">
              <span class="sp-store-detail-label">Email</span>
              <span class="sp-store-detail-value"><a href="mailto:${esc(active.email)}">${esc(active.email)}</a></span>
            </div>`
                : ''
            }
            <div class="sp-store-detail-row">
              <span class="sp-store-detail-label">Horario</span>
              <span class="sp-store-detail-value">${esc(active.hours)}</span>
            </div>
          </div>
          <a class="sp-store-nav-secondary" href="${esc(active.mapsUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a>
        </div>
        <div class="sp-stores-col-map">
          <p class="sp-contact-map-caption">Mapa · OpenStreetMap</p>
          <div class="sp-contact-map">
            <div id="sp-contact-leaflet" class="sp-contact-leaflet-root" role="application" aria-label="Mapa de tiendas TEANMUR"></div>
          </div>
        </div>
      </div>
    </div>`;

  mountContactStoresMap(c, stores, sel);
}

function renderContact(c) {
  bodyEl.innerHTML = `
    <div class="sp-contact">
      <div class="sp-contact-row"><span class="sp-contact-label">Dirección</span><span class="sp-contact-value">${esc(c.address)}</span></div>
      <div class="sp-contact-row"><span class="sp-contact-label">Teléfono</span><span class="sp-contact-value"><a href="tel:${c.phone.replace(/\s/g,'')}">${esc(c.phone)}</a></span></div>
      <div class="sp-contact-row"><span class="sp-contact-label">Email</span><span class="sp-contact-value"><a href="mailto:${c.email}">${esc(c.email)}</a></span></div>
      <div class="sp-contact-row"><span class="sp-contact-label">Horario</span>
        <div class="sp-hours">${c.hours.map(h=>`<div class="sp-hours-row"><span>${esc(h.day)}</span><span>${esc(h.time)}</span></div>`).join('')}</div>
      </div>
      <a class="sp-cta" href="${esc(c.mapsUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a>
    </div>`;
}

const SECTION_TAGS = { who:'Empresa', pros:'Profesionales', part:'Particulares', news:'Actualidad', map:'Contacto' };

// ── API pública ───────────────────────────────────────────────────────────────
export const sectionPanel = {
  getOpenSectionId() {
    return openSectionId;
  },

  /** Si el hub (Profesionales / Particulares) está en una ficha, vuelve al grid sin cerrar el modal. */
  hubBackToListIfPossible() {
    if (!openSectionId) return false;
    const content = PANEL_CONTENT[openSectionId];
    if (content?.type !== 'serviceHub') return false;
    if (hubPanelState.mode !== 'detail' || !hubPanelState.optionId) return false;
    hubPanelState = { sectionId: openSectionId, mode: 'list', optionId: null };
    renderServiceHub(content, openSectionId);
    return true;
  },

  open(sectionId, options = {}) {
    const detailSlugRaw = options?.detailSlug != null ? String(options.detailSlug).trim().toLowerCase() : '';
    const activeStoreRaw =
      options?.activeStoreId != null ? String(options.activeStoreId).trim().toLowerCase() : '';
    const content = PANEL_CONTENT[sectionId];
    if (!content) return;

    destroyContactLeafletMap();

    // Evitar capas: quitar salpicaduras de la apertura anterior (mismo panel, otra sección)
    if (activeDrops.length) {
      activeDrops.forEach(({ el }) => el.remove());
      activeDrops = [];
    }

    // 1. Color de sección
    const color = SECTION_COLORS[sectionId] ?? '#C9A84C';
    root.style.setProperty('--sp-accent',     color);
    root.style.setProperty('--sp-accent-rgb', hexToRgb(color));

    // 2. Renderizar contenido
    tagEl.textContent   = SECTION_TAGS[sectionId] ?? '';
    titleEl.textContent = content.title;
    bodyEl.innerHTML    = '';
    bodyEl.scrollTop    = 0;

    if (content.type !== 'serviceHub') {
      hubPanelState = { sectionId: null, mode: 'list', optionId: null };
    }
    if (content.type !== 'contactStores') {
      activeStoreId = null;
    }

    switch (content.type) {
      case 'products': renderProducts(content, color); break;
      case 'brand':    renderBrand(content);           break;
      case 'news':     renderNews(content);            break;
      case 'contact':  renderContact(content);         break;
      case 'contactStores': {
        const ids = content.stores.map((s) => s.id);
        const sid = activeStoreRaw && ids.includes(activeStoreRaw) ? activeStoreRaw : content.stores[0].id;
        activeStoreId = sid;
        renderContactStores(content);
        break;
      }
      case 'serviceHub': {
        const hasSlug = detailSlugRaw && content.options.some((o) => o.id === detailSlugRaw);
        hubPanelState = {
          sectionId,
          mode: hasSlug ? 'detail' : 'list',
          optionId: hasSlug ? detailSlugRaw : null,
        };
        renderServiceHub(content, sectionId);
        break;
      }
    }

    // 3. Leer dimensiones reales del modal ANTES de abrirlo
    //    (el modal está en el DOM con opacity:0 — layout es válido)
    const mw = modal.offsetWidth  || Math.min(820, window.innerWidth  - 24);
    const mh = modal.offsetHeight || Math.min(window.innerHeight * 0.84, 560);
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = {
      left:   (vw - mw) / 2,
      top:    (vh - mh) / 2,
      right:  (vw + mw) / 2,
      bottom: (vh + mh) / 2,
      width:  mw,
      height: mh,
    };

    // 4. Abrir modal
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // 5. Salpicaduras en los bordes del modal
    spawnDrops(rect, color);
    requestAnimationFrame(() => closeBtn.focus());
    openSectionId = sectionId;
  },

  close() {
    destroyContactLeafletMap();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    removeDrops();
    openSectionId = null;
    hubPanelState = { sectionId: null, mode: 'list', optionId: null };
    activeStoreId = null;
  },
};

// ── Eventos ───────────────────────────────────────────────────────────────────
closeBtn.addEventListener('click', () => sectionPanel.close());
backdrop.addEventListener('click', () => sectionPanel.close());
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && root.classList.contains('is-open')) sectionPanel.close();
});
