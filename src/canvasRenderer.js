/**
 * canvasRenderer.js
 * Gestiona el <canvas> fijo al viewport.
 * Carga frames bajo demanda con caché, los dibuja con ajuste cover.
 * Si un frame no existe todavía, muestra un placeholder de debug.
 */

export class CanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.imageCache   = new Map();
    this.currentImage = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.currentImage) this._drawCover(this.currentImage);
  }

  _drawCover(img) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    // En móvil (< 480px) reducimos un 22% para que el bote se vea más alejado
    const mobileZoom = cw < 480 ? 0.78 : 1.0;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * mobileZoom;
    const dw = img.naturalWidth  * scale;
    const dh = img.naturalHeight * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, dx, dy, dw, dh);
  }

  _drawPlaceholder(frameIndex, totalFrames) {
    const { width: w, height: h } = this.canvas;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.fillStyle    = 'rgba(255,255,255,0.15)';
    this.ctx.font         = `bold ${Math.round(w * 0.08)}px monospace`;
    this.ctx.textAlign    = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      `${String(frameIndex + 1).padStart(4, '0')} / ${String(totalFrames).padStart(4, '0')}`,
      w / 2, h / 2
    );
    const progress = frameIndex / Math.max(totalFrames - 1, 1);
    this.ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this.ctx.fillRect(0, h - 4, w, 4);
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.fillRect(0, h - 4, w * progress, 4);
  }

  loadImage(src) {
    if (this.imageCache.has(src)) return Promise.resolve(this.imageCache.get(src));
    return new Promise((resolve, reject) => {
      const img  = new Image();
      img.onload = () => { this.imageCache.set(src, img); resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  async renderFrame(framePath, frameIndex, totalFrames) {
    try {
      const img = await this.loadImage(framePath);
      this.currentImage = img;
      this._drawCover(img);
    } catch {
      this._drawPlaceholder(frameIndex, totalFrames);
    }
  }
}
