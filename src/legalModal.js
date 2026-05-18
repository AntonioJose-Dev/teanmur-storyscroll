/**
 * legalModal.js
 * Inyecta el footer legal en el DOM y gestiona el modal de textos legales.
 * Importa los textos desde legalTexts.js y los muestra en un overlay interno.
 *
 * Uso externo:
 *   import { openModal } from './legalModal.js';
 *   openModal('avisoLegal');
 */

import legalTexts from './legalTexts.js';

// ── Modal overlay ─────────────────────────────────────────────────────────────

const overlayEl = document.createElement('div');
overlayEl.id = 'legal-overlay';
overlayEl.setAttribute('role', 'dialog');
overlayEl.setAttribute('aria-modal', 'true');
overlayEl.setAttribute('aria-labelledby', 'legal-modal-title');
overlayEl.innerHTML = `
  <div class="legal-modal">
    <button class="legal-modal__close" aria-label="Cerrar">×</button>
    <h2 class="legal-modal__title" id="legal-modal-title"></h2>
    <div class="legal-modal__body"></div>
  </div>
`;
document.body.appendChild(overlayEl);

const titleEl  = overlayEl.querySelector('#legal-modal-title');
const bodyEl   = overlayEl.querySelector('.legal-modal__body');
const closeBtn = overlayEl.querySelector('.legal-modal__close');

// ── Footer legal ──────────────────────────────────────────────────────────────

const footerEl = document.createElement('footer');
footerEl.id = 'site-footer';
footerEl.innerHTML = `
  <div class="sf-blob-wrap">
    <!-- Mancha de pintura SVG — forma orgánica anclada abajo-izquierda -->
    <svg class="sf-blob-svg" viewBox="0 0 520 250" preserveAspectRatio="xMinYMax meet"
         aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path class="sf-blob-path" d="
        M 0,250
        L 0,98
        C 4,68 22,40 55,24
        C 90,7 138,0 192,3
        Q 245,6 295,14
        C 348,22 400,38 440,60
        Q 470,78 488,106
        C 506,136 508,170 496,200
        C 484,228 460,244 428,249
        Q 390,254 340,251
        C 265,247 155,245 60,248
        Q 25,249 0,250 Z
      "/>
    </svg>
    <!-- Contenido dentro del blob -->
    <div class="sf-content">
      <span class="sf-copy">© 2026 TEANMUR. Todos los derechos reservados.</span>
      <nav class="sf-links" aria-label="Avisos legales">
        <a href="#" data-legal="avisoLegal">Aviso Legal</a>
        <span class="sf-sep" aria-hidden="true">|</span>
        <a href="#" data-legal="privacidad">Política de privacidad</a>
        <span class="sf-sep" aria-hidden="true">|</span>
        <a href="#" data-legal="accesibilidad">Accesibilidad</a>
        <span class="sf-sep" aria-hidden="true">|</span>
        <a href="#" data-legal="cookies">Política de cookies</a>
      </nav>
      <p class="sf-design">Diseño web: Antonio José Marín</p>
    </div>
  </div>
`;

// El footer va al final del body, tras #scroll-space
document.body.appendChild(footerEl);

// ── Eventos footer ────────────────────────────────────────────────────────────

footerEl.querySelectorAll('a[data-legal]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    openModal(a.dataset.legal);
  });
});

// ── Open / Close ──────────────────────────────────────────────────────────────

let _prevFocus = null;

/**
 * Abre el modal legal con el texto correspondiente a la clave dada.
 * @param {keyof typeof legalTexts} key - e.g. 'avisoLegal' | 'privacidad' | ...
 */
export function openModal(key) {
  const entry = legalTexts[key];
  if (!entry) { console.warn('[legalModal] clave desconocida:', key); return; }

  titleEl.textContent = entry.title;
  bodyEl.textContent  = entry.content;
  bodyEl.scrollTop    = 0;

  _prevFocus = document.activeElement;
  overlayEl.classList.add('is-open');
  // Focus en el botón de cierre para accesibilidad
  closeBtn.focus();
}

/**
 * Cierra el modal legal y devuelve el foco al elemento anterior.
 */
export function closeModal() {
  overlayEl.classList.remove('is-open');
  _prevFocus?.focus();
}

// Botón ×
closeBtn.addEventListener('click', closeModal);

// Click en el fondo oscuro (fuera del cuadro)
overlayEl.addEventListener('click', e => {
  if (e.target === overlayEl) closeModal();
});

// Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && overlayEl.classList.contains('is-open')) closeModal();
});
