// ============================================================================
// MOBILIARIO SUGERIDO DESDE EL PROGRAMA DEL PLANO
//
// Demo-safe: traduce semántica del plano a mobiliario VISUAL. No cotiza, no
// crea economía y no convierte sugerencias en partidas comerciales.
// ============================================================================
import { personasEnSala, puestosPorIsla, rolDe } from './programaDelPlano.js';

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cap = (n, lo = 0, hi = 48) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const sinPax = (s = '') => norm(s).replace(/\s*\(\s*\d+\s*(?:pax|personas?|usuarios?|puestos?)\s*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

export function paxDeNombre(nombre = '') {
  const s = norm(nombre);
  const m = /(\d+)\s*(?:pax|personas?|usuarios?|puestos?)\b/.exec(s);
  return m ? cap(+m[1], 1, 48) : 0;
}

function esIsla(a) {
  return /^\s*(?:isla|bench|banca)\b/i.test(String(a?.nombre || ''));
}

function baseIsla(nombre = '') {
  return sinPax(nombre).replace(/^\s*(?:isla|bench|banca)\s+/i, '').trim();
}

function esOperativoNombrado(a) {
  const n = norm(a?.nombre);
  return /(^|\b)(apartado|operativo|open\s*space|workstation|zona\s*operativa)(\b|$)/.test(n);
}

/**
 * Corrige semántica que el lector puede dejar implícita:
 * - "OPERATIVO/APARTADO (8 PAX)" = cuarto operativo.
 * - "Isla OPERATIVO" = zona interna de ese cuarto, NO otro cuarto.
 * - hereda los PAX del padre cuando la isla no los trae escritos.
 */
export function normalizarAreasPrograma(areas = []) {
  const lista = (Array.isArray(areas) ? areas : []).filter(Boolean).map((a) => ({ ...a }));
  const padres = lista.filter((a) => !esIsla(a));

  for (const a of lista) {
    const paxPropio = Number(a?.puestos) > 0 ? cap(a.puestos, 1, 48) : paxDeNombre(a?.nombre);
    if (paxPropio) a.puestos = paxPropio;
    // El lector real del golden llamó APARTADO 1/2/3 a las zonas operativas.
    // Con PAX explícitos no puede caer a privado/general: es un área de trabajo.
    if (paxPropio && esOperativoNombrado(a) && !/junta|consejo|privad|direc|recep/.test(norm(a?.nombre))) {
      a.tipo = 'open';
    }
    if (!esIsla(a)) continue;

    const buscado = baseIsla(a.nombre);
    const padre = padres.find((p) => {
      const np = sinPax(p.nombre);
      return np === buscado || np.endsWith(buscado) || buscado.endsWith(np);
    });
    if (!padre) continue;

    a.dentroDe = padre.nombre;
    a.tipo = 'open';
    const paxPadre = Number(padre.puestos) > 0 ? padre.puestos : paxDeNombre(padre.nombre);
    if (!(Number(a.puestos) > 0) && paxPadre) a.puestos = paxPadre;
    padre.contiene = Math.max(1, Number(padre.contiene) || 0);
    if (!padre.tipo) padre.tipo = 'open';
  }
  return lista;
}

const groupId = (a, kind = 'grupo') => {
  const base = norm(a?.nombre || 'zona').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'zona';
  return `fg-${kind}-${base}`;
};

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
  if (Number.isFinite(Number(a?.puestos)) && Number(a.puestos) > 0) return cap(a.puestos, 1, 48);
  const pax = paxDeNombre(a?.nombre);
  if (pax) return pax;
  return cap(puestosPorIsla(a, 1500), 2, 16);
}

function esServicioDuro(a) {
  const n = norm(a?.nombre);
  return /sanitari|bano|wc|toilet|site|\bit\b|rack|ducto|escaler/.test(n);
}
function esArchivo(a) { return /archivo|apoyo|bodega|almacen|storage/.test(norm(a?.nombre)); }
function esCoffee(a) { return /coffee|print|cafe|copiadora|impresion/.test(norm(a?.nombre)); }

/**
 * @param {Array} areas áreas canónicas en METROS (areasM)
 * @param {Object} opts { linea } — hoy sólo `applt` está habilitada en demo.
 * @returns {Array} partidas visuales SUGERIDAS, costo/precio = 0
 */
export function partidasSugeridasDeAreas(areas = [], opts = {}) {
  const linea = opts.linea || 'applt';
  if (linea !== 'applt') return [];

  const lista = normalizarAreasPrograma(areas);
  const out = [];
  let seq = 0;
  const add = (a, nombre, cantidad, w, d, extra = {}) => {
    seq += 1;
    out.push(partida(`${seq}`, `${nombre} · ${a.nombre || 'Zona'}`, cantidad, w, d, {
      zonaSugerida: a.nombre || null,
      ...extra,
    }));
  };

  const padresConIsla = new Set(lista.filter(esIsla).map((a) => a.dentroDe).filter(Boolean));

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
      const fg = groupId(a, 'recepcion');
      add(a, 'Mostrador de recepción', 1, 2000, 700, { functional_group_id: fg, relation_role: 'ANCHOR_RECEPTION' });
      add(a, 'Silla operativa recepción', 1, 600, 600, { functional_group_id: fg, relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_RECEPTION', max_anchor_distance_mm: 1400 });
      add(a, 'Silla de visita recepción', 2, 600, 600, { functional_group_id: fg, relation_role: 'VISITOR_SEAT', anchor_role: 'ANCHOR_RECEPTION', max_anchor_distance_mm: 2600 });
      continue;
    }

    if (rol === 'juntas') {
      const m2 = Math.max(0, Number(a.ancho || 0) * Number(a.largo || 0));
      const explicitas = puestosDeArea(a);
      const personas = cap(explicitas || personasEnSala(m2), 4, 16);
      const mesaW = personas >= 14 ? 4200 : personas >= 12 ? 3800 : personas >= 10 ? 3400 : personas >= 8 ? 3000 : personas >= 6 ? 2600 : 2200;
      const fg = groupId(a, 'juntas');
      add(a, `Mesa de juntas ${personas} personas`, 1, mesaW, 1200, { functional_group_id: fg, relation_role: 'ANCHOR_MEETING', user_capacity: personas });
      add(a, 'Silla de juntas', personas, 600, 600, { functional_group_id: fg, relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', max_anchor_distance_mm: 1400 });
      if (m2 >= 18) add(a, 'Credenza de sala de juntas', 1, 1600, 500, { functional_group_id: fg, relation_role: 'SUPPORT_STORAGE', anchor_role: 'ANCHOR_MEETING', max_anchor_distance_mm: 3500 });
      continue;
    }

    if (rol === 'privado') {
      const fg = groupId(a, 'privado');
      add(a, 'Escritorio directivo', 1, 1800, 800, { functional_group_id: fg, relation_role: 'ANCHOR_DESK' });
      add(a, 'Silla directiva', 1, 650, 650, { functional_group_id: fg, relation_role: 'EXECUTIVE_SEAT', anchor_role: 'ANCHOR_DESK', max_anchor_distance_mm: 1400 });
      add(a, 'Silla de visita', 2, 600, 600, { functional_group_id: fg, relation_role: 'VISITOR_SEAT', anchor_role: 'ANCHOR_DESK', max_anchor_distance_mm: 2600 });
      add(a, 'Credenza dirección', 1, 1200, 500, { functional_group_id: fg, relation_role: 'SUPPORT_STORAGE', anchor_role: 'ANCHOR_DESK', max_anchor_distance_mm: 3500 });
      continue;
    }

    if (rol === 'lounge') {
      add(a, 'Mesa de colaboración', 1, 1200, 900);
      add(a, 'Sillón lounge', 4, 700, 700);
      continue;
    }

    if (padresConIsla.has(a.nombre) && !esIsla(a)) continue;

    const puestos = puestosDeArea(a);
    if (puestos > 0) {
      const columnas = Math.max(1, Math.ceil(puestos / 2));
      const anchoBench = columnas * 1500;
      const fg = groupId(a, 'workstation');
      add(a, `Banca doble APP LT 1.50 · ${puestos} usuarios · ocupa ${(anchoBench / 1000).toFixed(2)} × 1.20 m`, 1, anchoBench, 1200, {
        lineaSugerida: 'applt', usuarios: puestos,
        functional_group_id: fg, relation_role: 'ANCHOR_WORKSTATION',
      });
      add(a, 'Silla operativa · WIN', puestos, 600, 600, {
        lineaSugerida: 'applt', functional_group_id: fg, relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', max_anchor_distance_mm: 1400,
      });
      add(a, 'Gaveta rodante APP LT', puestos, 400, 580, {
        lineaSugerida: 'applt', functional_group_id: fg, relation_role: 'UNDERDESK_STORAGE', anchor_role: 'ANCHOR_WORKSTATION', max_anchor_distance_mm: 900,
      });
    }
  }

  return out;
}

export function firmaAreasParaSugeridos(areas = []) {
  return JSON.stringify(normalizarAreasPrograma(areas).map((a) => ({
    n: a?.nombre || '', t: a?.tipo || '', p: Number(a?.puestos) || 0,
    a: Math.round((Number(a?.ancho) || 0) * 1000),
    l: Math.round((Number(a?.largo) || 0) * 1000),
    d: a?.dentroDe || '', c: Number(a?.contiene) || 0,
  })));
}
