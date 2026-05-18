/**
 * marksEngine.js
 * Motor puro sin DOM. Calcula la visibilidad de cada marca según el frame actual.
 *
 * Modelo STICKY:
 *   - Al avanzar el scroll: la mancha aparece gradualmente al acercarse a frameStart
 *     y se QUEDA completamente visible a partir de frameStart.
 *   - Al retroceder el scroll: la mancha desaparece cuando el frame baja de frameStart.
 *
 * Eventos: 'enter', 'leave', 'update', 'click'
 */

import { MARKS, FADE_FRAMES } from './marks.js';

function easeInOut(t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function calcVisibility(frame, mark) {
  const { frameStart } = mark;
  const fadeStart = Math.max(1, frameStart - FADE_FRAMES);
  if (frame < fadeStart) return 0;
  if (frame >= frameStart) return 1;
  return easeInOut((frame - fadeStart) / Math.max(1, frameStart - fadeStart));
}

export class MarksEngine {
  constructor() {
    this._vis        = new Map(MARKS.map(m => [m.id, 0]));
    this._prevActive = new Map(MARKS.map(m => [m.id, false]));
    this._listeners  = { enter: [], leave: [], update: [], click: [] };
  }

  on(event, fn)  { if (this._listeners[event]) this._listeners[event].push(fn); return this; }
  off(event, fn) { if (this._listeners[event]) this._listeners[event] = this._listeners[event].filter(f => f !== fn); return this; }
  _emit(event, data) { (this._listeners[event] ?? []).forEach(fn => fn(data)); }

  update(frame) {
    MARKS.forEach(mark => {
      const v         = calcVisibility(frame, mark);
      const isActive  = v > 0;
      const wasActive = this._prevActive.get(mark.id) ?? false;
      this._vis.set(mark.id, v);
      this._prevActive.set(mark.id, isActive);
      if (!wasActive && isActive)  this._emit('enter', { id: mark.id });
      if (wasActive  && !isActive) this._emit('leave', { id: mark.id });
      this._emit('update', { id: mark.id, visibility: v });
    });
  }

  getVisibility(id)   { return this._vis.get(id) ?? 0; }
  isActive(id)        { return (this._vis.get(id) ?? 0) > 0; }
  getAllVisibilities() { return Object.fromEntries(this._vis); }
  triggerClick(id)    { this._emit('click', { id }); }
}
