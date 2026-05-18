import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI, { toFile } from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
import {
  assistantDidNotUnderstandReplyForLocale,
  assistantGreetingReplyForUserMessage,
  inferGreetingFromUserMessage,
  inferHubBackStepFromUserMessage,
  inferHubDetailFromUserMessage,
  inferMapStoreFromUserMessage,
  inferPageResetFromUserMessage,
  inferSectionFromReply,
  inferSectionFromUserMessage,
  isAllowedHubSlug,
  isAllowedMapStoreId,
  buildLanguageMirrorSystemAddendum,
  localizedFallbackReply,
  transcriptReplyEchoesUser,
  userMessageIsGreetingOnlyNoOtherIntent,
  userMessageAllowsCloseInferenceFromAssistantReply,
} from '../src/hubIntentMap.js';

const SYSTEM_PROMPT = `
Eres el asistente de voz de TEANMUR (pinturas y decoración premium). Respondes de forma natural y breve.

OBLIGATORIO: responde con UN SOLO objeto JSON válido (sin texto antes ni después, sin markdown). Nunca envíes solo frase suelta.

Forma exacta:
{ "intent": "open_section" | "open_page" | "close_panel" | "close_all" | "unknown", "sectionId": "who"|"pros"|"part"|"news"|"map"|null, "detailSlug": string|null, "activeStoreId": string|null, "reply": string }

INTENT — reglas:
- open_section: el usuario quiere abrir, ver, mostrar, ir a, enseñar o saber más de una zona concreta del sitio (empresa, profesionales, particulares, novedades, contacto/mapa). Incluye «busco pintura», «necesito pintura», frases con errores tipográficos si el sentido es pintura/hogar/obra.
- open_page: volver al inicio de la historia (scroll arriba), ver la web/página completa sin modales; frases como «vuelve al inicio», «muéstrame la página», «scroll al inicio».
- close_panel: quiere cerrar, quitar, esconder, fuera, cerrar la ventana/panel lo que tenga abierto (una cosa), "ciérralo", "quita eso". No uses close_panel solo para «atrás» / «volver» (eso es close_all).
- close_all: SOLO si el usuario pide explícitamente limpiar pantalla, cerrar todo, quitarlo todo, o «atrás»/«volver» para salir y cerrar el asistente. NUNCA uses close_all para saludos, dudas o «no te he entendido».
- unknown: saludos (hola, buenos días…), mensajes vagos, ruido, o cuando no encaje otro intent. reply amable: saludo y presentación como asistente TEANMUR, o pregunta corta. NUNCA pongas en reply «Limpio la pantalla» ni «Cierro eso» si intent es unknown.

Si el usuario pide un servicio del hub (asesoramiento, muestras, talleres…) aunque venga con errores de voz o tipográficos, intent = open_section con sectionId y detailSlug correctos; nunca close_panel ni close_all por eso.

SECTIONID (solo si intent es open_section y aplica):
- who: marca, empresa, quiénes sois, equipo, historia TEANMUR.
- pros: profesional, obra, industrial, aplicador, empresa cliente B2B.
- part: hogar, casa, habitación, particular, bricolaje, pintar en casa.
- news: novedades, lanzamientos, actualidad, noticias.
- map: contacto, teléfono, email, dónde estáis, cómo llegar, mapa.

DETAILSLUG (solo si intent es open_section y sectionId es "pros" o "part"; si no aplica, null):
Profesionales (pros):
- express — entrega exprés, una hora, urgente.
- tech_specialist — asesoramiento técnico especializado, consultoría técnica de obra.
- volume — descuentos por volumen, precio por cantidad.
- trends — nuevos productos, tendencias de mercado, novedades de catálogo B2B.
- training — capacitación, curso técnico, formación profesional.
- warranty — postventa, garantía extendida, soporte técnico tras la compra.

Particulares (part):
- tech_personal — asesoramiento (aunque venga cortado o con errores de voz: solo «asesoramiento», ruido detrás, «demigo»…), personalizado, asesor en casa; «asesoramiento técnico» sin «especial» (hogar).
- color_sample — muestras de color, muestra gratis, carta de colores.
- custom_paint — pintura a medida, aplicación de pintura a medida, aplicación a medida, pintura personalizada.
- diy_courses — taller de pintura, bricolaje y pintura, cursos.
- delivery — entrega a domicilio, envío a domicilio.
- satisfaction — garantía de satisfacción.

Si el usuario nombra explícitamente uno de esos servicios, incluye detailSlug correcto. Si solo quiere la sección general, detailSlug null.

ACTIVESTOREID (solo si intent es open_section y sectionId es "map"; si no aplica, null):
- murcia — delegación Murcia (Av. Teniente Montesinos, frente Torre Godoy).
- cartagena — delegación Cartagena (Pol. Ind. Cabezo Beaza, Av. Luxemburgo).
- cieza — delegación Cieza (Ctra. de Madrid, frente Mercadona).

Si pide ruta o "cómo llegar" a una tienda concreta, rellena activeStoreId. Si solo pide contacto sin tienda, null.

Si intent es close_panel, close_all u open_page, sectionId, detailSlug y activeStoreId deben ser null.

Inferencia: frases largas, mal dichas o con ruido; elige la sección más probable. Si pide abrir y hay ambigüedad leve, elige la más plausible y un reply honesto y corto.

REPLY: máximo ~18 palabras, tono humano, útil, en el idioma del usuario (ver mensaje de sistema «IDIOMA»). Ejemplos orientativos (no copies literal si no encaja):
- open_section part → abre particulares en el idioma del usuario.
- open_section pros → abre profesionales en el idioma del usuario.
- close_panel (cierra panel concreto) → confirma el cierre en el idioma del usuario.
- close_all (limpia / cierra todo / atrás para salir) → confirma en el idioma del usuario.
- open_page → confirma volver al inicio de la historia en el idioma del usuario.
- unknown + saludo → saludo y «soy el asistente de TEANMUR» en el idioma del usuario.
- unknown + no entendido → pide aclaración en el idioma del usuario (pintura hogar, obra, novedades, contacto).
`.trim();

const VALID_INTENTS = ['open_section', 'open_page', 'close_panel', 'close_all', 'unknown'];
const VALID_SECTION_IDS = ['who', 'pros', 'part', 'news', 'map'];

function fold(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Cierre inferido por texto del bot si el intent viene mal o vacío (solo si el usuario pidió cierre). */
function inferCloseIntentFromReply(reply, lastUserMsg = '') {
  if (lastUserMsg && !userMessageAllowsCloseInferenceFromAssistantReply(lastUserMsg)) return null;
  const t = fold(reply);
  if (!t) return null;
  if (/limpia la pantalla|limpio la pantalla|cierra todo|cierro todo|te lo cierro todo|quita todo|cerrar todo|clear(ing)?\s+the\s+screen|close\s+everything/i.test(t)) return 'close_all';
  if (/cierro eso|cerramos|cierre eso|cierra eso|vale[,.]*\s*te lo cierro|i'?ll\s+close\s+that|closing\s+that/i.test(t)) return 'close_panel';
  return null;
}

function normalizeChatPayload(parsed, lastUserMsg = '') {
  let intent = typeof parsed.intent === 'string'
    ? parsed.intent.replace(/\uFEFF/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
  if (intent === 'close' || intent === 'cerrar' || intent === 'cerrar_panel') intent = 'close_panel';
  if (intent === 'closeall' || intent === 'cerrar_todo') intent = 'close_all';
  if (intent === 'openpage' || intent === 'reset_page' || intent === 'pagina_principal') intent = 'open_page';
  if (!VALID_INTENTS.includes(intent)) intent = 'unknown';

  let rawSid = parsed.sectionId ?? parsed.section_id;
  let sectionId = null;
  if (rawSid != null && String(rawSid).trim() !== '') {
    sectionId = String(rawSid).trim().toLowerCase();
    if (!VALID_SECTION_IDS.includes(sectionId)) sectionId = null;
  }

  let reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';

  if (intent === 'unknown' && sectionId) intent = 'open_section';

  if (!VALID_INTENTS.includes(intent)) {
    const c = inferCloseIntentFromReply(reply, lastUserMsg);
    if (c) intent = c;
  }
  if (!VALID_INTENTS.includes(intent)) {
    intent = sectionId ? 'open_section' : 'unknown';
  }

  let isClose = intent === 'close_panel' || intent === 'close_all';

  if (!isClose && intent === 'open_section' && !sectionId) {
    sectionId = inferSectionFromUserMessage(lastUserMsg) || inferSectionFromReply(reply);
  }
  if (!isClose && intent === 'unknown' && !sectionId) {
    const c = inferCloseIntentFromReply(reply, lastUserMsg);
    if (c) {
      intent = c;
      isClose = true;
    } else {
      const g = inferSectionFromUserMessage(lastUserMsg) || inferSectionFromReply(reply);
      if (g) {
        intent = 'open_section';
        sectionId = g;
      }
    }
  }
  if (intent === 'open_section' && !sectionId) intent = 'unknown';

  let rawDetail = parsed.detailSlug ?? parsed.detail_slug ?? parsed.hubOptionId;
  let detailSlug = null;
  if (rawDetail != null && String(rawDetail).trim() !== '' && sectionId) {
    const ds = String(rawDetail).trim().toLowerCase();
    if (isAllowedHubSlug(sectionId, ds)) detailSlug = ds;
  }

  if (lastUserMsg && (sectionId === 'pros' || sectionId === 'part')) {
    if (!detailSlug) {
      const inf = inferHubDetailFromUserMessage(lastUserMsg, sectionId);
      if (inf.detailSlug && isAllowedHubSlug(sectionId, inf.detailSlug)) {
        detailSlug = inf.detailSlug;
        intent = 'open_section';
        isClose = false;
      }
    }
  }

  let activeStoreId = null;
  const rawStore = parsed.activeStoreId ?? parsed.active_store_id ?? parsed.storeId;
  if (rawStore != null && String(rawStore).trim() !== '' && sectionId === 'map') {
    const st = String(rawStore).trim().toLowerCase();
    if (isAllowedMapStoreId(st)) activeStoreId = st;
  }
  if (sectionId === 'map' && lastUserMsg && !activeStoreId) {
    const g = inferMapStoreFromUserMessage(lastUserMsg);
    if (g && isAllowedMapStoreId(g)) {
      activeStoreId = g;
      intent = 'open_section';
      isClose = false;
    }
  }

  if (!sectionId && lastUserMsg) {
    const storeOnly = inferMapStoreFromUserMessage(lastUserMsg);
    if (storeOnly) {
      intent = 'open_section';
      sectionId = 'map';
      activeStoreId = storeOnly;
      isClose = false;
    } else {
      const hub = inferHubDetailFromUserMessage(lastUserMsg, null);
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
  if (lastUserMsg) {
    const hubNav = inferHubDetailFromUserMessage(lastUserMsg, null);
    if (hubNav.sectionId && hubNav.detailSlug) {
      intent = 'open_section';
      sectionId = hubNav.sectionId;
      detailSlug = hubNav.detailSlug;
      isClose = false;
      hubNavApplied = true;
    }
  }

  if (!hubNavApplied && lastUserMsg && inferPageResetFromUserMessage(lastUserMsg) === 'open_page') {
    intent = 'open_page';
    sectionId = null;
    detailSlug = null;
    activeStoreId = null;
    isClose = false;
  }

  if (intent === 'open_section' && !sectionId) intent = 'unknown';

  if (intent !== 'open_section' && intent !== 'open_page') {
    sectionId = null;
    detailSlug = null;
    activeStoreId = null;
  }

  if (!reply) {
    reply =
      intent === 'close_panel'
        ? localizedFallbackReply('close_panel', lastUserMsg)
        : intent === 'close_all'
          ? localizedFallbackReply('close_all', lastUserMsg)
          : intent === 'open_page'
            ? localizedFallbackReply('open_page', lastUserMsg)
          : intent === 'open_section'
            ? localizedFallbackReply('open_section', lastUserMsg)
            : localizedFallbackReply('unknown_prompt', lastUserMsg);
  }

  const robotic = /no (te )?he entendido|no he entendido|dec[ií]rlo de otra form|didn'?t (quite )?get|don'?t understand/i;
  if (intent === 'unknown' && robotic.test(reply)) {
    reply = localizedFallbackReply('unknown_prompt', lastUserMsg);
  }

  const rt = (reply || '').trim();
  if (
    intent === 'open_section' &&
    sectionId &&
    (hubNavApplied || detailSlug) &&
    (!rt ||
      /^c[oó]mo\s+ese\b/i.test(rt) ||
      /^eso\.?$/i.test(rt) ||
      /cierro\s+eso|cierra\s+eso/i.test(fold(rt)) ||
      transcriptReplyEchoesUser(reply, lastUserMsg) ||
      (/asesorami|demigo|muestra|bricolaje|entrega|garant|taller|medida/i.test(fold(rt)) &&
        !/^(te|voy|abro|cierro|dime|no\s)/i.test(fold(rt).trim())))
  ) {
    reply = localizedFallbackReply('open_section', lastUserMsg);
  }

  if (lastUserMsg && inferHubBackStepFromUserMessage(lastUserMsg)) {
    intent = 'close_all';
    sectionId = null;
    detailSlug = null;
    activeStoreId = null;
    reply = localizedFallbackReply('hub_back', lastUserMsg);
  } else if (lastUserMsg && userMessageIsGreetingOnlyNoOtherIntent(lastUserMsg, null)) {
    intent = 'unknown';
    sectionId = null;
    detailSlug = null;
    activeStoreId = null;
    reply = assistantGreetingReplyForUserMessage(lastUserMsg);
  } else if (intent === 'unknown' && lastUserMsg) {
    if (inferGreetingFromUserMessage(lastUserMsg)) {
      reply = assistantGreetingReplyForUserMessage(lastUserMsg);
    } else {
      const rf = fold(reply || '');
      if (!rf || /limpia la pantalla|limpio la pantalla|cierra todo|cierro todo|cierro eso|cierra eso|clear(ing)?\s+the\s+screen|close\s+everything/i.test(rf)) {
        reply = assistantDidNotUnderstandReplyForLocale(lastUserMsg);
      }
    }
  }

  return { intent, sectionId, reply, detailSlug, activeStoreId };
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    if (/^https:\/\//.test(origin)) return cb(null, true);
    cb(new Error('CORS: origen no permitido'));
  },
}));

app.use(express.json({ limit: '15mb' }));

app.post('/api/chat', async (req, res) => {
  const { message, messages } = req.body;

  let userMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    const valid = messages.every(
      m => m && typeof m.role === 'string' && typeof m.content === 'string'
    );
    if (!valid) {
      return res.status(400).json({ error: 'formato de messages inválido' });
    }
    userMessages = messages;
  } else if (message && typeof message === 'string' && message.trim().length > 0) {
    userMessages = [{ role: 'user', content: message.trim() }];
  } else {
    return res.status(400).json({ error: 'message o messages requerido' });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[aiProxy] OPENAI_API_KEY no configurada en .env');
    return res.status(500).json({
      intent: 'unknown',
      sectionId: null,
      detailSlug: null,
      activeStoreId: null,
      reply: 'El asistente no está configurado todavía. Añade tu API key en el archivo .env.',
    });
  }

  const lastUserForLocale =
    [...userMessages].reverse().find((m) => m.role === 'user')?.content || '';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      max_tokens: 120,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: buildLanguageMirrorSystemAddendum(lastUserForLocale) },
        ...userMessages,
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';

    let parsed;
    try {
      const clean = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      console.warn('[aiProxy] Respuesta no es JSON válido:', raw);
      parsed = { intent: 'unknown', sectionId: null, detailSlug: null, activeStoreId: null, reply: '' };
    }

    const lastUserMsg =
      Array.isArray(userMessages) && userMessages.length
        ? [...userMessages].reverse().find((m) => m.role === 'user')?.content || ''
        : '';

    res.json(normalizeChatPayload(parsed, lastUserMsg));
  } catch (err) {
    console.error('[aiProxy] Error OpenAI /api/chat:', err.message);
    res.status(502).json({
      intent: 'unknown',
      sectionId: null,
      detailSlug: null,
      activeStoreId: null,
      reply: 'Ha habido un problema al conectar con el asistente. Inténtalo de nuevo.',
    });
  }
});

const ADVICE_SYSTEM_PROMPT = `
Eres extractor de datos para TEANMUR pinturas. El usuario describe su proyecto de pintura.
Tu única tarea: extraer los valores que puedas del mensaje del usuario para cada campo.
Si un campo no está en el mensaje, devuelve null para ese campo (no inventes ni inferas sin base).

Responde SOLO con JSON válido sin markdown (sin bloques de código):
{
  "what":    <string|null>,
  "sqm":     <number|null>,
  "surface": <string|null>,
  "coats":   <number|null>,
  "finish":  <"mate"|"satinado"|"brillante"|null>,
  "ack":     <string>
}

Reglas campo a campo:
- what: texto libre que describe qué se va a pintar (ej: "habitación", "salón", "fachada exterior"). Normaliza a sustantivo simple.
- sqm: solo el número de metros cuadrados (sin unidades). Ej: "unos 35 metros" → 35. "30-40 metros" → 35.
- surface: estado de la pared. Frases como "bien", "ok", "normal", "limpia", "nueva" → "en buen estado". "Tiene manchas" → "con manchas". "Desconchada" → "desconchada". "Humedad" → "con humedad".
- coats: número entero de manos/capas. "dos manos" → 2. "una capa" → 1. "triple capa" → 3.
- finish: normaliza siempre a exactamente "mate", "satinado" o "brillante". Variantes: "matte", "made", "satin", "brillo", "brillante".
- ack: frase de confirmación natural y breve (máximo 8 palabras) que confirme lo que se ha entendido. Si no hay nada que confirmar, pon "".
`.trim();

app.post('/api/advice', async (req, res) => {
  const { userMessage } = req.body;

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage requerido' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.json({ fields: { what: null, sqm: null, surface: null, coats: null, finish: null }, ack: '' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 120,
      messages: [
        { role: 'system', content: ADVICE_SYSTEM_PROMPT },
        { role: 'user',   content: userMessage.slice(0, 400) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let parsed;
    try {
      const clean = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {};
    }

    const fields = {
      what:    typeof parsed.what    === 'string'  && parsed.what.trim()    ? parsed.what.trim()                : null,
      sqm:     typeof parsed.sqm     === 'number'  && parsed.sqm     > 0    ? Math.round(parsed.sqm)            : null,
      surface: typeof parsed.surface === 'string'  && parsed.surface.trim() ? parsed.surface.trim()             : null,
      coats:   typeof parsed.coats   === 'number'  && parsed.coats   > 0    ? Math.round(parsed.coats)          : null,
      finish:  ['mate','satinado','brillante'].includes(parsed.finish)       ? parsed.finish                     : null,
    };

    console.log('[advice] extracción servidor:', fields);
    return res.json({
      fields,
      ack: typeof parsed.ack === 'string' ? parsed.ack.trim() : '',
    });
  } catch (err) {
    console.error('[aiProxy] Error /api/advice:', err.message);
    return res.json({ fields: { what: null, sqm: null, surface: null, coats: null, finish: null }, ack: '' });
  }
});

const COMPAT_SYSTEM_PROMPT = `
Eres asesor técnico de TEANMUR pinturas. El usuario pregunta si una pintura o sistema es compatible
con una superficie o material concreto.

Responde SOLO con JSON válido sin markdown:
{
  "answer":     <string>,
  "confidence": <"high"|"low">,
  "needsMore":  <boolean>,
  "question":   <string|null>
}
`.trim();

app.post('/api/compatibility', async (req, res) => {
  const { userMessage, material } = req.body;

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage requerido' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.json({ answer: null, confidence: 'low', needsMore: false, question: null });
  }

  const context = material ? `Material/superficie detectado: ${material}.\nMensaje del usuario: ${userMessage}` : userMessage;

  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0.15,
      max_tokens:  140,
      messages: [
        { role: 'system', content: COMPAT_SYSTEM_PROMPT },
        { role: 'user',   content: context.slice(0, 500) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let parsed;
    try {
      const clean = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { answer: null, confidence: 'low', needsMore: false, question: null };
    }

    return res.json({
      answer:     typeof parsed.answer   === 'string' ? parsed.answer.trim()   : null,
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
      needsMore:  Boolean(parsed.needsMore),
      question:   typeof parsed.question === 'string' ? parsed.question.trim() : null,
    });
  } catch (err) {
    console.error('[aiProxy] Error /api/compatibility:', err.message);
    return res.json({ answer: null, confidence: 'low', needsMore: false, question: null });
  }
});

app.post('/api/transcribe', async (req, res) => {
  const { audioBase64, mimeType } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });
  }

  if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.length < 80) {
    return res.status(400).json({ error: 'audioBase64 requerido o demasiado corto' });
  }

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length < 32) {
      return res.status(400).json({ error: 'audio vacío' });
    }

    const type = typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'audio/webm';
    const ext = type.includes('mp4') ? 'm4a' : type.includes('wav') ? 'wav' : 'webm';
    const file = await toFile(buffer, `input.${ext}`, { type });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      prompt: 'TEANMUR, paint, home, professional, contact, map.',
    });

    const text = typeof transcription.text === 'string' ? transcription.text.trim() : '';
    return res.json({ text });
  } catch (err) {
    console.error('[aiProxy] Error OpenAI /api/transcribe:', err.message);
    return res.status(502).json({ error: 'No se pudo transcribir el audio' });
  }
});

app.post('/api/tts', async (req, res) => {
  const { text, voice = 'shimmer', model = 'tts-1-hd', speed, instructions } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text requerido' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });
  }

  const ALLOWED = ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'];
  const ttsModel = ALLOWED.includes(model) ? model : 'tts-1-hd';
  const ttsSpeed = typeof speed === 'number' && speed >= 0.25 && speed <= 4 ? speed : undefined;

  const supportsInstructions = ttsModel === 'gpt-4o-mini-tts' || ttsModel === 'gpt-4o-mini-tts-2025-12-15';
  const instrDefault = 'Speak in the same language as the input text. Same voice and pace every time.';
  const instr =
    supportsInstructions && typeof instructions === 'string' && instructions.trim()
      ? instructions.trim()
      : supportsInstructions ? instrDefault : undefined;

  try {
    const mp3 = await openai.audio.speech.create({
      model: ttsModel,
      voice,
      input: String(text).replace(/\bTEANMUR\b/gi, 'Tian-mur').trim(),
      response_format: 'mp3',
      ...(ttsSpeed != null ? { speed: ttsSpeed } : {}),
      ...(instr ? { instructions: instr } : {}),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (err) {
    console.error('[aiProxy] Error OpenAI /api/tts:', err.message);
    return res.status(502).json({ error: 'No se pudo generar el audio' });
  }
});

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, tts: process.env.OPENAI_API_KEY ? 'openai' : 'none' })
);

// Archivos estáticos del frontend
app.use(express.static(join(__dirname, '..')));

// Fallback SPA — Express 5 requiere '/*splat' en lugar de '*'
app.get('/*splat', (req, res) => {
  res.sendFile(join(__dirname, '..', 'index.html'));
});

const PORT = process.env.PORT || process.env.AI_PROXY_PORT || 3002;
app.listen(PORT, () => {
  console.log(`[aiProxy] Servidor escuchando en http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[aiProxy] ⚠ OPENAI_API_KEY no encontrada en .env');
  }
});
