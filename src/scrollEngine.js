/**
 * scrollEngine.js
 * Convierte la posición del scroll en un progreso 0-1
 * y ese progreso en un índice de frame.
 */

export function getScrollProgress() {
  const scrollTop = window.scrollY;
  const maxScroll  = document.body.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return 0;
  return Math.min(scrollTop / maxScroll, 1);
}

export function progressToFrameIndex(progress, totalFrames) {
  const index = Math.floor(progress * totalFrames);
  return Math.min(index, totalFrames - 1);
}
