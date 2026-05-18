/**
 * main.js
 * Entry point. Conecta: scrollEngine → canvasRenderer → marksEngine → marksUI
 */

import { getScrollProgress, progressToFrameIndex } from './scrollEngine.js';
import { CanvasRenderer }                           from './canvasRenderer.js';
import { MarksEngine }                              from './marksEngine.js';
import { MarksUI }                                  from './marksUI.js';
import { sectionPanel }                             from './sectionPanel.js';
import { createAIOpenSectionSequence }              from './aiOpenSequence.js';
import { initAIWidget }                             from './aiWidget.js';
import './legalModal.js';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  totalFrames:    115,
  frameBasePath:  'public/frames/',
  framePrefix:    'frame_',
  framePadding:   4,
  frameExtension: '.jpg',
  scrollHeightVh: 500,
};

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('scroll-space').style.height = `${CONFIG.scrollHeightVh}vh`;

function getFramePath(index) {
  const n = String(index + 1).padStart(CONFIG.framePadding, '0');
  return `${CONFIG.frameBasePath}${CONFIG.framePrefix}${n}${CONFIG.frameExtension}`;
}

let lastFrameIndex = -1;

const renderer    = new CanvasRenderer('canvas');
const marksEngine = new MarksEngine();
const marksUI     = new MarksUI(marksEngine);

function syncScrollVisualFrame() {
  const progress   = getScrollProgress();
  const frameIndex = progressToFrameIndex(progress, CONFIG.totalFrames);
  lastFrameIndex = frameIndex;
  renderer.renderFrame(getFramePath(frameIndex), frameIndex, CONFIG.totalFrames);
  marksEngine.update(frameIndex + 1);
  marksUI.render();
}

const openSectionSequenced = createAIOpenSectionSequence({
  totalFrames: CONFIG.totalFrames,
  marksEngine,
  sectionPanel,
  syncFrame: syncScrollVisualFrame,
});

initAIWidget({ openSectionSequenced });

// ── Scroll loop ───────────────────────────────────────────────────────────────
let rafPending     = false;

function update() {
  rafPending = false;
  const progress   = getScrollProgress();
  const frameIndex = progressToFrameIndex(progress, CONFIG.totalFrames);

  if (frameIndex !== lastFrameIndex) {
    lastFrameIndex = frameIndex;
    renderer.renderFrame(getFramePath(frameIndex), frameIndex, CONFIG.totalFrames);
    marksEngine.update(frameIndex + 1);
  }

  marksUI.render();
}

window.addEventListener('scroll', () => {
  if (!rafPending) { rafPending = true; requestAnimationFrame(update); }
}, { passive: true });

update();
