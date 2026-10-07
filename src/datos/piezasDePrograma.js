// ============================================================================
// MOBILIARIO SUGERIDO DESDE EL PROGRAMA DEL PLANO
//
// Demo-safe: traduce semántica del plano a mobiliario VISUAL. No cotiza, no
// crea economía y no convierte sugerencias en partidas comerciales.
// ============================================================================
import { personasEnSala, puestosPorIsla, rolDe } from './programaDelPlano.js';
import { inferirDestinoPartida, marcarDestinoPartida } from './destinoAcomodo.js';
import { resolverOperativos } from './resolverPrograma.js';

// Geometría REAL del bench operativo desde el Product Resolver (módulo canónico
// op-*). Reemplaza la fantasía ceil(n/2)*1500 (que daba 7.50 m para 10). Si el
// resolver no cubre la línea, devuelve null y el llamador usa la heurística
// visual NO autoritativa como último recurso.
function geometriaBenchReal(puestos) {
  const res = resolverOperativos(puestos, { linea: 'App LT' });
  const w = res.resoluciones.reduce((s, r) => s + (Number(r.w) || 0) * (r.cantidad || 1), 0);
  const d = res.resoluciones[0]?.d || 1200;
  return w > 0 ? { w, d } : null;
}

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
      // #102/#1: la geometría del bench ya NO se fabrica (ceil(n/2)*1500 daba
      // 7.50 m para 10). Viene del catálogo real (op-*). El ceil(n/2)*1500 queda
      // SÓLO como heurística visual NO autoritativa si el resolver no cubre.
      const geo = geometriaBenchReal(puestos);
      const anchoBench = geo ? geo.w : Math.max(1, Math.ceil(puestos / 2)) * 1500;
      const fondoBench = geo ? geo.d : 1200;
      const fg = groupId(a, 'workstation');
      add(a, `Banca doble APP LT · ${puestos} usuarios · ocupa ${(anchoBench / 1000).toFixed(2)} × ${(fondoBench / 1000).toFixed(2)} m`, 1, anchoBench, fondoBench, {
        lineaSugerida: 'applt', usuarios: puestos, user_capacity: puestos,
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


const cantidad = (p) => Math.max(1, Math.round(Number(p?.cantidad) || 1));

function familiaPrograma(p = {}) {
  const rr = String(p?.relation_role || '').toUpperCase();
  const n = norm(`${p?.nombre || ''} ${p?.nota || ''} ${p?.ruta || ''}`);
  const dest = inferirDestinoPartida(p);

  if (rr === 'ANCHOR_RECEPTION') return 'reception_anchor';
  if (rr === 'ANCHOR_MEETING') return 'meeting_anchor';
  if (/^ANCHOR_(?:WORKSTATION|WORK)$/.test(rr)) return 'work_anchor';
  if (/^ANCHOR_(?:DESK|PRIVATE)$/.test(rr)) return 'private_anchor';
  if (rr === 'MEETING_SEAT') return 'meeting_seat';
  if (rr === 'EXECUTIVE_SEAT') return 'private_exec_seat';
  if (rr === 'VISITOR_SEAT') return dest === 'recepcion' ? 'reception_visitor' : dest === 'juntas' ? 'meeting_visitor' : 'private_visitor';
  if (rr === 'WORK_SEAT') return dest === 'recepcion' ? 'reception_work_seat' : 'work_seat';
  if (rr === 'UNDERDESK_STORAGE') return 'underdesk_storage';
  if (rr === 'SUPPORT_STORAGE') return dest === 'juntas' ? 'meeting_storage' : dest === 'recepcion' ? 'reception_storage' : 'private_storage';

  if (/recep|mostrador/.test(n) && !/silla|asiento/.test(n)) return 'reception_anchor';
  if (/mesa/.test(n) && /junta|consejo|meeting|reunion/.test(n)) return 'meeting_anchor';
  if (/bench|banca|estacion|workstation/.test(n) && !/silla|asiento/.test(n)) return 'work_anchor';
  if (/escritorio/.test(n) && /direccion|directiv|ejecutiv|privad|gerenc/.test(n)) return 'private_anchor';
  if (/silla|asiento/.test(n)) {
    if (dest === 'juntas') return 'meeting_seat';
    if (dest === 'recepcion') return /operativ|trabajo/.test(n) ? 'reception_work_seat' : 'reception_visitor';
    if (dest === 'privado') return /directiv|ejecutiv|alpha|energy/.test(n) ? 'private_exec_seat' : 'private_visitor';
    if (dest === 'open') return 'work_seat';
  }
  if (/gaveta|pedestal|cajonera/.test(n)) return 'underdesk_storage';
  if (/credenza|archivero|guarda|librero/.test(n)) {
    if (dest === 'juntas') return 'meeting_storage';
    if (dest === 'recepcion') return 'reception_storage';
    if (dest === 'privado') return 'private_storage';
  }
  return null;
}

function excluidaPorTexto(sugerida, reales = []) {
  const fam = familiaPrograma(sugerida);
  const todo = norm(reales.map((p) => p?.nota || '').join(' | '));
  if (fam === 'reception_visitor' && /sin sillas? de espera|sin espera|no.*sillas? de espera/.test(todo)) return true;
  return false;
}

function enriquecerRealConPrograma(real, sugeridasFamilia) {
  const grupos = [...new Set(sugeridasFamilia.map((s) => s?.functional_group_id).filter(Boolean))];
  const zonas = [...new Set(sugeridasFamilia.map((s) => s?.zonaSugerida).filter(Boolean))];
  const roles = [...new Set(sugeridasFamilia.map((s) => s?.relation_role).filter(Boolean))];
  const anchors = [...new Set(sugeridasFamilia.map((s) => s?.anchor_role).filter(Boolean))];
  const maxDist = [...new Set(sugeridasFamilia.map((s) => Number(s?.max_anchor_distance_mm)).filter(Number.isFinite))];
  const out = marcarDestinoPartida(real);
  if (grupos.length !== 1) return out;
  return {
    ...out,
    functional_group_id: out.functional_group_id || grupos[0],
    ...(roles.length === 1 && !out.relation_role ? { relation_role: roles[0] } : {}),
    ...(anchors.length === 1 && !out.anchor_role ? { anchor_role: anchors[0] } : {}),
    ...(zonas.length === 1 && !out.zonaSugerida ? { zonaSugerida: zonas[0] } : {}),
    ...(maxDist.length === 1 && !Number.isFinite(Number(out.max_anchor_distance_mm))
      ? { max_anchor_distance_mm: maxDist[0] } : {}),
  };
}

/**
 * Une la cotización REAL con el programa ESPERADO del plano.
 * - Lo ya cotizado gana y conserva precio/id.
 * - Sólo agrega el DELTA faltante como SUGERIDO/noCobrar.
 * - Cuando una familia pertenece inequívocamente a una sola zona, el real hereda
 *   su grupo/zona para que sillas, mesa, escritorio, bench y apoyos viajen juntos.
 */
export function completarProgramaVisual(reales = [], sugeridas = []) {
  const realesLimpios = (Array.isArray(reales) ? reales : []).filter((p) => !p?.sugeridoPlano && !String(p?.id || '').startsWith('sug-'));
  const sug = (Array.isArray(sugeridas) ? sugeridas : []).filter(Boolean);

  const sugPorFamilia = new Map();
  for (const s of sug) {
    const fam = familiaPrograma(s);
    if (!fam) continue;
    if (!sugPorFamilia.has(fam)) sugPorFamilia.set(fam, []);
    sugPorFamilia.get(fam).push(s);
  }

  const realesEnriquecidos = realesLimpios.map((r) => {
    const fam = familiaPrograma(r);
    return fam && sugPorFamilia.has(fam) ? enriquecerRealConPrograma(r, sugPorFamilia.get(fam)) : marcarDestinoPartida(r);
  });

  const realRestante = new Map();
  for (const r of realesEnriquecidos) {
    const fam = familiaPrograma(r);
    if (!fam) continue;
    realRestante.set(fam, (realRestante.get(fam) || 0) + cantidad(r));
  }

  const faltantes = [];
  for (const s of sug) {
    if (excluidaPorTexto(s, realesEnriquecidos)) continue;
    const fam = familiaPrograma(s);
    if (!fam) { faltantes.push(s); continue; }
    const objetivo = cantidad(s);
    const disponibles = realRestante.get(fam) || 0;
    const cubiertos = Math.min(objetivo, disponibles);
    realRestante.set(fam, Math.max(0, disponibles - cubiertos));
    const faltan = objetivo - cubiertos;
    if (faltan > 0) faltantes.push({ ...s, cantidad: faltan });
  }

  return {
    reales: realesEnriquecidos,
    sugerencias: faltantes,
    partidas: [...realesEnriquecidos, ...faltantes],
    programaCompleto: faltantes.length === 0,
  };
}
