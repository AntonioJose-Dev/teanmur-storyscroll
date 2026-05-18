/**
 * Intenciones de apertura directa a un ítem del hub Profesionales / Particulares.
 * Usado por aiWidget (cliente) y server/aiProxy.js (validación + refuerzo).
 */

export const PROS_HUB_SLUGS = ['express', 'tech_specialist', 'volume', 'trends', 'training', 'warranty'];
export const PART_HUB_SLUGS = ['tech_personal', 'color_sample', 'custom_paint', 'diy_courses', 'delivery', 'satisfaction'];

/** Tiendas del panel Contacto / mapa (ids alineados con `PANEL_CONTENT.map.stores`). */
export const MAP_STORE_IDS = ['murcia', 'cartagena', 'lorca'];

export function foldHub(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Quita el anexo [Contexto UI:…] que envía el cliente en el último mensaje (no debe afectar a la inferencia). */
export function stripUiContextSuffix(rawText) {
  return String(rawText ?? '')
    .replace(/\s*\[Contexto UI:[\s\S]*$/i, '')
    .trim();
}

/** Textos cortos del asistente alineados con el idioma detectado del usuario (fallbacks + atajos). */
const FALLBACK_PACKS = {
  es: {
    close_panel: 'Cierro eso.',
    close_all: 'Limpio la pantalla.',
    open_page: 'Vuelvo al inicio de la historia.',
    open_section: 'Te lo abro enseguida.',
    unknown_prompt: 'Dime qué quieres ver y te lo abro.',
    hub_back: 'Vuelvo atrás y cierro el asistente.',
    assistant_bye: 'Hasta luego.',
    reopen_confirm: '¡Aquí tienes!',
  },
  en: {
    close_panel: "I'll close that.",
    close_all: 'Clearing the screen.',
    open_page: 'Back to the start of the story.',
    open_section: "I'll open that for you.",
    unknown_prompt: "Tell me what you'd like to see and I'll open it.",
    hub_back: 'Going back and closing the assistant.',
    assistant_bye: 'Goodbye.',
    reopen_confirm: 'Here you go!',
  },
  fr: {
    close_panel: 'Je ferme ça.',
    close_all: "J'efface l'écran.",
    open_page: 'Retour au début de l’histoire.',
    open_section: "Je t'ouvre ça tout de suite.",
    unknown_prompt: 'Dis-moi ce que tu veux voir et je l’ouvre.',
    hub_back: 'Retour en arrière ; je ferme l’assistant.',
    assistant_bye: 'Au revoir.',
    reopen_confirm: 'Voilà !',
  },
  de: {
    close_panel: 'Mache ich zu.',
    close_all: 'Bildschirm wird geleert.',
    open_page: 'Zurück zum Anfang der Geschichte.',
    open_section: 'Ich öffne das sofort.',
    unknown_prompt: 'Sag mir kurz, was du sehen möchtest, dann öffne ich es.',
    hub_back: 'Gehe zurück und schließe den Assistenten.',
    assistant_bye: 'Auf Wiedersehen.',
    reopen_confirm: 'Bitte sehr!',
  },
  it: {
    close_panel: 'Lo chiudo.',
    close_all: 'Pulisco lo schermo.',
    open_page: 'Torno all’inizio della storia.',
    open_section: 'Te lo apro subito.',
    unknown_prompt: 'Dimmi cosa vuoi vedere e te lo apro.',
    hub_back: 'Indietro e chiudo l’assistente.',
    assistant_bye: 'Arrivederci.',
    reopen_confirm: 'Ecco fatto!',
  },
  pt: {
    close_panel: 'Fecho isso.',
    close_all: 'A limpar o ecrã.',
    open_page: 'Volto ao início da história.',
    open_section: 'Abro já para ti.',
    unknown_prompt: 'Diz-me o que queres ver e abro.',
    hub_back: 'Volto atrás e fecho o assistente.',
    assistant_bye: 'Até logo.',
    reopen_confirm: 'Aqui está!',
  },
};

const MODEL_LOCALE_LABEL = {
  es: 'español (España)',
  en: 'inglés',
  fr: 'francés',
  de: 'alemán',
  it: 'italiano',
  pt: 'portugués',
  ru: 'ruso',
  ja: 'japonés',
  zh: 'chino',
  ar: 'árabe',
};

/**
 * Idioma dominante del último mensaje del usuario (para `reply`, saludos forzados y TTS).
 * Heurística ligera; si no hay señales claras en texto latino, por defecto `es` (sitio TEANMUR).
 */
export function inferAssistantLocale(rawText) {
  const text = stripUiContextSuffix(String(rawText ?? '')).trim();
  if (!text) return 'es';

  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'zh';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';

  const lower = foldHub(text);

  let en = 0;
  let es = 0;
  let fr = 0;
  let de = 0;
  let it = 0;
  let pt = 0;

  if (/[áéíóúñü¿¡]/i.test(text)) es += 4;
  if (/\b(el|la|los|las|un|una|qu[eé]|c[oó]mo|d[oó]nde|gracias|hola|buenos|buenas|necesito|quiero|pintura|d[ií]melo|est[aá]is|tambi[eé]n)\b/.test(lower)) es += 2;
  if (/\b(vale|gracias|hola|buenas|dime|quiero|necesito)\b/.test(lower)) es += 1;

  if (/\b(the|what|how|where|can you|please|thanks|thank you|morning|hello|good|show|about|need|want|help|paint)\b/.test(lower)) en += 2;
  if (/\b(you|your|we|our|they|this|that|with|from|would|could)\b/.test(lower)) en += 1;

  if (/[àâçéèêëîïôùûüÿœ]/i.test(text) && /\b(le|la|les|vous|merci|bonjour|bonsoir|comment)\b/.test(lower)) fr += 4;
  if (/\b(merci|bonjour|bonsoir|svp|s'il vous pla[iî]t)\b/.test(lower)) fr += 2;

  if (/[äöüß]/i.test(text) && /\b(der|die|das|und|bitte|danke|hallo|guten)\b/.test(lower)) de += 4;
  if (/\b(bitte|danke|hallo|guten\s+tag)\b/.test(lower)) de += 2;

  if (/\b(il|la|lo|gli|grazie|ciao|buongiorno|buonasera|pittura)\b/.test(lower)) it += 3;

  if (/\b(obrigad[oa]|ol[aá]|voc[eê]|tinta|por\s+favor)\b/.test(lower)) pt += 3;

  const max = Math.max(en, es, fr, de, it, pt);
  if (max === 0) {
    if (/^[a-zA-Z0-9\s.,!?'…"“”\-]+$/.test(text) && /\b(okay|ok|yes|no|hello|hi|hey|please|thanks)\b/i.test(lower)) return 'en';
    return 'es';
  }

  const scores = { en, es, fr, de, it, pt };
  const winners = Object.keys(scores).filter((k) => scores[k] === max);
  if (winners.length === 1) return winners[0];
  if (winners.includes('es') && /[áéíóúñü¿¡]/i.test(text)) return 'es';
  if (winners.includes('en') && /^[a-zA-Z0-9\s.,!?'…"“”\-]+$/.test(text)) return 'en';
  if (winners.includes('es')) return 'es';
  return winners[0];
}

export function localizedFallbackReply(kind, rawText) {
  const loc = inferAssistantLocale(rawText);
  const pack = FALLBACK_PACKS[loc] || FALLBACK_PACKS.en;
  return pack[kind] ?? FALLBACK_PACKS.es[kind];
}

/** Bloque corto que se añade al system del chat para obligar a igualar idioma en `reply`. */
export function buildLanguageMirrorSystemAddendum(lastUserMessage) {
  const label = MODEL_LOCALE_LABEL[inferAssistantLocale(lastUserMessage)] || 'el mismo idioma que el último mensaje del usuario';
  return [
    'IDIOMA / LANGUAGE (obligatorio):',
    `El último mensaje del usuario está redactado principalmente en: ${label}.`,
    'El campo JSON "reply" debe estar íntegramente en ese mismo idioma y registro (sin mezclar dos idiomas en una sola frase).',
    'Si el usuario escribió en inglés, todo el reply en inglés; si en español de España, en español de España; y así con el idioma detectado.',
    'Los nombres de campos del JSON (intent, sectionId, etc.) siguen siendo los del esquema en inglés.',
  ].join(' ');
}

/** Variante localizada del mensaje de «no te he entendido». */
export function assistantDidNotUnderstandReplyForLocale(rawText) {
  const loc = inferAssistantLocale(rawText);
  const lines = {
    es: 'No lo he entendido del todo. Si buscas pintura para casa, para obra, novedades o contacto, dímelo con una frase y te guío.',
    en: "I didn't quite get that. Say in one sentence if you want home paints, trade/pro work, news or contact, and I'll guide you.",
    fr: "Je n'ai pas bien compris. Dis-moi en une phrase si tu cherches de la peinture maison, chantier, nouveautés ou contact, et je te guide.",
    de: 'Das habe ich nicht ganz verstanden. Schreib in einem Satz: Hausfarbe, Gewerbe, Neuheiten oder Kontakt – dann führe ich dich.',
    it: 'Non ho capito bene. Dimmi in una frase se cerchi pittura per casa, cantiere, novità o contatto e ti guido.',
    pt: 'Não percebi bem. Diz numa frase se queres tintas para casa, obra, novidades ou contacto e eu guio-te.',
    ru: 'Я не совсем понял(а). Напишите одной фразой: краски для дома, для работ, новости или контакт — подскажу.',
    ja: 'すみません、よく分かりませんでした。住宅用、工事、新製品、連絡先のどれかを一文で言ってください。',
    zh: '我没完全听懂。请用一句话说明：家装涂料、工程、新品还是联系方式，我来引导。',
    ar: 'لم أفهم تمامًا. اكتب بجملة واحدة: دهانات منزل، أعمال، جديد أم تواصل، وسأرشدك.',
  };
  return lines[loc] || lines.en;
}

/** No inferir sectionId desde respuestas del bot (saludos con «TEANMUR», «Te muestro…», etc.). */
export function shouldIgnoreReplyForSectionInference(reply) {
  const t = foldHub(stripUiContextSuffix(String(reply ?? '')));
  if (!t) return false;
  if (/^(te|les|os|le|vale|listo|limpio|dime|aqu[ií]|voy|muestro|ense[nñ]o)\b/i.test(t)) return true;
  if (/soy el asistente de\b/i.test(t)) return true;
  if (/\bben?os\s+d[ií]as.*en qu[eé] puedo ayudarte/i.test(t)) return true;
  if (/\b(hola|buenas),?\s+soy el asistente\b/i.test(t)) return true;
  return false;
}

/**
 * Sección inferida por lo que *dice el modelo* en `reply` (no incluye la marca TEANMUR sola: evita abrir Empresa tras un saludo).
 */
export function inferSectionFromReply(reply) {
  const t = foldHub(stripUiContextSuffix(String(reply ?? '')));
  if (!t || shouldIgnoreReplyForSectionInference(reply)) return null;
  if (/\b(profesionales|profesional|industrial|obra|aplicador|b2b)\b/.test(t)) return 'pros';
  if (/\b(particulares|particular|hogar|casa|habitaci[oó]n|bricolaje)\b/.test(t)) return 'part';
  if (/\b(empresa|marca|qui[eé]nes|equipo)\b/.test(t) && !/\b(profesional|particular)\b/.test(t)) return 'who';
  if (/\b(novedades|novedad|actualidad|lanzamiento)\b/.test(t)) return 'news';
  if (/\b(contacto|mapa|tel[eé]fono|ubicaci[oó]n|direcci[oó]n|email)\b/.test(t)) return 'map';
  return null;
}

export function isAllowedHubSlug(sectionId, slug) {
  if (!slug || typeof slug !== 'string') return false;
  const id = slug.trim().toLowerCase();
  if (sectionId === 'pros') return PROS_HUB_SLUGS.includes(id);
  if (sectionId === 'part') return PART_HUB_SLUGS.includes(id);
  return false;
}

export function isAllowedMapStoreId(id) {
  if (!id || typeof id !== 'string') return false;
  return MAP_STORE_IDS.includes(id.trim().toLowerCase());
}

/**
 * Tienda de contacto inferida por texto (panel map / rutas).
 * @returns {string|null} id de tienda o null
 */
export function inferMapStoreFromUserMessage(rawText) {
  const t = foldHub(stripUiContextSuffix(rawText));
  if (!t) return null;
  if (/\b(lorca)\b/.test(t)) return 'lorca';
  if (/\b(cartagena|cabezo\s*beaza|luxemburgo|pol(\.\s*)?ind\.?\s*cabezo)\b/.test(t)) return 'cartagena';
  if (/\b(montesinos|teniente\s+montesinos|torre\s+godoy|av\.?\s*teniente)\b/.test(t)) return 'murcia';
  if (/\b(murcia)\b/.test(t) && !/\b(cartagena|lorca)\b/.test(t)) return 'murcia';
  if (/\b(c[oó]mo\s+llegar|llevame|ll[eé]vame|ruta)\b/.test(t) && /\b(lorca)\b/.test(t)) return 'lorca';
  if (/\b(c[oó]mo\s+llegar|llevame|ll[eé]vame|ruta)\b/.test(t) && /\b(cartagena)\b/.test(t)) return 'cartagena';
  if (/\b(c[oó]mo\s+llegar|llevame|ll[eé]vame|ruta)\b/.test(t) && /\b(murcia)\b/.test(t)) return 'murcia';
  return null;
}

function matchProsDetail(t) {
  if (/\b(expr[eé]s|express|entrega\s+urgente|una\s+hora|1\s*h\s*ora|en\s+1\s*h)\b/.test(t)) return 'express';
  if (
    /\b(asesoramiento\s+t[eé]cnico\s+especial|asesor(es)?\s+especial|consultor[ií]a\s+t[eé]cnica|t[eé]cnico\s+especializad)\b/.test(t)
  )
    return 'tech_specialist';
  if (/\b(descuent\w*\s+(por\s+)?volumen|volumen\s+de\s+compra|precio\s+por\s+cantidad)\b/.test(t)) return 'volume';
  if (/\b(nuevos\s+productos|tendencias\s+de\s+mercado|acceso\s+a\s+novedades)\b/.test(t)) return 'trends';
  if (/\b(capacitaci[oó]n|curso\s+t[eé]cnico|formaci[oó]n\s+para\s+profesional)\b/.test(t)) return 'training';
  if (/\b(postventa|garant[ií]a\s+extendida|soporte\s+t[eé]cnico\s+post)\b/.test(t)) return 'warranty';
  return null;
}

function matchPartDetail(t) {
  if (
    /\b(asesoramiento\s+t[eé]cnico\s+personal|asesoramiento\s+t[eé]cnico\s+personalizado|asesoramiento\s+personalizado|asesor\s+en\s+casa|asesor[ií]a\s+en\s+casa)\b/.test(
      t
    )
  )
    return 'tech_personal';
  // "Asesoramiento técnico" solo (sin "especial") → hogar; errores típicos STT.
  if (/\basesoramiento\s+t[eé]cnico\b(?!\s+especial)\b/.test(t)) return 'tech_personal';
  if (/\basesoriamient\w*\s+t[eé]cniv[\w]*\b/.test(t)) return 'tech_personal';
  if (/\basesor[ií]a\s+t[eé]cnic[oa]s?\b(?!\s+especial)\b/.test(t)) return 'tech_personal';
  // STT: «técnico» mal oído como «te digo», «demigo», «de migo»…
  if (/\basesoramiento\s+(de\s*)?(migo|digo|demigo|te\s*digo|diggo|me\s*digo)\b/.test(t)) return 'tech_personal';
  // STT / mayúsculas / «asesoramiento» + ruido (p. ej. DEMIGO)
  if (/\basesorami\w*\b/.test(t) && !/\bespecial\b/.test(t) && !/\b(industrial|obra|constructora|aplicador|b2b)\b/.test(t)) return 'tech_personal';
  // Muestras / carta de colores: plural, coloquial y errores típicos de STT ("muestre", "mostrar colores").
  // Nota: escribir "color(?:es)?", no "colores?" (en regex eso sería "colore" + "s" opcional).
  if (
    /\b(muestras?\s+de\s+color(?:es)?|muestras?\s+de\s+pintura|muestras?\s+color(?:es)?|las\s+muestras?\b|muestra\s+gratis|pedir\s+muestras?|quiero\s+(una\s+|las\s+|los\s+)?muestras?|ir\s+a(\s+las|\s+los)?\s+muestras?|voy\s+a(\s+las|\s+los)?\s+muestras?|ver(\s+las|\s+los)?\s+muestras?|probar(\s+el|\s+los|\s+las)?\s+color(?:es)?|probar\s+tonos?\b|tonos?\s+en\s+pared|carta\s+de\s+color(?:es)?|muestrario|color(?:es)?\s+de\s+muestra|muestre?\s+color(?:es)?|mostrar\s+color(?:es)?)\b/.test(
      t
    )
  )
    return 'color_sample';
  if (
    /\b(pintura\s+a\s+medida|pintura\s+medida|aplicaci[oó]n\s+de\s+pintura(\s+a\s+medida)?|aplicaci[oó]n\s+a\s+medida|aplicar\s+pintura\s+a\s+medida|pintar\s+a\s+medida|mezcla\s+a\s+medida|pintura\s+personalizada|servicio\s+de\s+aplicaci[oó]n|coordin(ar|amos)\s+aplicaci[oó]n|delegar\s+(la\s+)?aplicaci[oó]n)\b/.test(
      t
    )
  )
    return 'custom_paint';
  if (/\b(cursos?\s+y\s+talleres?\s+de\s+bricolaje|cursos?\s+y?\s*talleres?\s+de\s+bricolaje|cursos?\s+de\s+bricolaje|los\s+cursos\s+(de\s+)?bricolaje|taller(es)?\s+(de\s+)?bricolaje|taller\s+de\s+pintura|bricolaje\s+y\s+pintura|aprender\s+a\s+pintar)\b/.test(t)) return 'diy_courses';
  if (/\b(entrega\s+a\s+domicilio|env[ií]o\s+a\s+domicilio|llevarselo\s+a\s+casa|que\s+me\s+lo\s+lleven)\b/.test(t)) return 'delivery';
  if (/\b(garant[ií]a\s+de\s+satisfacci[oó]n|satisfacci[oó]n\s+garantizada)\b/.test(t)) return 'satisfaction';
  return null;
}

/**
 * Sección principal inferida solo por lo que dijo el usuario (sin depender del JSON del modelo).
 * @param {string} rawText
 * @returns {'who'|'pros'|'part'|'news'|'map'|null}
 */
export function inferSectionFromUserMessage(rawText) {
  const t = foldHub(stripUiContextSuffix(rawText));
  if (!t) return null;

  const p = matchPartDetail(t);
  const r = matchProsDetail(t);
  if (p && !r) return 'part';
  if (r && !p) return 'pros';

  if (/\b(profesionales|profesional|industrial|obra|aplicador|b2b|constructora)\b/.test(t)) return 'pros';
  if (/\b(particulares|particular|hogar|casa|habitaci[oó]n|bricolaje|para\s+casa|en\s+mi\s+casa)\b/.test(t)) return 'part';
  // «Busco pintura», «muco pintura» (typo), etc.: sin señales B2B → hogar / particulares
  if (/\bpintura\b/.test(t) && !/\b(profesional|obra|industrial|constructora|aplicador|b2b)\b/.test(t) && t.length < 56) return 'part';
  if (/\b(empresa|marca|qui[eé]nes(\s+sois)?|equipo|historia)\b/.test(t) && !/\b(profesional|particular)\b/.test(t)) return 'who';
  if (/\b(novedades|novedad|actualidad|lanzamiento)\b/.test(t)) return 'news';
  if (/\b(contacto|mapa|tel[eé]fono|ubicaci[oó]n|direcci[oó]n|email|d[oó]nde\s+est[aá])\b/.test(t)) return 'map';
  return null;
}

/**
 * Parte el mensaje del último turno (p. ej. en el proxy) en texto de usuario y panel modal abierto.
 * @returns {{ userText: string, panelOpen: 'pros'|'part'|'who'|'news'|'map'|null }}
 */
export function splitUserMessageAndUiContext(rawText) {
  const full = String(rawText ?? '');
  const m = full.match(/\s*\[Contexto UI:([^\]]*)\]\s*$/i);
  let panelOpen = null;
  if (m) {
    const inner = m[1] || '';
    const pm = inner.match(/panel_modal_abierto\s*=\s*([^,\]]+)/i);
    if (pm) {
      const id = String(pm[1] || '')
        .trim()
        .toLowerCase();
      if (id === 'part' || id === 'pros' || id === 'who' || id === 'news' || id === 'map') panelOpen = id;
    }
  }
  const userText = stripUiContextSuffix(full);
  return { userText, panelOpen };
}

/**
 * @param {string} rawText
 * @param {'pros'|'part'|null|undefined} sectionIdHint
 * @param {'pros'|'part'|'who'|'news'|'map'|null|undefined} [openPanelId] Panel ya abierto (cliente); en el proxy suele inferirse del anexo [Contexto UI:…] en `rawText`.
 */
export function inferHubDetailFromUserMessage(rawText, sectionIdHint, openPanelId = null) {
  const { userText, panelOpen: parsedPanel } = splitUserMessageAndUiContext(rawText);
  const panelFallback =
    openPanelId != null && String(openPanelId).trim() !== ''
      ? String(openPanelId).trim().toLowerCase()
      : parsedPanel;
  const t = foldHub(userText);
  if (!t) return { sectionId: null, detailSlug: null };

  if (sectionIdHint === 'pros') {
    return { sectionId: 'pros', detailSlug: matchProsDetail(t) };
  }
  if (sectionIdHint === 'part') {
    return { sectionId: 'part', detailSlug: matchPartDetail(t) };
  }

  const p = matchPartDetail(t);
  const r = matchProsDetail(t);
  if (p && !r) return { sectionId: 'part', detailSlug: p };
  if (r && !p) return { sectionId: 'pros', detailSlug: r };
  if (p && r) {
    if (panelFallback === 'part') return { sectionId: 'part', detailSlug: p };
    if (panelFallback === 'pros') return { sectionId: 'pros', detailSlug: r };
    if (/\b(hogar|casa|particular|bricolaje|sal[oó]n|dormitorio)\b/.test(t)) return { sectionId: 'part', detailSlug: p };
    if (/\b(profesional|obra|industrial|aplicador|constructora)\b/.test(t)) return { sectionId: 'pros', detailSlug: r };
    return { sectionId: null, detailSlug: null };
  }
  // Hub Part ya abierto: STT deja solo basura tipo «demigo» / «te digo» (mal oído «técnico»)
  if (panelFallback === 'part' && t.length <= 42) {
    if (/\b(demigo|de\s*migo|te\s*digo|digo\s+bien|el\s*migo|mego)\b/.test(t)) return { sectionId: 'part', detailSlug: 'tech_personal' };
  }
  return { sectionId: null, detailSlug: null };
}

/**
 * Vista solo historia: subir al inicio del scroll, sin panel (intent `open_page` en cliente/proxy).
 * @param {string} rawText
 * @returns {'open_page'|null}
 */
export function inferPageResetFromUserMessage(rawText) {
  const s = foldHub(stripUiContextSuffix(rawText));
  if (!s) return null;
  if (/\b(vuelve|volver|volvamos|sube|subir)\s+al\s+inicio\b/.test(s)) return 'open_page';
  if (/\b(vuelve|volver)\s+(arriba|el\s+scroll)\b/.test(s)) return 'open_page';
  if (/\b(scroll|desplaz)\w*\s+(al\s+)?inicio\b/.test(s)) return 'open_page';
  if (/\b(principio|inicio)\s+de\s+la\s+(historia|p[aá]gina|web)\b/.test(s)) return 'open_page';
  if (/\b(mu[eé]strame|ver|ense[nñ]ame)\s+la\s+(web|p[aá]gina)(\s+entera|\s+completa)?\b/.test(s)) return 'open_page';
  if (/\b(abre|abrir)\s+la\s+(web|p[aá]gina)(\s+principal)?\b/.test(s)) return 'open_page';
  return null;
}

/**
 * «Atrás» / volver / retroceder: en voz o chat debe cerrar vista + asistente (equiv. a `close_all` en cliente/proxy).
 * Excluye frases que ya son `open_page` (vuelve al inicio de la historia, etc.).
 */
export function inferHubBackStepFromUserMessage(rawText) {
  if (inferPageResetFromUserMessage(rawText)) return false;
  const t = foldHub(stripUiContextSuffix(rawText));
  if (!t) return false;
  const u = t.replace(/^[¡¿\s,]+/g, '').replace(/[.!?,;:…]+$/g, '').trim();
  if (!u || u.length > 44) return false;
  if (/^(atras|volver|vuelve|vuelva|retrocede|retroceder)(\s+atras)?(\s+por\s+favor)?$/.test(u)) return true;
  if (/^(vale|ok|s[ií]|listo)[,.]?\s+(atras|volver|retrocede|retroceder)(\s+por\s+favor)?$/.test(u)) return true;
  if (/^(vuelve|vuelva|volver)\s+atras$/.test(u)) return true;
  if (/^[!¡\s]*(atras|retrocede)([!?.…\s]*)$/i.test(u)) return true;
  if (/\batras\b/.test(u) && u.length <= 20) return true;
  if (/^(back|go\s+back)(\s+please)?$/.test(u)) return true;
  if (/^go\s+back$/.test(u)) return true;
  return false;
}

/** Solo inferir cierre desde el texto del *bot* si el usuario pidió cerrar / limpiar / atrás (evita «Limpio la pantalla» con JSON roto). */
export function userMessageAllowsCloseInferenceFromAssistantReply(rawText) {
  if (!rawText || !String(rawText).trim()) return true;
  if (inferHubBackStepFromUserMessage(rawText)) return true;
  const t = foldHub(stripUiContextSuffix(rawText));
  if (!t) return true;
  const compact = t.replace(/\s+/g, '');
  if (/cerrar?todo|cierratodo|cierra\s*todo|cerrar\s*todo/.test(compact)) return true;
  if (/\b(cierra|quita|limpia)\s+todo\b/.test(t)) return true;
  if (/\b(limpia|vac[ií]a)\s+(la\s*)?(pantalla|todo)\b/.test(t)) return true;
  if (/^\s*(quita\s+todo|limpia\s*todo)\s*\.?\s*$/i.test(String(rawText).trim())) return true;
  if (/\bcierro\s+eso\b/.test(t)) return true;
  if (
    /\b(ci[eé]rralo|quita\s+eso|quitalo|fuera|esc[oó]ndelo|cierra\s+la\s+ventana|cerrar\s+la\s+ventana|cierra\s+el\s+panel|cerrar\s+el\s+panel)\b/.test(t)
  )
    return true;
  if (/^[!¡\s]*cierra(r)?[!?.\s]*$/i.test(String(rawText).trim())) return true;
  if (/^(cierra|cerrar|ci[eé]rralo)(\s|$)/.test(t) && t.length < 40) return true;
  if (/\b(close\s+that|close\s+it|close\s+the\s+panel|close\s+everything|clear\s+(the\s+)?screen)\b/.test(t)) return true;
  if (/^(close|shut)(\s+it)?[!?.\s]*$/i.test(String(rawText).trim()) && t.length < 36) return true;
  return false;
}

export function inferGreetingFromUserMessage(rawText) {
  const t = foldHub(stripUiContextSuffix(rawText));
  if (!t || t.length > 140) return false;
  const oneLine = t
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[¡¿]+/, '')
    .replace(/\.{2,}|…+/g, '.')
    .replace(/\.\s*$/g, '')
    .trim();
  if (/^(buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches)([.!?,…\s]*)?$/i.test(oneLine)) return true;
  if (/^buenas([.!?,…\s]*)?$/i.test(oneLine) && oneLine.length < 24) return true;
  if (/^(hola(\s*,?\s*hola)*)([.!?,…\s]*)?$/i.test(oneLine)) return true;
  if (/^(hey|ey|saludos)\b/.test(oneLine) && oneLine.length < 36) return true;
  if (/^qu[eé]\s+tal\b/.test(oneLine) && oneLine.length < 36) return true;
  if (/^(good\s+(morning|afternoon|evening|night))([.!?,…\s]*)?$/i.test(oneLine)) return true;
  if (/^good\s+day([.!?,…\s]*)?$/i.test(oneLine)) return true;
  if (/^(hello|hi)\b([.!?,…\s]*)?$/i.test(oneLine) && oneLine.length < 36) return true;
  if (/^howdy\b/.test(oneLine) && oneLine.length < 24) return true;
  return false;
}

export function assistantGreetingReplyForUserMessage(rawText) {
  const loc = inferAssistantLocale(rawText);
  const t = foldHub(stripUiContextSuffix(rawText));

  if (loc === 'en') {
    const r = stripUiContextSuffix(String(rawText ?? '')).trim();
    if (/\bgood\s+morning\b/i.test(r)) return "Good morning — I'm the TEANMUR assistant. How can I help you?";
    if (/\bgood\s+afternoon\b/i.test(r)) return "Good afternoon — I'm the TEANMUR assistant. How can I help you?";
    if (/\bgood\s+evening\b/i.test(r)) return "Good evening — I'm the TEANMUR assistant. How can I help you?";
    if (/\bgood\s+night\b/i.test(r)) return "Good night — I'm the TEANMUR assistant. How can I help you?";
    return "Hi — I'm the TEANMUR assistant. How can I help you?";
  }
  if (loc === 'fr') {
    if (/\bbonjour\b/i.test(t)) return 'Bonjour, je suis l’assistant TEANMUR. En quoi puis-je vous aider ?';
    if (/\bbonsoir\b/i.test(t)) return 'Bonsoir, je suis l’assistant TEANMUR. En quoi puis-je vous aider ?';
    return 'Salut, je suis l’assistant TEANMUR. En quoi puis-je vous aider ?';
  }
  if (loc === 'de') {
    if (/\bguten\s+morgen\b/.test(t)) return 'Guten Morgen, ich bin der TEANMUR-Assistent. Womit kann ich helfen?';
    if (/\bguten\s+abend\b/.test(t)) return 'Guten Abend, ich bin der TEANMUR-Assistent. Womit kann ich helfen?';
    if (/\bguten\s+tag\b/.test(t)) return 'Guten Tag, ich bin der TEANMUR-Assistent. Womit kann ich helfen?';
    return 'Hallo, ich bin der TEANMUR-Assistent. Womit kann ich helfen?';
  }
  if (loc === 'it') {
    if (/\bbuongiorno\b/.test(t)) return 'Buongiorno, sono l’assistente TEANMUR. Come posso aiutarti?';
    if (/\bbuonasera\b/.test(t)) return 'Buonasera, sono l’assistente TEANMUR. Come posso aiutarti?';
    return 'Ciao, sono l’assistente TEANMUR. Come posso aiutarti?';
  }
  if (loc === 'pt') {
    if (/\bbom\s+dia\b/.test(t)) return 'Bom dia, sou o assistente TEANMUR. Em que posso ajudar?';
    if (/\bboa\s+tarde\b/.test(t)) return 'Boa tarde, sou o assistente TEANMUR. Em que posso ajudar?';
    if (/\bboa\s+noite\b/.test(t)) return 'Boa noite, sou o assistente TEANMUR. Em que posso ajudar?';
    return 'Olá, sou o assistente TEANMUR. Em que posso ajudar?';
  }
  if (loc === 'ru') {
    return 'Здравствуйте, я ассистент TEANMUR. Чем могу помочь?';
  }
  if (loc === 'ja') {
    return 'こんにちは、TEANMURのアシスタントです。何かお手伝いできることはありますか？';
  }
  if (loc === 'zh') {
    return '您好，我是 TEANMUR 助手。需要我帮您做什么？';
  }
  if (loc === 'ar') {
    return 'مرحبًا، أنا مساعد تيانمور TEANMUR. كيف يمكنني مساعدتك؟';
  }

  if (/\bbuenas\s+tardes\b/.test(t)) return 'Buenas tardes, soy el asistente de TEANMUR. ¿En qué puedo ayudarte?';
  if (/\bbuenas\s+noches\b/.test(t)) return 'Buenas noches, soy el asistente de TEANMUR. ¿En qué puedo ayudarte?';
  if (/\bbuenos\s+d[ií]as\b/.test(t)) return 'Buenos días, soy el asistente de TEANMUR. ¿En qué puedo ayudarte?';
  if (/^buenas\b/.test(t) && t.length < 28) return 'Buenas, soy el asistente de TEANMUR. ¿En qué puedo ayudarte?';
  return 'Hola, soy el asistente de TEANMUR. ¿En qué puedo ayudarte?';
}

/** Saludo sin ningún otro pedido (sección, hub, cierre, scroll): no abrir paneles por el eco del bot con «TEANMUR». */
export function userMessageIsGreetingOnlyNoOtherIntent(rawText, openPanelId = null) {
  if (!inferGreetingFromUserMessage(rawText)) return false;
  if (inferSectionFromUserMessage(rawText)) return false;
  if (inferPageResetFromUserMessage(rawText)) return false;
  if (userMessageAllowsCloseInferenceFromAssistantReply(rawText)) return false;
  if (inferHubBackStepFromUserMessage(rawText)) return false;
  const hub = inferHubDetailFromUserMessage(rawText, null, openPanelId);
  if (hub.sectionId && hub.detailSlug) return false;
  return true;
}

/** Cuando el intent queda unknown y el mensaje del usuario no es un saludo: respuesta amable (no cierres ni «limpia»). */
export const ASSISTANT_DID_NOT_UNDERSTAND_REPLY =
  'No lo he entendido del todo. Si buscas pintura para casa, para obra, novedades o contacto, dímelo con una frase y te guío.';

/** El modelo repitió la transcripción del usuario en lugar de una frase de asistente. */
export function transcriptReplyEchoesUser(reply, userRaw) {
  const a = foldHub(stripUiContextSuffix(String(userRaw ?? '')))
    .replace(/\s+/g, ' ')
    .trim();
  const b = foldHub(String(reply ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
  return a.length >= 5 && b.length >= 5 && a === b;
}
