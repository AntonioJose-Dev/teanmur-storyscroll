/**
 * marks.js
 * Configuración de los 5 marcadores de sección.
 * Cada uno define: id, label, frameStart, frameEnd, x (0-1), y (0-1).
 * FADE_FRAMES: frames de transición suave al entrar/salir.
 */

export const MARKS = [
  // x/y en 0–1: un poco más hacia el centro y abajo (map / lila sin tocar).
  { id: 'who',  label: 'Quiénes somos',   frameStart:  5, frameEnd:  30, x: 0.17, y: 0.27 },
  { id: 'pros', label: 'Profesionales',    frameStart: 31, frameEnd:  50, x: 0.76, y: 0.31 },
  { id: 'part', label: 'Particulares',     frameStart: 51, frameEnd:  74, x: 0.19, y: 0.57 },
  { id: 'news', label: 'Novedades',        frameStart: 75, frameEnd:  95, x: 0.73, y: 0.58 },
  { id: 'map',  label: 'Mapa / Contacto', frameStart: 96, frameEnd: 115, x: 0.50, y: 0.78 },
];

export const FADE_FRAMES = 8;
