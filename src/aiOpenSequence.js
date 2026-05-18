/**
 * aiOpenSequence.js
 * Apertura de sección desde la IA: scroll → espera visibilidad de la mancha → preview (openMark) → modal.
 * No sustituye a storyMarks.openMark ni a sectionPanel.open; solo orquesta en orden.
 */

import { MARKS } from './marks.js';

/** Frames de “aproximación” antes del tramo de la mancha (primera fase de scroll). */
const APPROACH_FRAMES_BEFORE = 12;

/** Tras el primer scroll, pausa breve antes de acercar al frame exacto. */
const PAUSE_AFTER_APPROACH_MS = 220;

/** Visibilidad mínima de la mancha (0–1) antes de abrir preview/modal. */
const MIN_VISIBILITY_AFTER_ARRIVAL = 0.9;

/** Tiempo máximo esperando a que el motor marque la mancha como visible. */
const VISIBILITY_WAIT_CAP_MS = 16000;

/** Tras ver la mancha lista, pausa cinematográfica antes de openMark. */
const PAUSE_AFTER_VISIBLE_MS = 360;

/** Tras la tarjeta preview, pausa antes del panel central. */
const PAUSE_AFTER_OPEN_MARK_MS = 480;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function scrollTopForProgress(progress) {
  const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
  return Math.min(maxScroll, Math.max(0, progress * maxScroll));
}

/** Progreso 0–1 que sitúa el frame del motor en ~`engineFrame` (1…totalFrames). */
function progressForEngineFrame(engineFrame, totalFrames) {
  const f = Math.max(1, Math.min(totalFrames, engineFrame));
  return Math.min(1, Math.max(0, (f - 0.5) / totalFrames));
}

/**
 * Espera a que el scroll suave se acerque a `targetY` (tolerancia + frames estables)
 * o a que venza el plazo. No usa scroll engine nuevo: solo mide scrollY.
 */
async function waitScrollNear(targetY, timeoutMs = 14000) {
  const tol = 10;
  const deadline = Date.now() + timeoutMs;
  let stable = 0;
  return new Promise((resolve) => {
    function tick() {
      const y = window.scrollY;
      if (Math.abs(y - targetY) < tol) stable += 1;
      else stable = 0;
      if (stable >= 5) return resolve();
      if (Date.now() > deadline) return resolve();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function smoothScrollToEngineFrame(engineFrame, totalFrames, syncFrame) {
  const p = progressForEngineFrame(engineFrame, totalFrames);
  const y = scrollTopForProgress(p);
  window.scrollTo({ top: y, behavior: 'smooth' });
  await waitScrollNear(y);
  syncFrame();
  window.dispatchEvent(new Event('scroll', { bubbles: true }));
  await delay(90);
}

async function waitUntilMarkVisible(marksEngine, markId, minVis, capMs, syncFrame) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    function tick() {
      syncFrame();
      if ((marksEngine.getVisibility(markId) ?? 0) >= minVis) return resolve();
      if (Date.now() - t0 > capMs) return resolve();
      requestAnimationFrame(tick);
    }
    tick();
  });
}

/**
 * @param {{ totalFrames: number, marksEngine: { getVisibility: (id: string) => number }, sectionPanel: { close: () => void, open: (id: string, opts?: object) => void }, syncFrame: () => void }} deps
 * @returns {(sectionId: string, opts?: { detailSlug?: string|null }) => Promise<void>}
 */
export function createAIOpenSectionSequence(deps) {
  const { totalFrames, marksEngine, sectionPanel, syncFrame } = deps;
  const sync = typeof syncFrame === 'function' ? syncFrame : () => {};

  return async function openSectionFromAI(sectionId, opts = {}) {
    const mark = MARKS.find((m) => m.id === sectionId);
    if (!mark) return;

    sectionPanel.close();
    window.storyMarks?.closeMark?.();

    const approachEngineFrame = Math.max(1, mark.frameStart - APPROACH_FRAMES_BEFORE);
    if (approachEngineFrame < mark.frameStart) {
      await smoothScrollToEngineFrame(approachEngineFrame, totalFrames, sync);
      await delay(PAUSE_AFTER_APPROACH_MS);
    }

    await smoothScrollToEngineFrame(mark.frameStart, totalFrames, sync);
    await waitUntilMarkVisible(marksEngine, sectionId, MIN_VISIBILITY_AFTER_ARRIVAL, VISIBILITY_WAIT_CAP_MS, sync);
    await delay(PAUSE_AFTER_VISIBLE_MS);

    window.storyMarks?.openMark?.(sectionId);
    await delay(PAUSE_AFTER_OPEN_MARK_MS);
    window.storyMarks?.closeMark?.();

    sectionPanel.open(sectionId, opts);
  };
}
