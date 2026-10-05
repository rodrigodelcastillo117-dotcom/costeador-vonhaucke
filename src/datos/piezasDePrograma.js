// ============================================================================
//  MOBILIARIO SUGERIDO DESDE EL PROGRAMA DEL PLANO
//
//  Demo-safe: convierte las zonas leídas en PARTIDAS VISUALES para Acomodo.
//  NO son partidas comerciales, NO tienen precio/costo y nunca deben emitirse.
//  Su única función es poblar el plano de forma determinista cuando el usuario
//  todavía no eligió mobiliario para cada zona.
// ============================================================================
import { personasEnSala, puestosPorIsla, rolDe } from './programaDelPlano.js';

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = (n, lo = 0, hi = 24) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

function partida(id, nombre, cantidad, w, d, extra = {}) {
  return {
    id: `sug-${id}`,
    piezaId: null,
    nombre,
    cantidad: Math.max(1, Math.round(cantidad || 1)),
    w, d,
    ruta: 'sugerido-plano',
    productoId: null,
    producto_version_id: null,
    costoUnitario: 0,
    precioUnitario: 0,
    margen: null,
    precioReal: false,
    sugerido: true,
    sugeridoPlano: true,
    noCobrar: true,
    source: 'SUGERIDO',
    ...extra,
  };
}

function puestosDeArea(a) {
  if (Number.isFinite(Number(a?.puestos)) && Number(a.puestos) > 0) return cap(a.puestos, 1, 24);
  // Respaldo conservador para un plano que reconoce la zona pero no contó puestos.
  // Nunca llenar una oficina con 40 muebles por pura superficie en una demo.
  return cap(puestosPorIsla(a, 1500), 2, 12);
}

function esServicioDuro(a) {
  const n = norm(a?.nombre);
  return /sanitari|bano|wc|toilet|site|\bit\b|rack|ducto|escaler/.test(n);
}

function esArchivo(a) {
  return /archivo|apoyo|bodega|almacen|storage/.test(norm(a?.nombre));
}

function esCoffee(a) {
  return /coffee|print|cafe|copiadora|impresion/.test(norm(a?.nombre));
}

/**
 * @param {Array} areas áreas canónicas en METROS (areasM)
 * @returns {Array} partidas visuales SUGERIDAS, costo/precio = 0
 */
export function partidasSugeridasDeAreas(areas = []) {
  const lista = Array.isArray(areas) ? areas.filter(Boolean) : [];
  const out = [];
  let seq = 0;
  const add = (a, nombre, cantidad, w, d) => {
    seq += 1;
    out.push(partida(`${seq}`, `${nombre} · ${a.nombre || 'Zona'}`, cantidad, w, d, { zonaSugerida: a.nombre || null }));
  };

  for (const a of lista) {
    if (!a || esServicioDuro(a)) continue;

    if (esArchivo(a)) {
      add(a, 'Archivero / guarda', 2, 900, 450);
      continue;
    }
    if (esCoffee(a)) {
      add(a, 'Credenza coffee / print', 1, 1800, 600);
      continue;
    }

    const rol = rolDe(a, lista);
    if (rol === 'servicio') continue;

    if (rol === 'recepcion') {
      add(a, 'Mostrador de recepción', 1, 2000, 700);
      add(a, 'Silla de visita recepción', 2, 600, 600);
      continue;
    }

    if (rol === 'juntas') {
      const m2 = Math.max(0, Number(a.ancho || 0) * Number(a.largo || 0));
      const personas = cap(personasEnSala(m2), 4, 12);
      const mesaW = personas >= 10 ? 3600 : personas >= 8 ? 3200 : personas >= 6 ? 2600 : 2200;
      add(a, `Mesa de juntas ${personas} personas`, 1, mesaW, 1200);
      add(a, 'Silla de juntas', personas, 600, 600);
      if (m2 >= 16) add(a, 'Credenza de sala de juntas', 1, 1600, 500);
      continue;
    }

    if (rol === 'privado') {
      add(a, 'Escritorio directivo', 1, 1800, 800);
      add(a, 'Silla directiva', 1, 650, 650);
      add(a, 'Silla de visita', 2, 600, 600);
      add(a, 'Credenza dirección', 1, 1200, 500);
      continue;
    }

    if (rol === 'lounge') {
      add(a, 'Mesa de colaboración', 1, 1200, 900);
      add(a, 'Sillón lounge', 4, 700, 700);
      continue;
    }

    // Open / general operativo.
    const puestos = puestosDeArea(a);
    if (puestos > 0) {
      const benches = Math.max(1, Math.ceil(puestos / 2));
      add(a, 'Bench 2 usuarios', benches, 2400, 1400);
      add(a, 'Silla operativa', puestos, 600, 600);
      // Gavetas se marcan como sugerencia de programa, pero no ocupan piso:
      // expandirPiezas las excluye automáticamente por ir bajo cubierta.
      add(a, 'Gaveta rodante', puestos, 400, 580);
    }
  }

  return out;
}

export function firmaAreasParaSugeridos(areas = []) {
  return JSON.stringify((areas || []).map((a) => ({
    n: a?.nombre || '', t: a?.tipo || '', p: Number(a?.puestos) || 0,
    a: Math.round((Number(a?.ancho) || 0) * 1000),
    l: Math.round((Number(a?.largo) || 0) * 1000),
    d: a?.dentroDe || '',
  })));
}
