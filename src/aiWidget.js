/**
 * aiWidget.js
 * ───────────
 * Chat flotante con voz (Fase 6).
 * La lógica de IA, secciones, modal y marks no se tocan aquí.
 *
 * ── Para ajustar la voz ──────────────────────────────────────────────────────
 * • Idioma de reconocimiento  → `LANG_RECOGNITION` (por defecto `navigator.language`, p. ej. es-ES / en-US)
 * • Voz TTS (gratis)          → `speechSynthesis` del navegador (voz del sistema en español u otro idioma según el texto). Opcional: `window.TEANMUR_USE_OPENAI_TTS = true` para usar `/api/tts` (OpenAI, de pago).
 * • Sin SpeechRecognition     → grabación + `/api/transcribe` (Whisper)
 * ────────────────────────────────────────────────────────────────────────────
 */

import { sectionPanel } from './sectionPanel.js';
import {
  assistantDidNotUnderstandReplyForLocale,
  assistantGreetingReplyForUserMessage,
  inferGreetingFromUserMessage,
  inferHubBackStepFromUserMessage,
  inferHubDetailFromUserMessage,
  inferMapStoreFromUserMessage,
  inferAssistantLocale,
  inferPageResetFromUserMessage,
  inferSectionFromReply,
  inferSectionFromUserMessage,
  isAllowedHubSlug,
  isAllowedMapStoreId,
  localizedFallbackReply,
  transcriptReplyEchoesUser,
  userMessageIsGreetingOnlyNoOtherIntent,
  userMessageAllowsCloseInferenceFromAssistantReply,
} from './hubIntentMap.js';

/**
 * Base del proxy IA.
 * - Prioridad 1: window.TEANMUR_AI_BASE (override manual en index.html)
 * - Prioridad 2: localhost → puerto 3002 (dev local: frontend en :3000, proxy en :3002)
 * - Prioridad 3: '' → mismo origen (producción en Railway: Express sirve web + API juntos)
 */
const AI_PROXY_ORIGIN = (() => {
  if (typeof window === 'undefined') return '';
  if (window.TEANMUR_AI_BASE && String(window.TEANMUR_AI_BASE).trim()) {
    return String(window.TEANMUR_AI_BASE).replace(/\/$/, '');
  }
  const h = window.location.hostname;
  return (h === 'localhost' || h === '127.0.0.1') ? 'http://localhost:3002' : '';
})();

const PROXY_CHAT_URL       = `${AI_PROXY_ORIGIN}/api/chat`;
const PROXY_TTS_URL        = `${AI_PROXY_ORIGIN}/api/tts`;
const PROXY_TRANSCRIBE_URL = `${AI_PROXY_ORIGIN}/api/transcribe`;
const PROXY_ADVICE_URL       = `${AI_PROXY_ORIGIN}/api/advice`;
const PROXY_COMPAT_URL       = `${AI_PROXY_ORIGIN}/api/compatibility`;

// ── TTS OpenAI (solo si window.TEANMUR_USE_OPENAI_TTS === true; por defecto: voz del sistema, gratis) ──
const TTS_VOICE = 'shimmer';
const TTS_MODEL = 'tts-1-hd';
const TTS_SPEED = 1;
const TTS_INSTRUCTIONS =
  'Speak in the same language as the input text. Keep the same voice and pace every time.';

const LANG_RECOGNITION =
  typeof navigator !== 'undefined' && navigator.language && String(navigator.language).trim()
    ? String(navigator.language).trim()
    : 'es-ES';

// ── Iconos SVG (estilo Lucide) ────────────────────────────────────────────────
const SVG_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
  <line x1="12" y1="19" x2="12" y2="22"/>
  <line x1="8"  y1="22" x2="16" y2="22"/>
</svg>`;

const SVG_VOLUME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
</svg>`;

const SVG_VOLUME_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  <line x1="23" y1="9"  x2="17" y2="15"/>
  <line x1="17" y1="9"  x2="23" y2="15"/>
</svg>`;

const SVG_SEND = `<svg viewBox="0 0 24 24" fill="#0E0D0B" width="16" height="16">
  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
</svg>`;

const SVG_CHAT = `<svg viewBox="0 0 24 24" fill="#0E0D0B" width="22" height="22">
  <path d="M12 2C6.48 2 2 6.02 2 11c0 2.67 1.19 5.07 3.08 6.74L4 22l4.5-1.5A10 10 0 0012 21c5.52 0 10-4.02 10-9S17.52 2 12 2zm1 13H7v-2h6v2zm2-4H7V9h8v2z"/>
</svg>`;

// ── Construir widget ──────────────────────────────────────────────────────────
export function initAIWidget(options = {}) {
  if (document.getElementById('ai-widget')) return;

  const openSectionSequenced =
    options && typeof options.openSectionSequenced === 'function' ? options.openSectionSequenced : null;

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #ai-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 100;
      width: 48px; height: 48px; border-radius: 50%;
      background: #C9A84C; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 18px rgba(0,0,0,0.55);
      transition: transform 0.18s ease, background 0.18s ease;
      outline: none;
    }
    #ai-fab:hover  { background: #dbb95a; transform: scale(1.08); }
    #ai-fab:active { transform: scale(0.96); }

    #ai-widget {
      position: fixed; bottom: 88px; right: 28px; z-index: 100;
      width: 300px; background: #0E0D0B;
      border: 1px solid rgba(201,168,76,0.30); border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.70);
      font-family: system-ui, -apple-system, sans-serif;
      display: flex; flex-direction: column; overflow: hidden;
      opacity: 0; transform: translateY(12px) scale(0.96); pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1);
    }
    #ai-widget.is-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

    /* Header */
    #ai-widget-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    #ai-widget-header span {
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; color: #C9A84C;
    }
    #ai-header-btns { display: flex; align-items: center; gap: 4px; }

    /* Botón mute */
    #ai-mute {
      background: none; border: none;
      color: rgba(255,255,255,0.35); cursor: pointer;
      width: 26px; height: 26px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.12s, background 0.12s;
    }
    #ai-mute:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.08); }
    #ai-mute.is-muted { color: rgba(255,90,90,0.75); }

    #ai-handsfree {
      background: none;
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      min-width: 30px;
      height: 26px;
      padding: 0 8px;
      border-radius: 7px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      transition: color 0.12s, background 0.12s, border-color 0.12s;
    }
    #ai-handsfree:hover {
      color: rgba(255,255,255,0.82);
      background: rgba(255,255,255,0.08);
    }
    #ai-handsfree.is-on {
      color: #0E0D0B;
      background: #C9A84C;
      border-color: #C9A84C;
    }
    #ai-mic.is-speaking {
      background: rgba(255,140,60,0.16);
      border-color: #ff9b4a;
      color: #ffb06b;
    }
    #ai-mic.is-speaking::before {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 13px;
      border: 2px solid #ff9b4a;
      animation: mic-pulse 1.1s ease-in-out infinite;
    }

    /* Botón cerrar */
    #ai-close {
      background: none; border: none;
      color: rgba(255,255,255,0.35); cursor: pointer;
      font-size: 1rem; line-height: 1; padding: 2px 6px;
      border-radius: 5px; transition: color 0.12s, background 0.12s;
    }
    #ai-close:hover { color: #fff; background: rgba(255,255,255,0.08); }

    /* Mensajes */
    #ai-messages {
      flex: 1; max-height: 200px; overflow-y: auto;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
      scrollbar-width: thin; scrollbar-color: rgba(201,168,76,0.3) transparent;
    }
    .ai-msg {
      font-size: 0.80rem; line-height: 1.50; max-width: 90%;
      padding: 8px 11px; border-radius: 10px;
      animation: ai-pop 0.18s ease;
    }
    .ai-msg--bot  { background: rgba(255,255,255,0.07); color: #e8e2d4; align-self: flex-start; border-bottom-left-radius: 3px; }
    .ai-msg--user { background: #C9A84C; color: #0E0D0B; align-self: flex-end; font-weight: 600; border-bottom-right-radius: 3px; }
    .ai-msg--loading {
      background: rgba(255,255,255,0.07); color: #e8e2d4;
      align-self: flex-start; border-bottom-left-radius: 3px;
      display: flex; align-items: center; gap: 4px; padding: 10px 14px;
    }
    .ai-dot { width:6px; height:6px; border-radius:50%; background:#C9A84C; animation: ai-bounce 1.2s infinite ease-in-out; }
    .ai-dot:nth-child(2) { animation-delay: 0.20s; }
    .ai-dot:nth-child(3) { animation-delay: 0.40s; }

    @keyframes ai-bounce {
      0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
      40%         { transform: scale(1.0); opacity: 1; }
    }
    @keyframes ai-pop {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Fila de input */
    #ai-input-row {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 12px 12px;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    #ai-input {
      flex: 1; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.10); border-radius: 8px;
      padding: 7px 10px; font-size: 0.80rem; color: #f0ebe0;
      outline: none; transition: border-color 0.15s; font-family: inherit;
    }
    #ai-input::placeholder { color: rgba(255,255,255,0.28); }
    #ai-input:focus { border-color: rgba(201,168,76,0.55); }
    #ai-input:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Botón micrófono */
    #ai-mic {
      flex-shrink: 0; width: 34px; height: 34px; border-radius: 8px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.50);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.14s, border-color 0.14s, color 0.14s;
      position: relative;
    }
    #ai-mic:hover { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.80); }
    #ai-mic.is-listening {
      background: rgba(201,168,76,0.15);
      border-color: #C9A84C;
      color: #C9A84C;
    }
    /* Pulso dorado mientras escucha */
    #ai-mic.is-listening::before {
      content: '';
      position: absolute; inset: -5px;
      border-radius: 13px;
      border: 2px solid #C9A84C;
      animation: mic-pulse 1.1s ease-in-out infinite;
    }
    @keyframes mic-pulse {
      0%,100% { opacity: 0.85; transform: scale(1);    }
      50%      { opacity: 0.15; transform: scale(1.22); }
    }

    /* Botón enviar */
    #ai-send {
      flex-shrink: 0; width: 34px; height: 34px; border-radius: 8px;
      background: #C9A84C; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.14s, transform 0.12s, opacity 0.14s;
    }
    #ai-send:hover   { background: #dbb95a; }
    #ai-send:active  { transform: scale(0.93); }
    #ai-send:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Barra de modo asesoramiento */
    #ai-advice-bar {
      display: flex; align-items: center; gap: 7px;
      padding: 5px 12px 5px 10px;
      background: rgba(201,168,76,0.10);
      border-bottom: 1px solid rgba(201,168,76,0.18);
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: #C9A84C;
      overflow: hidden; max-height: 32px;
      transition: opacity 0.2s ease, max-height 0.22s ease,
                  padding 0.22s ease, border-width 0.22s ease;
    }
    #ai-advice-bar.is-hidden {
      opacity: 0; max-height: 0;
      padding-top: 0; padding-bottom: 0; border-bottom-width: 0;
    }
    .ai-advice-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #C9A84C; flex-shrink: 0;
      animation: adv-pulse 1.6s ease-in-out infinite;
    }
    @keyframes adv-pulse {
      0%,100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.4; transform: scale(0.72); }
    }
  `;
  document.head.appendChild(style);

  // ── FAB ─────────────────────────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.id = 'ai-fab';
  fab.setAttribute('aria-label', 'Abrir asistente');
  fab.innerHTML = SVG_CHAT;
  document.body.appendChild(fab);

  // ── Panel ────────────────────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'ai-widget';
  widget.setAttribute('role', 'dialog');
  widget.setAttribute('aria-label', 'Asistente TEANMUR');
  widget.innerHTML = `
    <div id="ai-widget-header">
      <span>Asistente TEANMUR</span>
      <div id="ai-header-btns">
        <button type="button" id="ai-handsfree" aria-label="Manos libres">HF</button>
        <button type="button" id="ai-mute" aria-label="Silenciar voz">${SVG_VOLUME}</button>
        <button type="button" id="ai-close" aria-label="Cerrar">✕</button>
      </div>
    </div>
    <div id="ai-advice-bar" class="is-hidden">
      <span class="ai-advice-dot"></span>Modo asesoramiento
    </div>
    <div id="ai-messages"></div>
    <div id="ai-input-row">
      <input id="ai-input" type="text" placeholder="¿En qué puedo ayudarte?" autocomplete="off" maxlength="200">
      <button id="ai-mic"  aria-label="Hablar">${SVG_MIC}</button>
      <button id="ai-send" aria-label="Enviar">${SVG_SEND}</button>
    </div>
  `;
  document.body.appendChild(widget);

  // ── Overlay resultado asesoramiento ───────────────────────────────────────────
  const adviceResultOverlay = document.createElement('div');
  adviceResultOverlay.className = 'advice-overlay';
  adviceResultOverlay.setAttribute('role', 'dialog');
  adviceResultOverlay.setAttribute('aria-modal', 'true');
  adviceResultOverlay.setAttribute('aria-label', 'Resultado del asesoramiento');
  adviceResultOverlay.innerHTML = `
    <div class="advice-panel">
      <div class="advice-panel__accent"></div>
      <button class="advice-panel__close" aria-label="Cerrar">✕</button>
      <div class="advice-panel__head">
        <div class="advice-panel__eyebrow">Tu asesoramiento</div>
        <div class="advice-panel__title">Aquí tienes tu recomendación</div>
      </div>
      <div class="advice-summary"></div>
      <div class="advice-result-highlight">
        <div class="advice-result-highlight__number"></div>
        <div class="advice-result-highlight__label">litros necesarios</div>
      </div>
      <div class="advice-panel__ctas">
        <a class="advice-cta-wa" href="https://wa.me/34968967450" target="_blank" rel="noopener">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.105.547 4.082 1.503 5.801L0 24l6.388-1.675C8.044 23.225 9.978 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894c-1.85 0-3.569-.498-5.053-1.369l-.363-.214-3.76.987.985-3.668-.235-.374C2.679 15.59 2.106 13.851 2.106 12 2.106 6.561 6.561 2.106 12 2.106c5.439 0 9.894 4.455 9.894 9.894 0 5.44-4.455 9.894-9.894 9.894z"/></svg>
          Pedir presupuesto por WhatsApp
        </a>
        <button class="advice-cta-form">
          ✉ Quiero que me contactéis
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(adviceResultOverlay);

  // ── Overlay formulario de contacto ────────────────────────────────────────────
  const adviceFormOverlay = document.createElement('div');
  adviceFormOverlay.className = 'advice-overlay';
  adviceFormOverlay.setAttribute('role', 'dialog');
  adviceFormOverlay.setAttribute('aria-modal', 'true');
  adviceFormOverlay.setAttribute('aria-label', 'Solicitar contacto');
  adviceFormOverlay.innerHTML = `
    <div class="advice-panel advice-form-panel">
      <div class="advice-panel__accent"></div>
      <button class="advice-panel__close" aria-label="Cerrar">✕</button>
      <div class="advice-panel__head">
        <div class="advice-panel__eyebrow">Solicitar contacto</div>
        <div class="advice-panel__title">Te llamamos nosotros</div>
      </div>
      <div class="advice-form-body">
        <div class="advice-form-field">
          <label class="advice-form-label" for="af-nombre">Nombre</label>
          <input class="advice-form-input" id="af-nombre" type="text" placeholder="Tu nombre" autocomplete="name">
        </div>
        <div class="advice-form-field">
          <label class="advice-form-label" for="af-telefono">Teléfono</label>
          <input class="advice-form-input" id="af-telefono" type="tel" placeholder="612 345 678" autocomplete="tel">
        </div>
        <div class="advice-form-field">
          <label class="advice-form-label" for="af-email">Email (opcional)</label>
          <input class="advice-form-input" id="af-email" type="email" placeholder="tu@email.com" autocomplete="email">
        </div>
      </div>
      <button class="advice-form-submit" id="af-submit">Enviar solicitud</button>
      <div class="advice-form-ok" id="af-ok">
        ✅ ¡Recibido! Nos pondremos en contacto contigo en breve.
      </div>
    </div>
  `;
  document.body.appendChild(adviceFormOverlay);

  // ── Referencias DOM ──────────────────────────────────────────────────────────
  const messages = widget.querySelector('#ai-messages');
  const input    = widget.querySelector('#ai-input');
  const sendBtn  = widget.querySelector('#ai-send');
  const closeBtn = widget.querySelector('#ai-close');
  const micBtn       = widget.querySelector('#ai-mic');
  const muteBtn      = widget.querySelector('#ai-mute');
  const handsFreeBtn = widget.querySelector('#ai-handsfree');

  let voiceUiWarningsShown = false;

  function addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `ai-msg ai-msg--${type}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  let isMuted = false;
  let audioEl = null;
  let currentAudioUrl = null;
  let isAssistantSpeaking = false;
  let handsFreeMode = false;
  /** Retardo TTS barge-in (desactivado: el mic captaba el propio audio y reabría el panel). */
  let ttsBargeInTimer = null;
  /** Anti-eco: ignorar transcripciones casi iguales al último TTS reciente (altavoz → micrófono). */
  let lastTtsPlayedAt = 0;
  let lastTtsPlayedText = '';

  function cleanupAudio() {
    if (ttsBargeInTimer != null) {
      clearTimeout(ttsBargeInTimer);
      ttsBargeInTimer = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* */
      }
    }
    if (audioEl) {
      audioEl.onended = null;
      audioEl.onerror = null;
      audioEl.onplaying = null;
      audioEl.pause();
      audioEl = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    isAssistantSpeaking = false;
  }

  /** Corta el TTS al instante (interrupción por voz o mic). */
  function interruptAssistantAudio() {
    cleanupAudio();
    updateVoiceStateUI();
  }

  function ensureSpeechVoicesLoaded() {
    return new Promise((resolve) => {
      const syn = window.speechSynthesis;
      if (!syn) {
        resolve();
        return;
      }
      if (syn.getVoices().length > 0) {
        resolve();
        return;
      }
      const onVoices = () => {
        syn.removeEventListener('voiceschanged', onVoices);
        resolve();
      };
      syn.addEventListener('voiceschanged', onVoices);
      setTimeout(() => {
        syn.removeEventListener('voiceschanged', onVoices);
        resolve();
      }, 2000);
    });
  }

  function pickSpeechVoice(locale) {
    const syn = window.speechSynthesis;
    if (!syn) return null;
    const voices = syn.getVoices();
    if (!voices.length) return null;
    const pick = (fn) => voices.find(fn) || null;

    if (locale === 'es') {
      return (
        pick(
          (v) =>
            /^es[-_]es\b/i.test(v.lang) ||
            /\b(españa|spain|castellano)\b/i.test(`${v.name} ${v.lang}`),
        ) || pick((v) => /^es\b/i.test(v.lang)) || pick((v) => /^es-/i.test(v.lang))
      );
    }
    if (locale === 'en') {
      return pick((v) => /^en[-_]us\b/i.test(v.lang)) || pick((v) => /^en[-_]gb\b/i.test(v.lang)) || pick((v) => /^en\b/i.test(v.lang));
    }
    if (locale === 'fr') return pick((v) => /^fr\b/i.test(v.lang));
    if (locale === 'de') return pick((v) => /^de\b/i.test(v.lang));
    if (locale === 'it') return pick((v) => /^it\b/i.test(v.lang));
    if (locale === 'pt') return pick((v) => /^pt\b/i.test(v.lang));
    if (locale === 'ru') return pick((v) => /^ru\b/i.test(v.lang));
    if (locale === 'ja') return pick((v) => /^ja\b/i.test(v.lang));
    if (locale === 'zh') return pick((v) => /^zh\b/i.test(v.lang));
    if (locale === 'ar') return pick((v) => /^ar\b/i.test(v.lang));
    return pick((v) => /^es\b/i.test(v.lang));
  }

  const UTTER_LANG_BY_LOCALE = {
    es: 'es-ES',
    en: 'en-US',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    ru: 'ru-RU',
    ja: 'ja-JP',
    zh: 'zh-CN',
    ar: 'ar-SA',
  };

  function handsFreeAfterTts() {
    if (!handsFreeMode) return;
    if (hasNativeSR) {
      setTimeout(() => {
        if (handsFreeMode && !isAssistantSpeaking) void startListening();
      }, 280);
    } else {
      setTimeout(() => {
        if (handsFreeMode && !isAssistantSpeaking) void startFallbackRecording({ maxDurationMs: 12000 });
      }, 280);
    }
  }

  function speakWithBrowserTts(trimmed) {
    return new Promise((resolve) => {
      const syn = window.speechSynthesis;
      if (!syn) {
        resolve();
        return;
      }
      const loc = inferAssistantLocale(trimmed);
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.lang = UTTER_LANG_BY_LOCALE[loc] || 'es-ES';
      utter.rate = 1;
      utter.pitch = 1;
      const v = pickSpeechVoice(loc);
      if (v) utter.voice = v;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      syn.speak(utter);
    });
  }

  // ── SpeechRecognition (nativo) o grabación + Whisper (compatibilidad) ───────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const hasNativeSR = !!SR;
  let recognition  = null;
  let isListening  = false;

  let mediaStream = null;
  let mediaRecorder = null;
  let recordChunks = [];
  let mimeUsed = 'audio/webm';
  let isFallbackRecording = false;
  let fallbackAutoStopTimer = null;
  let fallbackVadRaf = null;
  let vadAudioCtx = null;

  function stopFallbackVad() {
    if (fallbackVadRaf != null) {
      cancelAnimationFrame(fallbackVadRaf);
      fallbackVadRaf = null;
    }
    if (vadAudioCtx) {
      try { void vadAudioCtx.close(); } catch { /* */ }
      vadAudioCtx = null;
    }
  }

  function cleanupMediaStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  function clearFallbackAutoTimer() {
    if (fallbackAutoStopTimer) {
      clearTimeout(fallbackAutoStopTimer);
      fallbackAutoStopTimer = null;
    }
  }

  function discardFallbackRecording() {
    clearFallbackAutoTimer();
    stopFallbackVad();
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      cleanupMediaStream();
      mediaRecorder = null;
      recordChunks = [];
      isFallbackRecording = false;
      updateVoiceStateUI();
      return;
    }
    mediaRecorder.onstop = () => {
      cleanupMediaStream();
      mediaRecorder = null;
      recordChunks = [];
      isFallbackRecording = false;
      updateVoiceStateUI();
    };
    try {
      mediaRecorder.stop();
    } catch {
      cleanupMediaStream();
      mediaRecorder = null;
      recordChunks = [];
      isFallbackRecording = false;
      updateVoiceStateUI();
    }
  }

  async function blobToBase64(blob) {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  /** HF + Whisper: corta la grabación cuando dejas de hablar un instante (sin pulsar enviar). */
  function startFallbackSilenceWatcher(stream) {
    stopFallbackVad();
    let heardVoice = false;
    let firstVoiceAt = 0;
    let lastVoiceAt = 0;
    const RMS_VOICE = 0.038;
    const SILENCE_MS = 850;
    const MIN_VOICE_MS = 550;

    try {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx) return;
      vadAudioCtx = new ACtx();
      void vadAudioCtx.resume?.().catch(() => {});
      const src = vadAudioCtx.createMediaStreamSource(stream);
      const analyser = vadAudioCtx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (!isFallbackRecording || !mediaRecorder || mediaRecorder.state !== 'recording') {
          stopFallbackVad();
          return;
        }
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const n = (data[i] - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();

        if (rms >= RMS_VOICE) {
          if (!heardVoice) {
            heardVoice = true;
            firstVoiceAt = now;
          }
          lastVoiceAt = now;
        } else if (
          heardVoice &&
          now - firstVoiceAt >= MIN_VOICE_MS &&
          now - lastVoiceAt >= SILENCE_MS
        ) {
          stopFallbackVad();
          clearFallbackAutoTimer();
          void finalizeFallbackRecordingTranscribe();
          return;
        }
        fallbackVadRaf = requestAnimationFrame(tick);
      };
      fallbackVadRaf = requestAnimationFrame(tick);
    } catch (e) {
      console.warn('[vad] no disponible, solo límite de tiempo:', e);
    }
  }

  async function finalizeFallbackRecordingTranscribe() {
    clearFallbackAutoTimer();
    stopFallbackVad();
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      cleanupMediaStream();
      mediaRecorder = null;
      recordChunks = [];
      isFallbackRecording = false;
      updateVoiceStateUI();
      return;
    }

    mediaRecorder.onstop = async () => {
      cleanupMediaStream();
      const blob = new Blob(recordChunks, { type: mimeUsed });
      recordChunks = [];
      mediaRecorder = null;
      isFallbackRecording = false;
      updateVoiceStateUI();
      micBtn.setAttribute('aria-label', 'Hablar');

      if (blob.size < 200) {
        addMessage('No se oyó nada en la grabación. Vuelve a intentarlo.', 'bot');
        if (handsFreeMode && !hasNativeSR) void startFallbackRecording({ maxDurationMs: 12000 });
        return;
      }

      try {
        const audioBase64 = await blobToBase64(blob);
        let res;
        try {
          res = await fetch(PROXY_TRANSCRIBE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType: blob.type || mimeUsed }),
          });
        } catch (netErr) {
          console.warn('[stt] red / proxy:', netErr);
          addMessage(
            'No hay conexión con el proxy de IA (' + AI_PROXY_ORIGIN + '). Deja el servidor web como está y en otra terminal ejecuta: npm run proxy — o usa npm run dev:all (web + proxy).',
            'bot'
          );
          if (handsFreeMode && !hasNativeSR) void startFallbackRecording({ maxDurationMs: 12000 });
          return;
        }

        const raw = await res.text();
        if (!res.ok) {
          let detail = raw.slice(0, 200);
          try {
            const j = JSON.parse(raw);
            if (j && j.error != null) {
              detail = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
            }
          } catch { /* texto no JSON */ }
          console.warn('[stt] HTTP', res.status, PROXY_TRANSCRIBE_URL, detail);
          if (res.status === 404 && /cannot post|\/api\/transcribe/i.test(detail)) {
            addMessage(
              'El proxy de IA no reconoce /api/transcribe (404). Suele ser un proceso viejo: cierra todas las ventanas de `node server/aiProxy.js` y vuelve a ejecutar npm run proxy. La URL usada es ' + PROXY_TRANSCRIBE_URL + '.',
              'bot'
            );
          } else {
            addMessage(`Error al transcribir (${res.status}): ${detail}`, 'bot');
          }
          if (handsFreeMode && !hasNativeSR) void startFallbackRecording({ maxDurationMs: 12000 });
          return;
        }

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          addMessage('Respuesta inválida del servidor de transcripción.', 'bot');
          if (handsFreeMode && !hasNativeSR) void startFallbackRecording({ maxDurationMs: 12000 });
          return;
        }

        const text = typeof data.text === 'string' ? data.text.trim() : '';
        const textAlt =
          typeof data.transcription === 'string' ? data.transcription.trim() : '';
        const transcribed = text || textAlt;
        if (transcribed) {
          input.value = transcribed;
          handleSend();
        } else {
          addMessage(
            blob.size >= 4000
              ? 'La transcripción ha salido vacía. Prueba a decir una frase un poco más larga y clara, por ejemplo: «Abre muestras de color».'
              : 'No he podido entender el audio. Habla un poco más alto o acerca el micrófono.',
            'bot'
          );
          if (handsFreeMode && !hasNativeSR) void startFallbackRecording({ maxDurationMs: 12000 });
        }
      } catch (err) {
        console.warn('[stt]', err);
        const errTxt = err && typeof err.message === 'string' && err.message
          ? err.message
          : (typeof err === 'string' ? err : (() => { try { return JSON.stringify(err); } catch { return 'Error desconocido'; } })());
        addMessage(`Error al transcribir: ${errTxt}`, 'bot');
        if (handsFreeMode && !hasNativeSR) void startFallbackRecording({ maxDurationMs: 12000 });
      }
    };

    try {
      mediaRecorder.stop();
    } catch {
      cleanupMediaStream();
      mediaRecorder = null;
      recordChunks = [];
      isFallbackRecording = false;
      updateVoiceStateUI();
    }
  }

  async function startFallbackRecording({ maxDurationMs } = {}) {
    if (isAssistantSpeaking) interruptAssistantAudio();
    if (isFallbackRecording) return;
    if (!window.isSecureContext) {
      addMessage('Este origen no es seguro para usar micrófono.', 'bot');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      addMessage('No hay acceso al micrófono en este navegador.', 'bot');
      return;
    }

    await logVoiceEnvironment('grabación compatibilidad (sin SpeechRecognition nativo)');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream = stream;
      recordChunks = [];
      mimeUsed = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      mediaRecorder = mimeUsed
        ? new MediaRecorder(stream, { mimeType: mimeUsed })
        : new MediaRecorder(stream);
      if (!mimeUsed) mimeUsed = mediaRecorder.mimeType || 'audio/webm';

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) recordChunks.push(e.data);
      };

      mediaRecorder.start(250);
      isFallbackRecording = true;
      updateVoiceStateUI();

      if (typeof maxDurationMs === 'number' && maxDurationMs > 0) {
        micBtn.setAttribute('aria-label', 'Manos libres: habla; se envía al dejar de hablar');
        startFallbackSilenceWatcher(stream);
        fallbackAutoStopTimer = setTimeout(() => {
          fallbackAutoStopTimer = null;
          stopFallbackVad();
          void finalizeFallbackRecordingTranscribe();
        }, maxDurationMs);
      } else {
        micBtn.setAttribute('aria-label', 'Grabando… pulsa de nuevo para enviar');
      }
    } catch (err) {
      console.warn('[mic-fallback] getUserMedia:', err);
      addMessage('No se pudo acceder al micrófono (permiso denegado o dispositivo no disponible).', 'bot');
      cleanupMediaStream();
      mediaRecorder = null;
      recordChunks = [];
      isFallbackRecording = false;
      updateVoiceStateUI();
    }
  }

  async function logVoiceEnvironment(note = '') {
    if (note) console.log('[voz] contexto:', note);
    console.log('[voz] origin:', window.location.origin);
    console.log('[voz] isSecureContext:', window.isSecureContext);
    console.log('[voz] userAgent:', navigator.userAgent);
    console.log('[voz] SpeechRecognition disponible:', !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    console.log('[voz] mediaDevices disponible:', !!navigator.mediaDevices);
    console.log('[voz] getUserMedia disponible:', !!navigator.mediaDevices?.getUserMedia);
    try {
      const pm = await navigator.permissions?.query({ name: 'microphone' });
      if (pm) console.log('[voz] permiso microphone:', pm.state);
    } catch (err) {
      console.log('[voz] permiso microphone: query no disponible o no soportada', err?.message ?? err);
    }
  }

  function updateVoiceStateUI() {
    micBtn.classList.toggle(
      'is-listening',
      isListening || (isFallbackRecording && !isAssistantSpeaking)
    );
    micBtn.classList.toggle('is-speaking', isAssistantSpeaking);
    micBtn.setAttribute(
      'aria-label',
      isAssistantSpeaking
        ? 'El asistente está hablando'
        : (isListening ? 'Escuchando…' : (isFallbackRecording ? 'Grabando…' : 'Hablar'))
    );
  }

  function _setListeningState(active) {
    isListening = active;
    updateVoiceStateUI();
  }

  async function startListening() {
    if (!recognition || isListening) return;
    if (isAssistantSpeaking) interruptAssistantAudio();

    await logVoiceEnvironment('antes de recognition.start()');

    _setListeningState(true);
    try {
      recognition.start();
    } catch (err) {
      console.warn('[mic] no se pudo iniciar:', err);
      _setListeningState(false);
    }
  }

  function stopListening() {
    if (!recognition || !isListening) return;
    _setListeningState(false);
    try { recognition.stop(); } catch { /* ya parado */ }
  }

  async function speak(text) {
    if (isMuted || !text?.trim()) return;

    try {
      if (recognition && isListening) {
        stopListening();
      }
      if (isFallbackRecording) {
        discardFallbackRecording();
      }

      cleanupAudio();
      isAssistantSpeaking = true;
      updateVoiceStateUI();

      const trimmed = String(text ?? '').trim();
      const useOpenAi = typeof window !== 'undefined' && window.TEANMUR_USE_OPENAI_TTS === true;
      const canBrowser = typeof window !== 'undefined' && window.speechSynthesis;

      if (!useOpenAi && canBrowser) {
        await ensureSpeechVoicesLoaded();
        await speakWithBrowserTts(trimmed);
        lastTtsPlayedText = trimmed;
        lastTtsPlayedAt = Date.now();
        isAssistantSpeaking = false;
        updateVoiceStateUI();
        handsFreeAfterTts();
        return;
      }

      const res = await fetch(PROXY_TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          voice: TTS_VOICE,
          model: TTS_MODEL,
          speed: TTS_SPEED,
          instructions: TTS_INSTRUCTIONS,
        }),
      });

      if (!res.ok) {
        throw new Error(`TTS HTTP ${res.status}`);
      }

      const blob = await res.blob();
      currentAudioUrl = URL.createObjectURL(blob);
      audioEl = new Audio(currentAudioUrl);

      audioEl.onended = () => {
        cleanupAudio();
        updateVoiceStateUI();
        handsFreeAfterTts();
      };

      audioEl.onerror = () => {
        cleanupAudio();
        updateVoiceStateUI();
        handsFreeAfterTts();
      };

      await audioEl.play();
      lastTtsPlayedText = trimmed;
      lastTtsPlayedAt = Date.now();
    } catch (err) {
      console.warn('[tts] error:', err);
      cleanupAudio();
      updateVoiceStateUI();
      if (handsFreeMode) {
        if (hasNativeSR) void startListening();
        else void startFallbackRecording({ maxDurationMs: 12000 });
      }
    }
  }

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.classList.toggle('is-muted', isMuted);
    muteBtn.innerHTML = isMuted ? SVG_VOLUME_OFF : SVG_VOLUME;
    muteBtn.setAttribute('aria-label', isMuted ? 'Activar voz' : 'Silenciar voz');
    if (isMuted) {
      cleanupAudio();
      updateVoiceStateUI();
    }
  });

  if (!SR) {
    void logVoiceEnvironment('sin SpeechRecognition nativo — modo grabación + servidor (Whisper)');
  } else {
    recognition = new SR();
    recognition.lang            = LANG_RECOGNITION;
    recognition.continuous      = true;
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[mic] escuchando...');
    };

    recognition.onresult = (e) => {
      if (isAssistantSpeaking) interruptAssistantAudio();
      const lastIdx = e.results.length - 1;
      const transcript = e.results[lastIdx]?.[0]?.transcript ?? '';
      console.log('[mic] resultado:', transcript);
      _setListeningState(false);
      if (transcript) {
        input.value = transcript;
        handleSend();
      }
    };

    recognition.onerror = (e) => {
      console.warn('[mic] error:', e.error);
      _setListeningState(false);
      let userMsg = 'No se pudo iniciar la voz en este navegador.';
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        userMsg = 'Chrome tiene bloqueado el micrófono para este origen.';
      } else if (e.error === 'audio-capture') {
        userMsg = 'No se detecta micrófono disponible.';
      } else if (e.error === 'network') {
        userMsg = 'El reconocimiento de voz ha fallado por red o servicio.';
      }
      addMessage(userMsg, 'bot');
    };

    recognition.onend = () => {
      const shouldRestartHF = handsFreeMode && !isAssistantSpeaking && isListening;
      if (isListening) _setListeningState(false);
      if (shouldRestartHF) {
        setTimeout(() => {
          if (handsFreeMode && !isAssistantSpeaking) void startListening();
        }, 250);
      }
    };
  }

  micBtn.addEventListener('click', () => {
    if (isAssistantSpeaking) interruptAssistantAudio();
    if (hasNativeSR) {
      isListening ? stopListening() : void startListening();
      return;
    }
    if (isFallbackRecording) void finalizeFallbackRecordingTranscribe();
    else void startFallbackRecording({});
  });

  handsFreeBtn.addEventListener('click', () => {
    handsFreeMode = !handsFreeMode;
    handsFreeBtn.classList.toggle('is-on', handsFreeMode);
    if (hasNativeSR) {
      if (handsFreeMode) {
        void startListening();
        addMessage('Manos libres: ya estoy escuchando.', 'bot');
      } else stopListening();
      return;
    }
    if (handsFreeMode) {
      void startFallbackRecording({ maxDurationMs: 12000 });
      addMessage('Manos libres: habla; al callar un momento envío solo (sin pulsar enviar).', 'bot');
    } else {
      discardFallbackRecording();
    }
  });

  // ── Memoria conversacional ────────────────────────────────────────────────────
  const MAX_HISTORY        = 8;
  const conversationHistory = [];
  /** Última sección que el asistente abrió (para «ábrelo», «vale, eso»). */
  let lastOpenedSectionId = null;
  /** Si la última apertura fue un ítem del hub (pros/part), su id estable. */
  let lastOpenedHubDetailSlug = null;

  function historyPush(role, content) {
    conversationHistory.push({ role, content });
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory.splice(0, conversationHistory.length - MAX_HISTORY);
    }
  }

  const VALID_INTENTS = ['open_section', 'open_page', 'close_panel', 'close_all', 'unknown'];
  const VALID_SECTION_IDS = ['who', 'pros', 'part', 'news', 'map'];

  function foldText(s) {
    return String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Normaliza para comparar eco TTS ↔ transcripción (quita ¡ ? y puntuación final). */
  function stripForEchoCompare(s) {
    return foldText(s).replace(/^[¡¿\s]+/g, '').replace(/[.!?,;:…]+$/g, '').trim();
  }

  /** Si el JSON no trae intent válido pero el texto del bot es de cierre (solo si el usuario pidió cierre). */
  function inferCloseIntentFromReply(reply, userMsg = '') {
    if (userMsg && !userMessageAllowsCloseInferenceFromAssistantReply(userMsg)) return null;
    const t = foldText(reply || '');
    if (!t) return null;
    if (/limpia la pantalla|limpio la pantalla|cierra todo|cierro todo|te lo cierro todo|quita todo|cerrar todo|clear(ing)?\s+the\s+screen|close\s+everything/i.test(t)) return 'close_all';
    if (/cierro eso|cerramos|cierre eso|cierra eso|vale[,.]*\s*te lo cierro|i'?ll\s+close\s+that|closing\s+that/i.test(t)) return 'close_panel';
    return null;
  }

  /** Respuesta del proxy: intent, sectionId, reply, detailSlug (hub pros/part), activeStoreId (map). */
  function normalizeApiChatResponse(raw, userMessageForHub = '') {
    const panelOpenHint =
      typeof sectionPanel.getOpenSectionId === 'function' ? sectionPanel.getOpenSectionId() : null;
    const data = raw?.data && typeof raw.data === 'object' ? { ...raw, ...raw.data } : (raw || {});

    let intent = typeof data.intent === 'string'
      ? data.intent.replace(/\uFEFF/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_')
      : '';
    if (intent === 'close' || intent === 'cerrar' || intent === 'cerrar_panel') intent = 'close_panel';
    if (intent === 'closeall' || intent === 'cerrar_todo') intent = 'close_all';
    if (intent === 'openpage' || intent === 'reset_page' || intent === 'pagina_principal') intent = 'open_page';

    let rawSid = data.sectionId ?? data.section_id;
    let sectionId = null;
    if (rawSid != null && String(rawSid).trim() !== '') {
      sectionId = String(rawSid).trim().toLowerCase();
      if (!VALID_SECTION_IDS.includes(sectionId)) sectionId = null;
    }

    let reply = typeof data.reply === 'string' ? data.reply.trim() : '';

    if (!VALID_INTENTS.includes(intent)) {
      const c = inferCloseIntentFromReply(reply, userMessageForHub);
      if (c) intent = c;
    }
    if (!VALID_INTENTS.includes(intent)) {
      intent = sectionId ? 'open_section' : 'unknown';
    }

    let isClose = intent === 'close_panel' || intent === 'close_all';

    if (!isClose && intent === 'open_section' && !sectionId) {
      sectionId =
        inferSectionFromUserMessage(userMessageForHub) || inferSectionFromReply(reply);
    }
    if (!isClose && intent === 'unknown' && !sectionId) {
      const c = inferCloseIntentFromReply(reply, userMessageForHub);
      if (c) {
        intent = c;
        isClose = true;
      } else {
        const g =
          inferSectionFromUserMessage(userMessageForHub) || inferSectionFromReply(reply);
        if (g) {
          intent = 'open_section';
          sectionId = g;
        }
      }
    }

    let rawDetail = data.detailSlug ?? data.detail_slug ?? data.hubOptionId;
    let detailSlug = null;
    if (rawDetail != null && String(rawDetail).trim() !== '' && sectionId) {
      const ds = String(rawDetail).trim().toLowerCase();
      if (isAllowedHubSlug(sectionId, ds)) detailSlug = ds;
    }

    if (userMessageForHub && (sectionId === 'pros' || sectionId === 'part')) {
      if (!detailSlug) {
        const inf = inferHubDetailFromUserMessage(userMessageForHub, sectionId, panelOpenHint);
        if (inf.detailSlug && isAllowedHubSlug(sectionId, inf.detailSlug)) {
          detailSlug = inf.detailSlug;
          intent = 'open_section';
          isClose = false;
        }
      }
    }

    let activeStoreId = null;
    const rawStore = data.activeStoreId ?? data.active_store_id ?? data.storeId;
    if (rawStore != null && String(rawStore).trim() !== '' && sectionId === 'map') {
      const st = String(rawStore).trim().toLowerCase();
      if (isAllowedMapStoreId(st)) activeStoreId = st;
    }
    if (sectionId === 'map' && userMessageForHub && !activeStoreId) {
      const g = inferMapStoreFromUserMessage(userMessageForHub);
      if (g && isAllowedMapStoreId(g)) {
        activeStoreId = g;
        intent = 'open_section';
        isClose = false;
      }
    }

    if (!sectionId && userMessageForHub) {
      const storeOnly = inferMapStoreFromUserMessage(userMessageForHub);
      if (storeOnly) {
        intent = 'open_section';
        sectionId = 'map';
        activeStoreId = storeOnly;
        isClose = false;
      } else {
        const hub = inferHubDetailFromUserMessage(userMessageForHub, null, panelOpenHint);
        if (hub.sectionId && hub.detailSlug) {
          intent = 'open_section';
          sectionId = hub.sectionId;
          detailSlug = hub.detailSlug;
          isClose = false;
        }
      }
    }

    // Hub Part/Pros inequívoco: gana sobre close_panel del modelo y sobre sectionId/detail erróneos.
    let hubNavApplied = false;
    if (userMessageForHub) {
      const hubNav = inferHubDetailFromUserMessage(userMessageForHub, null, panelOpenHint);
      if (hubNav.sectionId && hubNav.detailSlug) {
        intent = 'open_section';
        sectionId = hubNav.sectionId;
        detailSlug = hubNav.detailSlug;
        isClose = false;
        hubNavApplied = true;
      }
    }

    if (!hubNavApplied && userMessageForHub && inferPageResetFromUserMessage(userMessageForHub) === 'open_page') {
      intent = 'open_page';
      sectionId = null;
      detailSlug = null;
      activeStoreId = null;
      isClose = false;
    }

    if (intent === 'open_section' && !sectionId) intent = 'unknown';

    const robotic = /no (te )?he entendido|no he entendido|dec[ií]rlo de otra form|didn'?t (quite )?get|don'?t understand/i;
    if (!reply || (intent === 'unknown' && robotic.test(reply))) {
      reply =
        intent === 'close_panel'
          ? localizedFallbackReply('close_panel', userMessageForHub)
          : intent === 'close_all'
            ? localizedFallbackReply('close_all', userMessageForHub)
            : intent === 'open_page'
              ? localizedFallbackReply('open_page', userMessageForHub)
            : intent === 'open_section' && sectionId
              ? localizedFallbackReply('open_section', userMessageForHub)
              : localizedFallbackReply('unknown_prompt', userMessageForHub);
    }
    const rt = (reply || '').trim();
    if (
      intent === 'open_section' &&
      sectionId &&
      (hubNavApplied || detailSlug) &&
      (!rt ||
        /^c[oó]mo\s+ese\b/i.test(rt) ||
        /^eso\.?$/i.test(rt) ||
        /cierro\s+eso|cierra\s+eso/i.test(rt) ||
        transcriptReplyEchoesUser(reply, userMessageForHub) ||
        (/asesorami|demigo|muestra|bricolaje|entrega|garant|taller|medida/i.test(rt) && !/^(te|voy|abro|cierro|dime|no\s)/i.test(rt.trim())))
    ) {
      reply = localizedFallbackReply('open_section', userMessageForHub);
    }
    if (intent !== 'open_section' && intent !== 'open_page') {
      sectionId = null;
      detailSlug = null;
      activeStoreId = null;
    }
    if (intent === 'unknown' && userMessageForHub && !inferHubBackStepFromUserMessage(userMessageForHub)) {
      if (inferGreetingFromUserMessage(userMessageForHub)) {
        reply = assistantGreetingReplyForUserMessage(userMessageForHub);
      } else {
        const rf = foldText(reply || '');
        if (!rf || /limpia la pantalla|limpio la pantalla|cierra todo|cierro todo|cierro eso|cierra eso|clear(ing)?\s+the\s+screen|close\s+everything/i.test(rf)) {
          reply = assistantDidNotUnderstandReplyForLocale(userMessageForHub);
        }
      }
    }
    if (userMessageForHub && userMessageIsGreetingOnlyNoOtherIntent(userMessageForHub, panelOpenHint)) {
      intent = 'unknown';
      sectionId = null;
      detailSlug = null;
      activeStoreId = null;
      reply = assistantGreetingReplyForUserMessage(userMessageForHub);
    }
    if (userMessageForHub && inferHubBackStepFromUserMessage(userMessageForHub)) {
      intent = 'close_all';
      sectionId = null;
      detailSlug = null;
      activeStoreId = null;
      reply = localizedFallbackReply('hub_back', userMessageForHub);
    }
    return { intent, sectionId, reply, detailSlug, activeStoreId };
  }

  /** Follow-up sobre la última sección (reabrir). Incluye «como ese» tras ofrecer un servicio del hub. */
  const REOPEN_RE =
    /^(s[ií]|sí|vale|ok|ábrelo|abrelo|abre\s*lo|enséñamelo|enseñamelo|más\s*info|mas\s*info|ese|eso|c[oó]mo\s+ese|igual\s+que\s+ese|mué?strame|dime\s*más|dime\s*mas|eso\s*mismo|perfecto|venga|lo\s*mismo|de\s*nuevo)$/i;

  // ══════════════════════════════════════════════════════════════════════════════
  //  MODO COLORES
  //  El usuario pide sugerencias de familias de color según estancia o preferencia.
  //  Duración: 1-2 turnos. Reset automático. No toca adviceMode ni compatibilityMode.
  // ══════════════════════════════════════════════════════════════════════════════

  /** true solo durante el turno de aclaración "¿para qué estancia?" */
  let colorMode = false;

  /** Familias de color del catálogo TEANMUR */
  const COLOR_FAMILIES = {
    blancos: { label: 'Blancos y cremas',      desc: 'Amplían el espacio, ideales para estancias pequeñas o con poca luz' },
    grises:  { label: 'Grises y neutros',      desc: 'Modernos y versátiles, combinan con cualquier mobiliario' },
    calidos: { label: 'Tonos cálidos',         desc: 'Beige, arena, terracota. Acogedores y de ambiente natural' },
    frios:   { label: 'Tonos fríos',           desc: 'Azul, verde, lila. Frescos, relajantes y luminosos' },
    oscuros: { label: 'Oscuros y atrevidos',   desc: 'Verde botella, antracita, azul marino. Carácter y elegancia' },
  };

  /** Qué familias recomendar según estancia canónica */
  const ROOM_TO_FAMILIES = {
    'habitación':          ['blancos', 'calidos', 'frios'],
    'habitación pequeña':  ['blancos', 'calidos'],
    'salón':               ['grises', 'oscuros', 'calidos'],
    'baño':                ['frios', 'blancos'],
    'cocina':              ['blancos', 'grises'],
    'comedor':             ['calidos', 'oscuros', 'grises'],
    'pasillo':             ['blancos', 'grises'],
    'despacho':            ['grises', 'frios', 'blancos'],
  };

  /**
   * Detecta consultas sobre colores o tonos de pintura.
   */
  const COLOR_TRIGGER_RE = /\b(qu[eé]\s*(color(?:es)?|tono?s?)(\s+me\s*recomiendas?|\s*tienes?|\s*hay|\s+le?\s+ir[íi]a\s*bien|\s+queda\s*bien)?|color(?:es)?\s+para\b|(tono?|color)\s*(moderno|c[áa]lido|fr[íi]o|oscuro|claro|neutro|natural|elegante|atrevido|minimalista|acogedor|relajante|luminoso)|algo\s*(claro|oscuro|neutro|c[áa]lido|fr[íi]o|diferente)|necesito\s+(?:un\s+)?color|ayuda\s+con\s+(?:el\s+)?color|qu[eé]\s+colores?\s+recomiendas?|qu[eé]\s+pintura\s+(?:poner|usar|elegir)\b|(?:un\s+)?color\s+(?:para\s+(?:el|la|mi|un[ao]?)?\s*\w+|bonito|que\s+quede))\b/i;

  /**
   * Extrae la estancia canónica del texto.
   * Devuelve string|null.
   */
  function extractColorRoom(text) {
    const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // Caso especial: adjetivo "pequeño/a" añade matiz
    const isSmall = /peque[nñ][ao]|reducid[ao]|compacto|chic[ao]/.test(t);
    const ROOM_MAP = [
      [/\bhabitaci[oó]?n|dormitorio|cuarto\b/,      isSmall ? 'habitación pequeña' : 'habitación'],
      [/\bsal[oó]?n\b/,                              'salón'],
      [/\bba[nñ]o\b/,                               'baño'],
      [/\bcocina\b/,                                 'cocina'],
      [/\bcomedor\b/,                                'comedor'],
      [/\bpasillo\b/,                                'pasillo'],
      [/\bdespacho|oficina\b/,                       'despacho'],
      [/\bexterior|fachada\b/,                       'exterior'],
    ];
    for (const [re, label] of ROOM_MAP) {
      if (re.test(t)) return label;
    }
    return null;
  }

  /**
   * Extrae preferencia de color/estilo cuando no hay estancia concreta.
   * Devuelve array de ids de familias, o null.
   */
  function extractColorPreference(text) {
    const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/claro|luminoso|amplio|blanco|crema/.test(t))         return ['blancos', 'grises'];
    if (/oscuro|atrevido|drama|profundo|intenso/.test(t))     return ['oscuros'];
    if (/neutro|minimalista|sencillo|sobrio/.test(t))         return ['grises', 'blancos'];
    if (/c[áa]lido|acogedor|natural|tierra|terracota/.test(t)) return ['calidos'];
    if (/fr[íi]o|fresco|relaj|tranqui|azul|verde/.test(t))   return ['frios'];
    if (/moderno|actual|contempor|tendencia/.test(t))         return ['grises', 'oscuros'];
    if (/elegante|sofistic|lujo/.test(t))                     return ['oscuros', 'grises'];
    if (/acogedor|romantico|rom[áa]ntico|suave/.test(t))      return ['calidos', 'frios'];
    return null;
  }

  /**
   * Construye la respuesta con las familias sugeridas (máx 3).
   * @param {string|null} room     — estancia detectada
   * @param {string[]}    familyIds — ids de COLOR_FAMILIES a mostrar
   */
  function buildColorReply(room, familyIds) {
    const ids  = familyIds.slice(0, 3);
    const list = ids.map(id => {
      const f = COLOR_FAMILIES[id];
      return `• ${f.label}: ${f.desc}.`;
    }).join('\n');

    const intro = room
      ? `Para ${room} te recomiendo estas familias:\n\n${list}`
      : `Aquí van algunas familias de color que te pueden ir bien:\n\n${list}`;

    return `${intro}\n\n¿Quieres que te ayude a calcular cuánta pintura necesitas?`;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  MODO COMPATIBILIDAD
  //  El usuario pregunta si una pintura es compatible con una superficie.
  //  Responde corto, claro y técnico. No inicia el recomendador.
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * true cuando esperamos la respuesta a nuestra pregunta aclaratoria de compatibilidad.
   * Solo dura UN turno (se resetea tras responder).
   */
  let compatibilityMode = false;

  /** Material/superficie que estamos aclarando cuando compatibilityMode = true. */
  let compatPendingQuestion = null; // la pregunta que lanzamos al usuario

  /**
   * Detecta intención de consulta de compatibilidad de pintura.
   * Cubre: "¿sirve para azulejo?", "¿puedo pintar sobre yeso?", "¿necesita imprimación?", etc.
   */
  const COMPAT_TRIGGER_RE = /\b(sirve\s*(para|encima|sobre)|puedo\s*pintar\s*(sobre|encima\s*de|en\b)|vale\s*para\b|es\s*compatible\b|se\s*puede\s*(pintar|aplicar)\s*(sobre|encima|en\b)?|necesita?\s*(imprimaci[oó]n|imprim[ao]r|aparejo|fijador)|compatible\s*con\b|pintar\s*(sobre|encima\s*de)\b|puedo\s*aplicar|agarra\s*(en|sobre|al?)|pega\s*(en|sobre)|pinta\s*(sobre|en)\b)\b/i;

  /**
   * Tabla de materiales/superficies que el sistema reconoce localmente.
   * Devuelve el nombre canónico o null.
   */
  function extractCompatMaterial(text) {
    const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const MATERIAL_MAP = [
      [/\bazulejo\b|cer[áa]mica\b|gresite\b|\bgres\b/,            'azulejo'],
      [/\byeso\b|escayola\b/,                                      'yeso'],
      [/\bpladur\b|cart[oó]n[\s-]?yeso\b/,                        'pladur'],
      [/\bmadera\b|parquet\b|tarima\b/,                            'madera'],
      [/\bmetal\b|hierro\b|acero\b|aluminio\b|galvanizad/,         'metal'],
      [/\bfachada\b|exterior\b/,                                   'fachada exterior'],
      [/\bba[nñ]o\b/,                                              'baño'],
      [/\bcocina\b/,                                               'cocina'],
      [/\bpiscina\b/,                                              'piscina'],
      [/\bsuelo\b|pavimento\b|piso\b/,                             'suelo'],
      [/\bladrillo\b/,                                             'ladrillo'],
      [/\bcemento\b|hormig[oó]n\b/,                                'cemento'],
      [/\bhumedad\b|hume[cd]/,                                     'humedad'],
      [/\bpl[aá]stico\b|pvc\b/,                                    'plástico'],
      [/\bmadera\s+pintada|pared\s+pintada|sobre\s+pintura/,       'superficie ya pintada'],
      [/\bcal\b[^c]/,                                              'cal'],
    ];
    for (const [re, label] of MATERIAL_MAP) {
      if (re.test(t)) return label;
    }
    return null;
  }

  /**
   * Reglas locales de compatibilidad.
   * Devuelve { answer, confidence } o null si el material no está en la tabla.
   * @param {string|null} material
   */
  function getLocalCompatAnswer(material) {
    if (!material) return null;
    const RULES = {
      'azulejo':               'Sí se puede pintar. Aplica primero imprimación de adherencia; sin ella la pintura no agarra.',
      'yeso':                  'Sí. El yeso nuevo necesita un fijador o imprimación selladora antes de pintar.',
      'pladur':                'Sí, igual que el yeso: aplica primero una imprimación o fijador para sellar la placa.',
      'madera':                'Sí. Usa esmalte sintético o acrílico para cubrirla, o barniz/lasure si prefieres ver la veta.',
      'metal':                 'Sí, pero necesita imprimación anticorrosiva primero. Después aplica esmalte compatible para metal.',
      'fachada exterior':      'Sí, usando pintura específica para exterior, resistente al agua y a la intemperie.',
      'baño':                  'Sí. Usa pintura antihumedad o lavable de alta resistencia, diseñada para zonas húmedas.',
      'cocina':                'Sí. Lo más adecuado es una pintura lavable o antigrasa.',
      'piscina':               'Solo con pinturas especiales para piscinas: clorocaucho o epoxi. La pintura normal no vale.',
      'suelo':                 'Depende del material del suelo. ¿Es cemento, baldosa, madera o terrazo?',
      'ladrillo':              'Sí, con pintura para fachada o un sellador previo si el ladrillo es muy poroso.',
      'cemento':               'Sí. Si es nuevo o muy poroso aplica un fijador antes. Para suelos usa esmalte específico.',
      'humedad':               'Si hay humedad activa, NO se puede pintar encima directamente. Primero hay que tratar el foco.',
      'plástico':              'Depende del tipo. ¿Es PVC, interior o exterior? Normalmente requiere imprimación específica para plástico.',
      'superficie ya pintada': 'Sí, se puede repintar si la capa existente está en buen estado y bien adherida.',
      'cal':                   'Depende. Sobre cal antigua mal adherida conviene lijar o raspar antes; sobre cal firme se puede pintar.',
    };
    // "suelo" y "plástico" requieren aclaración → confidence low
    const lowConf = new Set(['suelo', 'plástico']);
    if (RULES[material]) {
      return { answer: RULES[material], confidence: lowConf.has(material) ? 'low' : 'high' };
    }
    return null;
  }

  /**
   * Llama a /api/compatibility cuando las reglas locales no bastan.
   */
  async function fetchCompatAnswer(userMessage, material) {
    try {
      const res = await fetch(PROXY_COMPAT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, material }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json(); // { answer, confidence, needsMore, question }
    } catch (err) {
      console.warn('[compat] servidor no disponible:', err.message);
      return { answer: null, confidence: 'low', needsMore: false, question: null };
    }
  }

  /**
   * Construye el mensaje de respuesta de compatibilidad para el chat.
   * Añade oferta de ir al recomendador si la pregunta está resuelta.
   */
  function buildCompatReply(answer, confidence) {
    let msg = answer ?? 'No tengo suficiente información para responder. ¿Sobre qué superficie es?';
    if (confidence === 'high') {
      msg += '\n\n¿Quieres que te ayude a calcular la cantidad que necesitas?';
    }
    return msg;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  MODO ASESORAMIENTO GUIADO
  //  Estado: adviceMode (bool) + adviceData (campos recogidos)
  // ══════════════════════════════════════════════════════════════════════════════

  /** true cuando el asistente está en flujo de asesoramiento paso a paso */
  let adviceMode = false;

  /**
   * Campos recogidos durante el asesoramiento.
   * null = aún no contestado / pendiente.
   * @type {{ what: string|null, sqm: number|null, surface: string|null, coats: number|null, finish: string|null }}
   */
  const adviceData = { what: null, sqm: null, surface: null, coats: null, finish: null };

  /**
   * Preguntas para cada campo. Solo se lanza la del primer campo null.
   * El orden define prioridad, no secuencia obligatoria.
   */
  const ADVICE_STEPS = [
    { key: 'what',    q: '¿Qué quieres pintar?' },
    { key: 'sqm',     q: '¿Cuántos m² tiene la superficie?' },
    { key: 'surface', q: '¿Cómo está la pared?' },
    { key: 'coats',   q: '¿Cuántas manos vas a dar?' },
    { key: 'finish',  q: '¿Qué acabado prefieres: mate, satinado o brillante?' },
  ];

  /**
   * Activa el asesoramiento cuando el usuario menciona cualquier intención de pintar.
   * Amplio a propósito: captura "quiero pintar una habitación de 35 metros" etc.
   */
  const ADVICE_TRIGGER_RE = /\b(asesoramiento|(necesito|quiero|voy\s+a|tengo\s+que|hay\s+que)\s+(pintar?|pintura)|(pintar?\s+(una?|el|la|mi|mi\s+))|(no\s*s[eé]\s*(qu[eé]|cu[aá]l)\s*pintura)|(cu[aá]nta\s*pintura)|(cu[aá]ntos?\s*(?:litros?|botes?))|(litros?\s*(necesito|hacen?\s*falta|comprar))|(qu[eé]\s*pintura\s*(comprar|elegir|usar|necesito))|(pintura\s*(comprar|necesito))|(ayuda\s*(para\s*)?pintar)|(pintura\s+para\s+\w))\b/i;

  /** Devuelve el primer campo sin respuesta, o null si el flujo está completo. */
  function nextAdviceStep() {
    return ADVICE_STEPS.find(s => adviceData[s.key] === null) ?? null;
  }

  /** True cuando todos los campos tienen valor. */
  function isAdviceComplete() {
    return ADVICE_STEPS.every(s => adviceData[s.key] !== null);
  }

  /** Reinicia el modo asesoramiento y borra todos los campos. */
  function resetAdviceMode() {
    adviceMode = false;
    for (const k of Object.keys(adviceData)) adviceData[k] = null;
    updateAdviceModeUI();
  }

  // ── Extracción local (rápida, sin red) ───────────────────────────────────────

  /** Normaliza texto: minúsculas + quita acentos. */
  function foldAdvice(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  /**
   * Extrae todos los campos que puede del texto del usuario sin llamar al servidor.
   * Devuelve un objeto parcial con solo los campos encontrados (el resto no aparece / undefined).
   */
  function extractFieldsLocally(text) {
    const t = foldAdvice(text);
    const found = {};

    // sqm — "35 metros", "unos 40 m2", "35m²", "35 metros cuadrados"
    const sqmM = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m(?:etros?(?:\s*cuadrados?)?|2|²)?)\b/);
    if (!sqmM) {
      // también "serán unos 40", "son unos 25" con número suelto
      const bareM = t.match(/\b(?:son|sera?n?|unos?|sobre|aproximadamente|mas\s+o\s+menos)?\s*(\d{2,4})\b/);
      if (bareM) { const n = parseInt(bareM[1], 10); if (n >= 5 && n <= 5000) found.sqm = n; }
    } else {
      const n = Math.round(parseFloat(sqmM[1].replace(',', '.')));
      if (n >= 1) found.sqm = n;
    }

    // coats — "dos manos", "2 manos", "una capa", "doble capa"
    const WORD_NUM = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, doble: 2, triple: 3 };
    const coatsM = t.match(/\b(una?|un|dos|tres|cuatro|doble|triple|\d)\s*(?:manos?|capas?)\b/);
    if (coatsM) {
      const w = coatsM[1];
      found.coats = WORD_NUM[w] ?? (parseInt(w, 10) || null);
    }

    // finish — con variantes de voz / typos
    if (/\bmat[eo]?\b|\bmatte\b|\bmad[eo]\b|\bmat[ei]/.test(t)) found.finish = 'mate';
    else if (/\bsatin/.test(t))                                    found.finish = 'satinado';
    else if (/\bbrill|briy/.test(t))                               found.finish = 'brillante';

    // surface — frases de buen estado vs. problemas
    if (/\b(bien|buena?|normal|ok|perfecta?|limpi[ao]|nueva?|sin\s+manchas?|recien?\s+revoc|revocada)\b/.test(t)) {
      found.surface = 'en buen estado';
    } else if (/\bmancha/.test(t)) {
      found.surface = 'con manchas';
    } else if (/\bdesconcha|pelad|descascar/.test(t)) {
      found.surface = 'desconchada';
    } else if (/\bhumeda?d|humed|moja/.test(t)) {
      found.surface = 'con humedad';
    } else if (/\bsucia|negra|tiz/.test(t)) {
      found.surface = 'sucia';
    }

    // what — habitaciones y espacios comunes
    const WHAT_MAP = [
      [/\bhabitaci[oó]?n|cuarto\b|dormitorio\b|habitaciones\b/, 'habitación'],
      [/\bsal[oó]?n\b|salones\b/, 'salón'],
      [/\bcocina\b/, 'cocina'],
      [/\bba[nñ]o\b/, 'baño'],
      [/\bfachada\b/, 'fachada exterior'],
      [/\bgaraj[e]?\b/, 'garaje'],
      [/\bdespacho\b|oficina\b/, 'despacho u oficina'],
      [/\bterraz[a]?\b/, 'terraza'],
      [/\bpasillo\b/, 'pasillo'],
      [/\bcomedor\b/, 'comedor'],
      [/\bexterior\b/, 'exterior'],
      [/\btrastero\b/, 'trastero'],
      [/\bpiso\b|apartamento\b|casa\b|vivienda\b|hogar\b/, 'vivienda'],
    ];
    for (const [re, label] of WHAT_MAP) {
      if (re.test(t)) { found.what = label; break; }
    }

    return found;
  }

  /**
   * Normaliza y sanea un valor antes de guardarlo en adviceData.
   * También corrige typos de voz frecuentes.
   */
  function normalizeAdviceValue(field, raw) {
    if (raw === null || raw === undefined) return null;
    const s   = String(raw).trim();
    if (!s || s === 'null') return null;
    const v   = foldAdvice(s);

    if (field === 'finish') {
      if (/^mat[eo]?$|matte|mad[eo]|mat[ei]|^mat$/.test(v)) return 'mate';
      if (/satin/.test(v))                                    return 'satinado';
      if (/brill|briy/.test(v))                              return 'brillante';
      // Si llegó del servidor ya normalizado
      if (['mate','satinado','brillante'].includes(v)) return v;
      return null; // valor de acabado inválido, volver a preguntar
    }
    if (field === 'surface') {
      if (/^(bien|buena?|normal|ok|perfecta?|limpi[ao]|nueva?|sin\s+manchas?|en\s+buen\s+estado)$/.test(v)) {
        return 'en buen estado';
      }
    }
    if (field === 'coats') {
      const WORDS = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, doble: 2, triple: 3 };
      if (WORDS[v] != null) return WORDS[v];
      const n = typeof raw === 'number' ? raw : parseFloat(v.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') ?? 'NaN');
      if (!isNaN(n) && n > 0) return Math.max(1, Math.round(n));
      return null;
    }
    if (field === 'sqm') {
      const n = typeof raw === 'number' ? raw : parseFloat(v.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') ?? 'NaN');
      if (!isNaN(n) && n > 0) return Math.max(1, Math.round(n));
      return null;
    }
    return s; // what y surface: devolver tal cual
  }

  /**
   * Llama al servidor y extrae TODOS los campos posibles del mensaje.
   * Devuelve { fields, ack } (fields puede tener nulls para lo que no encontró).
   * En caso de error de red devuelve campos todos null.
   */
  async function fetchAdviceExtraction(userMessage) {
    try {
      const res = await fetch(PROXY_ADVICE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json(); // { fields, ack }
    } catch (err) {
      console.warn('[advice] servidor no disponible, usando solo extracción local:', err.message);
      return { fields: { what: null, sqm: null, surface: null, coats: null, finish: null }, ack: '' };
    }
  }

  /**
   * Aplica los campos extraídos (local + servidor) a adviceData.
   * Solo sobreescribe campos que actualmente son null.
   * El servidor tiene prioridad sobre la extracción local si ambos encuentran algo.
   * @param {object} localFields  — resultado de extractFieldsLocally()
   * @param {object} serverFields — resultado de fetchAdviceExtraction().fields
   */
  function applyExtractedFields(localFields, serverFields) {
    const KEYS = ['what', 'sqm', 'surface', 'coats', 'finish'];
    for (const k of KEYS) {
      if (adviceData[k] !== null) continue; // ya tenemos valor, no sobreescribir
      // Prioridad: servidor → local
      const serverVal = serverFields?.[k] ?? null;
      const localVal  = localFields?.[k]  ?? null;
      const raw = serverVal ?? localVal;
      if (raw === null || raw === undefined) continue;
      const normalized = normalizeAdviceValue(k, raw);
      if (normalized !== null) {
        adviceData[k] = normalized;
        console.log(`[advice] campo '${k}' extraído:`, normalized);
      }
    }
    console.log('[advice] adviceData tras extracción:', { ...adviceData });
  }

  /**
   * Construye el texto final de recomendación limpio y natural.
   */
  function buildFinalBotMessage(snap, litros) {
    const what   = snap.what    ?? 'la superficie';
    const sqm    = snap.sqm     != null ? `${snap.sqm} m²`                           : null;
    const coats  = snap.coats   != null ? `${snap.coats} mano${snap.coats > 1 ? 's' : ''}` : null;
    const finish = snap.finish  ?? null;

    let desc = sqm ? `${what} de ${sqm}` : what;
    const extras = [coats, finish ? `acabado ${finish}` : null].filter(Boolean);
    if (extras.length) desc += `, con ${extras.join(' y ')}`;

    return `Para ${desc} necesitas aproximadamente ${litros} litro${litros !== 1 ? 's' : ''} de pintura.`;
  }

  /**
   * Muestra u oculta la pill "Modo asesoramiento" en el widget.
   * Se llama cada vez que adviceMode cambia.
   */
  function updateAdviceModeUI() {
    const bar = widget.querySelector('#ai-advice-bar');
    if (bar) bar.classList.toggle('is-hidden', !adviceMode);
  }

  // ── Overlay functions ─────────────────────────────────────────────────────────

  /** Construye filas de resumen a partir del snapshot de adviceData. */
  function buildAdviceSummaryRows(snap) {
    const FINISH_LABELS = { mate: 'Mate', satinado: 'Satinado', brillante: 'Brillante' };
    const rows = [
      { label: 'Qué se pinta',    value: snap.what ?? '—' },
      { label: 'Superficie',      value: snap.sqm   != null ? `${snap.sqm} m²` : '—' },
      { label: 'Estado de pared', value: snap.surface ?? '—' },
      { label: 'Manos',           value: snap.coats  != null ? `${snap.coats}` : '—' },
      { label: 'Acabado',         value: FINISH_LABELS[snap.finish] ?? (snap.finish ?? '—') },
    ];
    return rows.map(r => `
      <div class="advice-summary-row">
        <span class="advice-summary-row__label">${r.label}</span>
        <span class="advice-summary-row__value">${r.value}</span>
      </div>`).join('');
  }

  /** Construye el texto pre-rellenado para WhatsApp. */
  function buildWaMessage(snap, litros) {
    const lines = [
      '👋 Hola, acabo de usar el asesor de TEANMUR y me gustaría pedir presupuesto:',
      `• Qué pinto: ${snap.what ?? '—'}`,
      `• Superficie: ${snap.sqm != null ? snap.sqm + ' m²' : '—'}`,
      `• Estado pared: ${snap.surface ?? '—'}`,
      `• Manos: ${snap.coats ?? '—'}`,
      `• Acabado: ${snap.finish ?? '—'}`,
      `• Litros estimados: ${litros} L`,
      '¿Podéis asesorarme?',
    ];
    return lines.join('\n');
  }

  let _adviceResultPrevFocus = null;

  /**
   * Abre la pantalla de resultado con el snapshot de datos y los litros calculados.
   * @param {{ what, sqm, surface, coats, finish }} snap
   * @param {number} litros
   */
  function openAdviceResult(snap, litros) {
    // Rellenar resumen
    const summaryEl = adviceResultOverlay.querySelector('.advice-summary');
    summaryEl.innerHTML = buildAdviceSummaryRows(snap);

    // Resultado numérico
    adviceResultOverlay.querySelector('.advice-result-highlight__number').textContent = litros;

    // WhatsApp link
    const WA_NUMBER = '34600000000'; // ← sustituir por número real
    const waLink = adviceResultOverlay.querySelector('.advice-cta-wa');
    waLink.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildWaMessage(snap, litros))}`;

    _adviceResultPrevFocus = document.activeElement;
    adviceResultOverlay.classList.add('is-open');
    adviceResultOverlay.querySelector('.advice-panel__close').focus();
  }

  function closeAdviceResult() {
    adviceResultOverlay.classList.remove('is-open');
    _adviceResultPrevFocus?.focus();
  }

  let _adviceFormPrevFocus = null;
  let _adviceFormSnap      = null;

  function openAdviceForm(snap) {
    _adviceFormSnap = snap;
    // Reset del formulario
    adviceFormOverlay.querySelector('#af-nombre').value   = '';
    adviceFormOverlay.querySelector('#af-telefono').value = '';
    adviceFormOverlay.querySelector('#af-email').value    = '';
    adviceFormOverlay.querySelector('#af-submit').disabled = false;
    adviceFormOverlay.querySelector('#af-ok').classList.remove('is-visible');
    adviceFormOverlay.querySelector('.advice-form-body').style.display = '';
    adviceFormOverlay.querySelector('#af-submit').style.display = '';

    _adviceFormPrevFocus = document.activeElement;
    adviceFormOverlay.classList.add('is-open');
    adviceFormOverlay.querySelector('#af-nombre').focus();
  }

  function closeAdviceForm() {
    adviceFormOverlay.classList.remove('is-open');
    _adviceFormPrevFocus?.focus();
  }

  // Wiring result overlay
  adviceResultOverlay.querySelector('.advice-panel__close').addEventListener('click', closeAdviceResult);
  adviceResultOverlay.addEventListener('click', e => { if (e.target === adviceResultOverlay) closeAdviceResult(); });
  adviceResultOverlay.querySelector('.advice-cta-form').addEventListener('click', () => {
    closeAdviceResult();
    openAdviceForm({ ...adviceData });
  });

  // Wiring form overlay
  adviceFormOverlay.querySelector('.advice-panel__close').addEventListener('click', closeAdviceForm);
  adviceFormOverlay.addEventListener('click', e => { if (e.target === adviceFormOverlay) closeAdviceForm(); });

  adviceFormOverlay.querySelector('#af-submit').addEventListener('click', async () => {
    const submitBtn = adviceFormOverlay.querySelector('#af-submit');
    const nombre    = adviceFormOverlay.querySelector('#af-nombre').value.trim();
    const telefono  = adviceFormOverlay.querySelector('#af-telefono').value.trim();
    const email     = adviceFormOverlay.querySelector('#af-email').value.trim();
    if (!nombre || !telefono) {
      adviceFormOverlay.querySelector('#af-nombre').focus();
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';
    try {
      await fetch(`${AI_PROXY_ORIGIN}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, email, adviceSnap: _adviceFormSnap }),
      });
    } catch (_) { /* Fallo silencioso — el mensaje de confirmación se muestra igual */ }
    adviceFormOverlay.querySelector('.advice-form-body').style.display = 'none';
    submitBtn.style.display = 'none';
    adviceFormOverlay.querySelector('#af-ok').classList.add('is-visible');
  });

  // Escape cierra cualquier overlay de asesoramiento
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (adviceFormOverlay.classList.contains('is-open'))   closeAdviceForm();
    else if (adviceResultOverlay.classList.contains('is-open')) closeAdviceResult();
  });

  /**
   * Atajos cliente (rápidos). hub_back: «atrás» / volver — cierra panel, marcas, scroll y widget del asistente.
   * close_panel: cierra modal / panel. open_page: solo historia. assistant: cerrar el widget de chat.
   */
  function matchClientShortcut(raw) {
    const t0 = raw.trim();
    if (!t0) return null;
    if (inferPageResetFromUserMessage(t0) === 'open_page') return 'open_page';
    const t = foldText(t0);
    const compact = t.replace(/\s+/g, '');

    if (/\bcierra(r)?\s+(el\s+)?(asistente|chat|ayuda)\b/.test(t)) return 'assistant';
    if (/\b(adios|adiós|hasta luego|bye)\s*(asistente|chat)?\b/.test(t) && t.length < 42) return 'assistant';

    if (/cerrar?todo|cierra\s*todo|cerrar\s*todo|cerratodo|cierratodo/.test(compact)) return 'close_all';
    if (/\b(cierra|quita|limpia)\s+todo\b/.test(t)) return 'close_all';
    if (inferHubBackStepFromUserMessage(t0)) return 'hub_back';
    if (/\bcierro\s+eso\b/.test(t)) return 'close_panel';
    if (/^[!¡\s]*cierra(r)?[!?.\s]*$/i.test(t0.trim())) return 'close_panel';
    if (/\b(limpia|vac[ií]a)\s+(la\s*)?(pantalla|todo)\b/.test(t)) return 'close_all';
    if (/^\s*(quita\s+todo|limpia\s*todo)\s*\.?\s*$/i.test(t0)) return 'close_all';

    if (/\b(ci[eé]rralo|quita\s+eso|quitalo|fuera|esc[oó]ndelo|cierra\s+la\s+ventana|cerrar\s+la\s+ventana|cierra\s+el\s+panel)\b/.test(t)) return 'close_panel';
    if (/^(vale|ok|s[ií]|listo)?[\s,.]*(cierra|cerrar|ci[eé]rralo)\s*\.?\s*$/i.test(t)) return 'close_panel';
    if (/^(cierra|cerrar|ci[eé]rralo)(\s+(el\s+)?(panel|ventana|esto|todo))?\.?\s*$/i.test(t)) {
      if (/\btodo\b/.test(t)) return 'close_all';
      return 'close_panel';
    }
    if (/^(cierra|cerrar)\.?$/i.test(t)) return 'close_panel';

    if (/\b(cierra|cerrar|quita)\b/.test(t) && /\b(fuera|eso|ventana|panel|esto)\b/.test(t) && !/\btodo\b/.test(t)) return 'close_panel';

    return null;
  }

  function buildMessagesForApi() {
    const panelOpen = typeof sectionPanel.getOpenSectionId === 'function' ? sectionPanel.getOpenSectionId() : null;
    const extra =
      `\n\n[Contexto UI: panel_modal_abierto=${panelOpen || 'ninguno'}, ultima_seccion_sugerida=${lastOpenedSectionId || 'ninguno'}]`;
    return conversationHistory.map((m, i, arr) => {
      if (i === arr.length - 1 && m.role === 'user') {
        return { ...m, content: m.content + extra };
      }
      return m;
    });
  }

  async function executeOpenSection(sectionId, panelOpts = {}) {
    if (adviceMode) return;                                      // ← bloqueo durante asesoramiento
    const id = String(sectionId || '').trim().toLowerCase();
    if (!VALID_SECTION_IDS.includes(id)) return;
    lastOpenedSectionId = id;
    window.storyMarks?.closeMark?.();
    const openOpts = {
      detailSlug: panelOpts.detailSlug ?? null,
      activeStoreId: panelOpts.activeStoreId ?? null,
    };
    const ds = openOpts.detailSlug != null ? String(openOpts.detailSlug).trim().toLowerCase() : '';
    lastOpenedHubDetailSlug =
      (id === 'part' || id === 'pros') && ds && isAllowedHubSlug(id, ds) ? ds : null;
    if (openSectionSequenced) {
      try {
        await openSectionSequenced(id, openOpts);
      } catch (err) {
        console.warn('[aiWidget] secuencia apertura IA:', err);
        sectionPanel.open(id, openOpts);
      }
      return;
    }
    sectionPanel.open(id, openOpts);
  }

  function executeClosePanel() {
    sectionPanel.close();
  }

  function executeOpenPage() {
    sectionPanel.close();
    window.storyMarks?.closeMark?.();
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  function executeCloseAll() {
    sectionPanel.close();
    window.storyMarks?.closeMark?.();
    closeWidget();
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function showLoading() {
    const msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg--loading';
    msg.innerHTML = '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>';
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function setInputEnabled(enabled) {
    input.disabled   = !enabled;
    sendBtn.disabled = !enabled;
    if (micBtn.style.display !== 'none') micBtn.disabled = !enabled;
    if (handsFreeBtn.style.display !== 'none') handsFreeBtn.disabled = !enabled;
  }

  function openWidget() {
    widget.classList.add('is-open');
    input.focus();
    if (!messages.children.length) {
      addMessage('¡Hola! Pregúntame sobre el equipo, productos, novedades o cómo contactarnos.', 'bot');
    }
    if (!voiceUiWarningsShown) {
      voiceUiWarningsShown = true;
      if (!window.isSecureContext) {
        addMessage('Este origen no es seguro para usar micrófono.', 'bot');
      }
      if (!hasNativeSR) {
        addMessage(
          'HF: activa el botón dorado y habla; no hace falta enviar nada a mano: con voz nativa responde solo, con Whisper se envía al callar un momento. Sin HF: dos toques al mic. Proxy IA: ' + AI_PROXY_ORIGIN + ' (npm run proxy o npm run dev:all).',
          'bot'
        );
      }
    }
  }

  function closeWidget() {
    widget.classList.remove('is-open');
    stopListening();
    discardFallbackRecording();
    cleanupAudio();
    updateVoiceStateUI();
  }

  // ── Envío con historial conversacional ───────────────────────────────────────
  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    const echoA = stripForEchoCompare(text);
    if (lastTtsPlayedText && Date.now() - lastTtsPlayedAt < 4500) {
      const echoB = stripForEchoCompare(lastTtsPlayedText);
      if (echoA === echoB || (echoA.length >= 10 && echoB.includes(echoA)) || (echoB.length >= 10 && echoA.includes(echoB))) {
        return;
      }
    }

    interruptAssistantAudio();

    // ── MODO COLORES — bypass del flujo normal ───────────────────────────────

    // A. Turno de aclaración: el usuario responde "¿para qué estancia?"
    if (colorMode) {
      colorMode = false;
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';

      const room       = extractColorRoom(text);
      const preference = extractColorPreference(text);
      console.log('[color] aclaración → estancia:', room, '| preferencia:', preference);

      let familyIds;
      if (room && ROOM_TO_FAMILIES[room]) {
        familyIds = ROOM_TO_FAMILIES[room];
      } else if (preference) {
        familyIds = preference;
      } else {
        // Texto libre que no reconocemos → sugerir neutros como opción segura
        familyIds = ['grises', 'blancos', 'calidos'];
      }

      const reply = buildColorReply(room, familyIds);
      historyPush('assistant', reply);
      addMessage(reply, 'bot');
      void speak(reply);
      return;
    }

    // B. Detectar nueva consulta de colores (mutuamente excluyente con los otros modos)
    if (!adviceMode && !compatibilityMode && COLOR_TRIGGER_RE.test(text)) {
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';

      const room       = extractColorRoom(text);
      const preference = extractColorPreference(text);
      console.log('[color] trigger → estancia:', room, '| preferencia:', preference, '| texto:', text);

      // Caso especial: exterior → derivar a compatibilidad, no a colores
      if (room === 'exterior') {
        const reply = 'Para exterior lo importante no es solo el color, sino la compatibilidad con la fachada. ¿Quieres que te ayude con eso?';
        historyPush('assistant', reply);
        addMessage(reply, 'bot');
        void speak(reply);
        return;
      }

      let familyIds;
      if (room && ROOM_TO_FAMILIES[room]) {
        // Estancia conocida → responder directo
        familyIds = ROOM_TO_FAMILIES[room];
        const reply = buildColorReply(room, familyIds);
        historyPush('assistant', reply);
        addMessage(reply, 'bot');
        void speak(reply);
      } else if (preference) {
        // Preferencia de estilo/ambiente sin estancia concreta → responder directo
        familyIds = preference;
        const reply = buildColorReply(null, familyIds);
        historyPush('assistant', reply);
        addMessage(reply, 'bot');
        void speak(reply);
      } else {
        // No hay estancia ni preferencia → preguntar solo una cosa
        const question = '¿Para qué estancia buscas el color?';
        historyPush('assistant', question);
        addMessage(question, 'bot');
        void speak(question);
        colorMode = true;
        console.log('[color] esperando estancia del usuario');
      }
      return;
    }

    // ── MODO COMPATIBILIDAD — bypass del flujo normal ─────────────────────────

    // A. Turno de aclaración: el usuario responde a nuestra pregunta de compatibilidad
    if (compatibilityMode) {
      compatibilityMode = false;
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';
      setInputEnabled(false);
      const cLoader = showLoading();

      // Ahora el mensaje sí tiene suficiente contexto → llamar servidor
      const material  = extractCompatMaterial(text);
      console.log('[compat] aclaración → material detectado:', material, '| texto:', text);
      const serverRes = await fetchCompatAnswer(`${compatPendingQuestion} ${text}`, material);
      cLoader.remove();
      setInputEnabled(true);
      input.focus();

      const finalAns = serverRes.answer ?? getLocalCompatAnswer(material)?.answer ?? '¿Puedes darme más detalles sobre la superficie?';
      const reply    = buildCompatReply(finalAns, serverRes.confidence ?? 'low');
      historyPush('assistant', reply);
      addMessage(reply, 'bot');
      void speak(reply);
      compatPendingQuestion = null;
      return;
    }

    // B. Detectar nueva pregunta de compatibilidad
    if (!adviceMode && COMPAT_TRIGGER_RE.test(text)) {
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';
      setInputEnabled(false);
      const cLoader2 = showLoading();

      const material   = extractCompatMaterial(text);
      const localRule  = getLocalCompatAnswer(material);
      console.log('[compat] trigger → material:', material, '| regla local:', localRule?.confidence ?? 'none');

      let reply;

      if (localRule && localRule.confidence === 'high') {
        // Tenemos respuesta local clara → sin red
        reply = buildCompatReply(localRule.answer, 'high');
        cLoader2.remove();
        setInputEnabled(true);
        input.focus();
      } else if (localRule && localRule.confidence === 'low') {
        // Respuesta local que ya es una pregunta de aclaración → usarla directamente
        reply = localRule.answer;
        cLoader2.remove();
        setInputEnabled(true);
        input.focus();
        compatibilityMode    = true;
        compatPendingQuestion = text;
        console.log('[compat] esperando aclaración para:', material);
      } else {
        // Material desconocido o caso no cubierto → servidor
        const serverRes = await fetchCompatAnswer(text, material);
        cLoader2.remove();
        setInputEnabled(true);
        input.focus();

        if (serverRes.needsMore && serverRes.question) {
          // Servidor pide un dato más → modo aclaración
          reply = serverRes.question;
          compatibilityMode    = true;
          compatPendingQuestion = text;
          console.log('[compat] servidor pide aclaración:', serverRes.question);
        } else if (serverRes.answer) {
          reply = buildCompatReply(serverRes.answer, serverRes.confidence);
        } else {
          // Sin material y sin respuesta → preguntar nosotros
          reply = '¿Sobre qué superficie o material quieres pintar?';
          compatibilityMode    = true;
          compatPendingQuestion = text;
          console.log('[compat] material desconocido, preguntando');
        }
      }

      historyPush('assistant', reply);
      addMessage(reply, 'bot');
      void speak(reply);
      return;
    }

    // ── MODO ASESORAMIENTO — bypass del flujo normal ──────────────────────────

    // 1. Detectar si el mensaje activa el modo asesoramiento (aún no activo)
    if (!adviceMode && ADVICE_TRIGGER_RE.test(text)) {
      adviceMode = true;
      for (const k of Object.keys(adviceData)) adviceData[k] = null; // reset limpio
      updateAdviceModeUI();
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';
      setInputEnabled(false);
      const triggerLoader = showLoading();

      // Extraer cualquier dato que ya venga en el mensaje de activación
      const localOnTrigger  = extractFieldsLocally(text);
      const serverOnTrigger = await fetchAdviceExtraction(text);
      applyExtractedFields(localOnTrigger, serverOnTrigger.fields);

      triggerLoader.remove();
      setInputEnabled(true);
      input.focus();

      const firstStep = nextAdviceStep();
      if (!firstStep) {
        // Caso raro: el mensaje de trigger ya contenía todo
        const snap   = { ...adviceData };
        const litros = Math.ceil((snap.sqm ?? 1) * (snap.coats ?? 1) / 10);
        const finMsg = buildFinalBotMessage(snap, litros);
        resetAdviceMode();
        historyPush('assistant', finMsg);
        addMessage(finMsg, 'bot');
        void speak(finMsg);
        openAdviceResult(snap, litros);
      } else {
        historyPush('assistant', firstStep.q);
        addMessage(firstStep.q, 'bot');
        void speak(firstStep.q);
        console.log('[advice] trigger: campos ya extraídos:', { ...adviceData }, '→ pregunto:', firstStep.key);
      }
      return;
    }

    // 2. Si ya estamos en modo asesoramiento, procesar la respuesta del usuario
    if (adviceMode) {
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';
      setInputEnabled(false);
      const advLoader = showLoading();

      // Extracción local (sin red) + servidor en paralelo
      const localFields  = extractFieldsLocally(text);
      const serverResult = await fetchAdviceExtraction(text);
      applyExtractedFields(localFields, serverResult.fields);

      advLoader.remove();
      setInputEnabled(true);
      input.focus();

      console.log('[advice] tras respuesta:', { ...adviceData });

      // ¿Flujo completo?
      if (isAdviceComplete()) {
        const snap   = { ...adviceData };
        const litros = Math.ceil((snap.sqm ?? 1) * (snap.coats ?? 1) / 10);
        const finMsg = buildFinalBotMessage(snap, litros);
        resetAdviceMode();
        historyPush('assistant', finMsg);
        addMessage(finMsg, 'bot');
        void speak(finMsg);
        openAdviceResult(snap, litros);
      } else {
        // Siguiente campo sin responder
        const nextStep = nextAdviceStep();
        console.log('[advice] campo pendiente:', nextStep?.key, '→', nextStep?.q);
        if (nextStep) {
          historyPush('assistant', nextStep.q);
          addMessage(nextStep.q, 'bot');
          void speak(nextStep.q);
        }
      }
      return;
    }

    // ── FIN MODO ASESORAMIENTO ─────────────────────────────────────────────────

    const shortcut = matchClientShortcut(text);
    if (shortcut) {
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';

      if (shortcut === 'assistant') {
        sectionPanel.close();
        window.storyMarks?.closeMark?.();
        const ack = localizedFallbackReply('assistant_bye', text);
        historyPush('assistant', ack);
        addMessage(ack, 'bot');
        Promise.resolve(speak(ack)).finally(() => {
          closeWidget();
        });
        return;
      }

      if (shortcut === 'open_page') {
        executeOpenPage();
        const ack = localizedFallbackReply('open_page', text);
        historyPush('assistant', ack);
        addMessage(ack, 'bot');
        speak(ack);
        return;
      }

      if (shortcut === 'close_all') {
        executeCloseAll();
        const ack = localizedFallbackReply('close_all', text);
        historyPush('assistant', ack);
        addMessage(ack, 'bot');
        speak(ack);
        return;
      }

      if (shortcut === 'hub_back') {
        executeCloseAll();
        const ack = localizedFallbackReply('hub_back', text);
        historyPush('assistant', ack);
        addMessage(ack, 'bot');
        speak(ack);
        return;
      }

      if (shortcut === 'close_panel') {
        executeClosePanel();
        const ack = localizedFallbackReply('close_panel', text);
        historyPush('assistant', ack);
        addMessage(ack, 'bot');
        speak(ack);
        return;
      }
    }

    const reopenProbe = foldText(text).replace(/^[¡¿\s]+/g, '').replace(/[.!?,;:…]+$/g, '').trim();
    if (REOPEN_RE.test(reopenProbe) && lastOpenedSectionId) {
      historyPush('user', text);
      addMessage(text, 'user');
      input.value = '';
      const reopenOpts =
        (lastOpenedSectionId === 'part' || lastOpenedSectionId === 'pros') && lastOpenedHubDetailSlug
          ? { detailSlug: lastOpenedHubDetailSlug }
          : {};
      void executeOpenSection(lastOpenedSectionId, reopenOpts);
      const confirmMsg = localizedFallbackReply('reopen_confirm', text);
      historyPush('assistant', confirmMsg);
      addMessage(confirmMsg, 'bot');
      speak(confirmMsg);
      return;
    }

    historyPush('user', text);

    addMessage(text, 'user');
    input.value = '';
    setInputEnabled(false);

    const loader = showLoading();

    try {
      const res = await fetch(PROXY_CHAT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildMessagesForApi() }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rawData = await res.json();
      const { intent, sectionId, reply, detailSlug, activeStoreId } = normalizeApiChatResponse(rawData, text);

      loader.remove();

      let replyOut = reply;
      switch (intent) {
        case 'open_section':
          if (sectionId) void executeOpenSection(sectionId, { detailSlug, activeStoreId });
          break;
        case 'open_page':
          executeOpenPage();
          break;
        case 'close_panel':
          executeClosePanel();
          break;
        case 'close_all':
          executeCloseAll();
          break;
        default:
          break;
      }

      historyPush('assistant', replyOut);
      addMessage(replyOut, 'bot');
      void speak(replyOut);
    } catch (err) {
      loader.remove();
      console.error('[aiWidget]', err);
      const errMsg = 'No he podido conectar con el asistente. ¿El servidor proxy está arrancado?';
      addMessage(errMsg, 'bot');
      speak(errMsg);
      conversationHistory.pop();
    } finally {
      setInputEnabled(true);
      input.focus();
    }
  }

  // ── Eventos ──────────────────────────────────────────────────────────────────
  fab.addEventListener('click', () =>
    widget.classList.contains('is-open') ? closeWidget() : openWidget()
  );
  closeBtn.addEventListener('click', closeWidget);
  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && widget.classList.contains('is-open')) closeWidget();
  });
}
