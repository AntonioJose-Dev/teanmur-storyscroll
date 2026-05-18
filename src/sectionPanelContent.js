/**
 * sectionPanelContent.js
 * ──────────────────────
 * Contenido completo de cada sección para el panel lateral.
 *
 * ── Cómo editar o añadir contenido ───────────────────────────────────────────
 *
 * • Cambiar texto de intro o título: edita los campos directamente aquí.
 *
 * • Profesionales ('pros') y Particulares ('part') usan type 'serviceHub':
 *     Cada opción: { id, icon, title, body, ctaLabel, ctaHref }.
 *     Los id son estables (p. ej. para la IA); no los cambies sin actualizar hubIntentMap.js.
 *
 * • Añadir una novedad a 'news':
 *     Añade un objeto al array `items`:
 *     { title: 'Título', date: 'Mes Año', description: 'Texto.' }
 *
 * • Contacto (`map`): type `contactStores` con array `stores` (id, name, address, phone, opcional phoneExtra, email, hours, lat, lng, mapsUrl).
 *
 * • El panel tiene scroll interno propio — puedes añadir tantos items
 *   como quieras sin preocuparte por el espacio.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PANEL_CONTENT = {

  // ── Quiénes somos ──────────────────────────────────────────────────────────
  who: {
    type: 'brand',
    title: 'TEANMUR',
    subtitle: 'Pinturas & Decoración',
    body: [
      'Fundada en Murcia en 2003, TEANMUR nació con un objetivo claro: llevar la calidad industrial a cada proyecto, grande o pequeño.',
      'Más de 20 años de experiencia en pinturas técnicas, decorativas e industriales nos avalan. Trabajamos con constructoras, estudios de arquitectura, aplicadores profesionales y particulares que exigen el mejor resultado.',
      'Calidad sin concesiones. Asesoramiento real. Compromiso con cada obra.',
    ],
    values: [
      'Calidad sin compromiso',
      'Asesoramiento técnico especializado',
      'Compromiso medioambiental',
      'Fabricación propia en Murcia',
    ],
  },

  // ── Profesionales ──────────────────────────────────────────────────────────
  pros: {
    type: 'serviceHub',
    title: 'Soluciones profesionales',
    intro: 'Ventajas pensadas para constructoras, estudios y aplicadores: agilidad, formación y acompañamiento técnico en cada fase del proyecto.',
    image: 'public/profesionales.webp',
    options: [
      {
        id: 'express',
        icon: '⚡',
        title: 'Entrega exprés en 1 hora',
        body: '¿Obra parada por falta de material? Priorizamos tu pedido y lo preparamos para recogida o envío exprés en Murcia y alrededores cuando haya stock disponible.',
        ctaLabel: 'Pedir entrega urgente',
        ctaHref: 'tel:+34968967450',
      },
      {
        id: 'tech_specialist',
        icon: '🛠️',
        title: 'Asesoramiento técnico especializado',
        body: 'Fichas técnicas, compatibilidad entre capas, condiciones de aplicación y normativa: nuestro equipo resuelve dudas de obra con criterio de fabricante.',
        ctaLabel: 'Consultar técnico',
        ctaHref: 'tel:+34968967450',
      },
      {
        id: 'volume',
        icon: '📦',
        title: 'Descuentos exclusivos por volumen',
        body: 'Proyectos recurrentes o grandes superficies merecen un trato comercial a medida. Te proponemos tarifas escalonadas según volumen y fidelidad.',
        ctaLabel: 'Solicitar tarifa',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Tarifa%20por%20volumen',
      },
      {
        id: 'trends',
        icon: '✨',
        title: 'Acceso a nuevos productos y tendencias',
        body: 'Anticipamos lanzamientos y gamas especiales para que tu empresa pruebe acabados antes que la competencia y puedas presupuestar con ventaja.',
        ctaLabel: 'Recibir novedades',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Novedades%20profesionales',
      },
      {
        id: 'training',
        icon: '🎓',
        title: 'Capacitación y curso técnico',
        body: 'Sesiones sobre producto, aplicación y resolución de incidencias para equipos de obra y tiendas colaboradoras. Contenido práctico, sin relleno.',
        ctaLabel: 'Apuntarse a formación',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Formaci%C3%B3n%20t%C3%A9cnica',
      },
      {
        id: 'warranty',
        icon: '🛡️',
        title: 'Soporte postventa y garantía extendida',
        body: 'Te acompañamos después de la venta: seguimiento de incidencias, visitas técnicas coordinadas y condiciones de garantía claras por familia de producto.',
        ctaLabel: 'Activar soporte',
        ctaHref: 'tel:+34968967450',
      },
    ],
  },

  // ── Particulares ───────────────────────────────────────────────────────────
  part: {
    type: 'serviceHub',
    title: 'Para tu hogar',
    intro: 'Servicios que acercan el acabado profesional a tu salón, dormitorio o fachada: color, asesoramiento y tranquilidad de principio a fin.',
    image: 'public/para-tu-hogar.webp',
    options: [
      {
        id: 'tech_personal',
        icon: '💬',
        title: 'Asesoramiento técnico personalizado',
        body: 'Te orientamos según habitación, luz natural y uso: tipo de pintura, acabado y preparación de superficie para que el resultado dure años.',
        ctaLabel: 'Pedir cita de asesoramiento',
        ctaHref: 'tel:+34968967450',
        image: 'public/asesoramiento-tecnico.jpg',
      },
      {
        id: 'color_sample',
        icon: '🎨',
        title: 'Muestra de color gratuita',
        body: 'Lleva a casa una muestra antes de decidir. Así ves el tono real en tu pared y evitas sorpresas con la luz de tu estancia.',
        ctaLabel: 'Reservar muestra',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Muestra%20de%20color',
        image: 'public/muestras-de-color.jpg',
      },
      {
        id: 'custom_paint',
        icon: '🖌️',
        title: 'Aplicación de pintura a medida',
        body: 'Si prefieres delegar, coordinamos aplicación con acabados TEANMUR y tiempos acordados. Ideal para techos altos o estancias difíciles.',
        ctaLabel: 'Solicitar presupuesto',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Aplicaci%C3%B3n%20a%20medida',
        image: 'public/aplicacion-a-medida.jpg',
      },
      {
        id: 'diy_courses',
        icon: '🔧',
        title: 'Cursos y talleres de bricolaje y pintura',
        body: 'Talleres para aprender a preparar paredes, esquinas limpias y trucos de rodillo y pincel. Grupos reducidos y material de demostración.',
        ctaLabel: 'Apuntarme a un taller',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Taller%20bricolaje',
        image: 'public/talleres-bricolaje.webp',
      },
      {
        id: 'delivery',
        icon: '🚚',
        title: 'Entrega a domicilio',
        body: 'Recibe botes y accesorios en casa con franja concertada. Comodidad para reformas en las que no quieres cargar con el peso del pedido.',
        ctaLabel: 'Consultar zonas de entrega',
        ctaHref: 'tel:+34968967450',
        image: 'public/entrega-domicilio.png',
      },
      {
        id: 'satisfaction',
        icon: '⭐',
        title: 'Garantía de satisfacción',
        body: 'Si el resultado no cumple lo acordado en producto y aplicación según ficha técnica, buscamos solución contigo. Tu tranquilidad importa.',
        ctaLabel: 'Saber más',
        ctaHref: 'mailto:central@pinturasteanmur.com?subject=Garant%C3%ADa%20de%20satisfacci%C3%B3n',
        image: 'public/garantia-satisfaccion.jpg',
      },
    ],
  },

  // ── Novedades ──────────────────────────────────────────────────────────────
  news: {
    type: 'news',
    title: 'Novedades',
    items: [
      {
        title: 'Nueva gama ECO — bajo en VOC',
        date: 'Mayo 2025',
        description: 'Lanzamos nuestra línea más sostenible: pinturas de base acuosa con menos del 1% de compuestos orgánicos volátiles, sin renunciar al acabado profesional.',
      },
      {
        title: 'TEANMUR Color Studio: 400 tonos',
        date: 'Marzo 2025',
        description: 'Ampliamos la carta con 120 nuevos tonos inspirados en arquitectura mediterránea y tendencias europeas de diseño interior.',
      },
      {
        title: 'Asesoramiento técnico online gratuito',
        date: 'Enero 2025',
        description: 'Nuestro equipo técnico ya disponible por videollamada. Consulta gratuita para proyectos y pedidos superiores a 500 €.',
      },
    ],
  },

  // ── Contacto ───────────────────────────────────────────────────────────────
  map: {
    type: 'contactStores',
    title: 'Contacto',
    intro:
      'Tres delegaciones en la Región de Murcia: Murcia, Cartagena y Cieza. Elige una para ver dirección, teléfonos, email y ruta en el mapa.',
    stores: [
      {
        id: 'murcia',
        name: 'TEANMUR Murcia',
        address: 'Av. Teniente Montesinos, 21B\n(Frente a torre Godoy)\n30009 Murcia',
        phone: '+34 968 967 450',
        phoneExtra: '+34 620 285 096',
        email: 'central@pinturasteanmur.com',
        hours: 'Lun–Vie 9:00–14:00 y 16:30–19:30 · Sáb 9:30–13:30 (consultar)',
        lat: 37.9732,
        lng: -1.1693,
        mapsUrl:
          'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent('TEANMUR Av. Teniente Montesinos 21B Murcia'),
      },
      {
        id: 'cartagena',
        name: 'TEANMUR Cartagena',
        address: 'Avenida Luxemburgo 54\n30353 Pol. Ind. Cabezo Beaza\nCartagena, Murcia',
        phone: '+34 968 562 109',
        phoneExtra: '+34 620 285 096',
        email: 'cartagena@pinturasteanmur.com',
        hours: 'Lun–Vie 9:00–14:00 y 16:30–19:30 · Sáb 9:30–13:30 (consultar)',
        lat: 37.6359,
        lng: -0.9792,
        mapsUrl:
          'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent('TEANMUR Avenida Luxemburgo 54 Cabezo Beaza Cartagena'),
      },
      {
        id: 'cieza',
        name: 'TEANMUR Cieza',
        address: 'Ctra. de Madrid Nº 1\n(Frente a Mercadona)\n30530 Cieza, Murcia',
        phone: '+34 968 074 560',
        phoneExtra: '+34 608 772 529',
        email: 'cieza@pinturasteanmur.com',
        hours: 'Lun–Vie 9:00–14:00 y 16:30–19:30 · Sáb 9:30–13:30 (consultar)',
        lat: 38.2388,
        lng: -1.4194,
        mapsUrl:
          'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent('TEANMUR Ctra. de Madrid 1 Cieza Mercadona'),
      },
    ],
  },

};
