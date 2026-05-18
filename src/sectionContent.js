/**
 * sectionContent.js
 * ─────────────────
 * Fuente de datos para las preview cards de cada mancha.
 *
 * Para editar el contenido de cualquier sección, modifica solo este archivo.
 * No toques marksUI.js ni marks.js.
 *
 * Campos por sección:
 *   metaLabel       → etiqueta pequeña en la parte superior (ej. "Empresa")
 *   title           → titular principal de la tarjeta
 *   shortDescription → 2–3 líneas de texto descriptivo
 *   ctaLabel        → texto del botón de acción
 *   ctaHref         → URL o ancla destino del botón (null = solo log por ahora)
 */

export const SECTION_CONTENT = {

  who: {
    metaLabel:        'Empresa',
    title:            'Quiénes somos',
    shortDescription: 'Más de 20 años fabricando pinturas con exigencia industrial. Detrás de cada bote TEANMUR hay un equipo que no acepta medias tintas.',
    ctaLabel:         'Conocer el equipo',
    ctaHref:          '#quienes-somos',
  },

  pros: {
    metaLabel:        'Profesionales',
    title:            'Para el sector',
    shortDescription: 'Catálogo técnico completo para constructoras, estudios y aplicadores. Rendimiento garantizado, soporte especializado y entrega a obra.',
    ctaLabel:         'Ver catálogo técnico',
    ctaHref:          '#profesionales',
  },

  part: {
    metaLabel:        'Particulares',
    title:            'Para tu hogar',
    shortDescription: 'Acabados profesionales sin experiencia previa. Pinturas de calidad real, fáciles de aplicar y con colores que duran.',
    ctaLabel:         'Ver productos',
    ctaHref:          '#particulares',
  },

  news: {
    metaLabel:        'Actualidad',
    title:            'Novedades',
    shortDescription: 'Nueva gama ecológica bajo en VOC ya disponible. Comprometidos con el medioambiente sin renunciar al resultado.',
    ctaLabel:         'Ver todas las noticias',
    ctaHref:          '#novedades',
  },

  map: {
    metaLabel:        'Contacto',
    title:            'Encuéntranos',
    shortDescription: 'Estamos en Valencia. Visítanos en tienda, llámanos o escríbenos — respondemos en menos de 24 h.',
    ctaLabel:         'Cómo llegar',
    ctaHref:          'https://maps.google.com/?q=TEANMUR+Valencia',
  },

};
