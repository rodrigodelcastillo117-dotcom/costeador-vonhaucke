// ============================================================================
//  COCREAR · el ORQUESTADOR de co-creación de producto.  (contrato §9,§15-§19)
//
//  Qué es: la mezcla única de COSTEAR + COTIZAR. Toma una IDEA (texto del
//  cliente) y la lleva, paso a paso y con honestidad, por el pipeline canónico:
//
//    idea → ProjectDNA → ProductIntent → clasificación → ProductSpec(Rev)
//         → Ingeniería/BOM → CostSnapshot(costear) → Manufacturabilidad
//         → Render(RenderSpec) → Placement → Línea de Cotización(cotizar) → historia
//
//  REGLAS DURAS (del contrato):
//   - NO duplica motores: el costo lo da `motor/calculo.js` (costear), el precio
//     la política de cotización. Aquí sólo se ORQUESTA y se traza.
//   - NO inventa: lo que no se sabe queda UNKNOWN/PENDING/null explícito, nunca 0
//     ni "" ambiguos (§24). Un paso que no existe NO se finge (§16).
//   - NO certifica ingeniería ni manufacturabilidad con IA: si falta validación,
//     el estado es REQUIRES_VALIDATION y bloquea (§19).
//   - Preserva LINAJE de derivación: un especial derivado conserva su producto
//     padre, versión y change_set; nunca se cobra el estándar en silencio (§17).
//
//  Capa PURA y determinista: sin red, sin LLM. Voni (cuando actúe como tool)
//  ENRIQUECE el intent, pero el core debe poder correr y testearse solo.
// ============================================================================

import { calcular, costeoEmitible, precioUsable } from '../motor/calculo.js';

// --- Enums formales (VH-017 + §17) -----------------------------------------
export const CLASIFICACION = Object.freeze({
  LINE_PRODUCT: 'LINE_PRODUCT',                   // de catálogo, sin cambios
  CONFIGURED_LINE_PRODUCT: 'CONFIGURED_LINE_PRODUCT', // catálogo + opción permitida (color)
  DERIVED_SPECIAL: 'DERIVED_SPECIAL',             // deriva de un padre con cambios reales
  NEW_SPECIAL: 'NEW_SPECIAL',                      // nuevo desde cero (sin padre)
});

export const COST_STATUS = Object.freeze({
  KNOWN: 'KNOWN',                     // todo costeado con precio real
  ESTIMATED: 'ESTIMATED',             // costeado con precioBase (estimado)
  PENDING_PRICE: 'PENDING_PRICE',     // material existe, sin precio usable
  PENDING_MATERIAL: 'PENDING_MATERIAL', // material no está en catálogo
  UNKNOWN: 'UNKNOWN',                 // sin BOM / no se puede costear aún
  NOT_APPLICABLE: 'NOT_APPLICABLE',   // excluido por decisión
});

export const ENG_STATUS = Object.freeze({
  NONE: 'NONE',                       // no hay ingeniería todavía
  PROPOSED: 'PROPOSED',               // propuesta, sin validar
  VALIDATED: 'VALIDATED',             // validada por ingeniería
  REQUIRES_VALIDATION: 'REQUIRES_VALIDATION', // necesita revisión humana (no la finge la IA)
});

export const MFG_STATUS = Object.freeze({
  CAN_BUILD: 'CAN_BUILD',
  REQUIRES_VALIDATION: 'REQUIRES_VALIDATION',
  UNKNOWN: 'UNKNOWN',
});

export const COCREO_STATUS = Object.freeze({
  DRAFT: 'DRAFT',       // apenas una idea
  PARTIAL: 'PARTIAL',   // avanza pero faltan piezas del pipeline
  READY: 'READY',       // todo resuelto: costeable y cotizable
  BLOCKED: 'BLOCKED',   // hay un bloqueo que impide avanzar
});

// Familias de producto que el core reconoce hoy (extensible, no sólo oficina §18).
export const FAMILIA = Object.freeze({
  RECEPCION: 'RECEPCION',
  ESCRITORIO: 'ESCRITORIO',
  LOCKER: 'LOCKER',            // Smart Locker (eléctrico/electrónico)
  DISPLAY: 'DISPLAY',          // exhibidor retail
  MESA: 'MESA',
  GUARDADO: 'GUARDADO',
  DESCONOCIDA: 'DESCONOCIDA',
});

// ---------------------------------------------------------------------------
//  Hash estable (djb2 sobre JSON canónico con llaves ordenadas). Sirve para
//  versionar el ProductSpec y detectar staleness aguas abajo.
// ---------------------------------------------------------------------------
function ordenarProfundo(x) {
  if (Array.isArray(x)) return x.map(ordenarProfundo);
  if (x && typeof x === 'object') {
    return Object.keys(x).sort().reduce((o, k) => { o[k] = ordenarProfundo(x[k]); return o; }, {});
  }
  return x;
}
export function hashEstable(obj) {
  const s = JSON.stringify(ordenarProfundo(obj));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16);
}

const sinAcentos = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------------------------------------------------------------------------
//  1) PRODUCT INTENT · interpreta la idea del cliente de forma DETERMINISTA.
//     No usa LLM: extrae lo que el texto dice literalmente; lo que no dice,
//     queda null y se anota en `desconocidos` (no se inventa).
// ---------------------------------------------------------------------------
const FAMILIAS_TXT = [
  [/recep|lobby|mostrador|front\s?desk/, FAMILIA.RECEPCION],
  [/locker|casiller|smart\s?locker|paqueter/, FAMILIA.LOCKER],
  [/exhibidor|display|vitrina|retail|anaquel|rack de tienda/, FAMILIA.DISPLAY],
  [/escritorio|bench|estaci[oó]n|puesto|workstation/, FAMILIA.ESCRITORIO],
  [/mesa de junta|mesa de consejo|conference|boardroom/, FAMILIA.MESA],
  [/credenza|archiv|guarda|gabinete|storage|libr/, FAMILIA.GUARDADO],
];

const MATERIALES_TXT = [
  ['nogal', /nogal|walnut/], ['roble', /roble|oak/], ['encino', /encino/],
  ['maple', /maple|arce/], ['solid_surface', /solid\s?surface|superficie s[oó]lida|corian/],
  ['laminado', /laminad|melamina|formica/], ['cristal', /cristal|vidrio|glass/],
  ['metal', /metal|acero|aluminio/], ['piedra', /m[aá]rmol|piedra|cuarzo/],
];

// Convierte "2.40 m" / "2400 mm" / "240 cm" a milímetros.
function aMM(valor, unidad) {
  const n = parseFloat(String(valor).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (/mm/.test(unidad)) return Math.round(n);
  if (/cm/.test(unidad)) return Math.round(n * 10);
  return Math.round(n * 1000); // metros por defecto
}

export function interpretarIntent(texto = '') {
  const t = sinAcentos(texto);
  const desconocidos = [];

  // Familia
  let familia = FAMILIA.DESCONOCIDA;
  for (const [re, fam] of FAMILIAS_TXT) { if (re.test(t)) { familia = fam; break; } }
  if (familia === FAMILIA.DESCONOCIDA) desconocidos.push('familia');

  // Dimensión principal (ancho/largo): primer "N m/cm/mm".
  const dim = t.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/);
  const ancho_mm = dim ? aMM(dim[1], dim[2]) : null;
  if (ancho_mm == null) desconocidos.push('dimensiones');

  // Materiales + tono (claro/oscuro) por cercanía textual.
  const materiales = [];
  for (const [mat, re] of MATERIALES_TXT) {
    const m = re.exec(t);
    if (!m) continue;
    const ventana = t.slice(Math.max(0, m.index - 24), m.index + 24);
    const tono = /oscur|dark/.test(ventana) ? 'oscuro' : /clar|light|blanc/.test(ventana) ? 'claro' : null;
    materiales.push({ material: mat, tono });
  }
  // "cubierta clara" sin material nombrado → acabado de cubierta.
  const acabados = [];
  if (/cubierta clar|cubierta blanc|tapa clar/.test(t)) acabados.push({ rol: 'cubierta', tono: 'claro' });
  if (/cubierta oscur|tapa oscur/.test(t)) acabados.push({ rol: 'cubierta', tono: 'oscuro' });

  // Características (features) explícitas.
  const caracteristicas = [];
  if (/iluminaci|backlight|luz integrada|lighting/.test(t)) caracteristicas.push('iluminacion_integrada');
  if (/curv|curved|radio|redonde/.test(t)) caracteristicas.push('curva');
  if (/electr[oó]nic|controlador|controller|touch|pantalla/.test(t)) caracteristicas.push('electronica');
  if (/cerradura|lock|chapa/.test(t)) caracteristicas.push('cerraduras');
  if (/ventilaci|ventilation/.test(t)) caracteristicas.push('ventilacion');

  // Capacidad (personas). Acepta dígito ("2") o número escrito ("dos").
  const NUM_TXT = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12 };
  const cap = t.match(/(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s*(personas?|usuarios?|lugares?|puestos?)/);
  const capN = cap ? (/^\d+$/.test(cap[1]) ? parseInt(cap[1], 10) : NUM_TXT[cap[1]]) : null;
  const capacidad = capN ? { personas: capN } : null;

  // ADN de diseño: nivel + tono emocional.
  const nivel = /premium|alta gama|lujo|ejecutiv/.test(t) ? 'premium' : /econ[oó]mic|b[aá]sic/.test(t) ? 'economico' : null;
  const tono = /c[aá]lid|acogedor|warm/.test(t) ? 'calido' : /sobri|minimal|fr[ií]o|cool/.test(t) ? 'sobrio' : null;

  return {
    textoOriginal: String(texto || ''),
    familia, dimensiones: ancho_mm ? { ancho_mm } : null,
    materiales, acabados, caracteristicas, capacidad, nivel, tono,
    desconocidos,
  };
}

// ---------------------------------------------------------------------------
//  2) PROJECT DNA · el "lenguaje de diseño" del proyecto, reutilizable entre
//     productos. Separado del producto a propósito (§14-15).
// ---------------------------------------------------------------------------
export function extraerDNA(intent) {
  const paleta = (intent.materiales || []).map((m) => m.material);
  return {
    tono: intent.tono || null,
    nivel: intent.nivel || null,
    paletaMaterial: [...new Set(paleta)],
    acabado: (intent.acabados || [])[0]?.tono || null,
    fuente: 'intent',
  };
}

// ---------------------------------------------------------------------------
//  3) CLASIFICACIÓN · LINE / CONFIGURED / DERIVED_SPECIAL / NEW_SPECIAL (§17).
//     `parent` es un producto de catálogo { id, version, nombre, familia,
//     dimensiones, materialesPermitidos:[], coloresPermitidos:[] } o null.
// ---------------------------------------------------------------------------
// Un cambio es "configuración permitida" sólo si es un color/acabado dentro del
// set permitido del padre. Cualquier otra cosa (dimensión, material fuera de
// set, feature nueva, cambio estructural) es DERIVACIÓN → especial derivado.
export function clasificarProducto(intent, { parent = null } = {}) {
  if (!parent) {
    return { clasificacion: CLASIFICACION.NEW_SPECIAL, parent_product_id: null, parent_product_version: null, change_set: [], motivos: ['sin producto padre: especial nuevo'] };
  }
  const change_set = [];
  const motivos = [];

  // Dimensión distinta al padre → cambio estructural/dimensional.
  const anchoPide = intent.dimensiones?.ancho_mm;
  const anchoPadre = parent.dimensiones?.ancho_mm;
  if (anchoPide != null && anchoPadre != null && Math.abs(anchoPide - anchoPadre) >= 1) {
    change_set.push({ campo: 'dimension.ancho_mm', de: anchoPadre, a: anchoPide, tipo: 'dimensional' });
  }

  // Materiales: dentro del set permitido = configuración; fuera = derivación.
  const permitidos = (parent.materialesPermitidos || []).map(sinAcentos);
  const coloresOk = (parent.coloresPermitidos || []).map(sinAcentos);
  for (const m of intent.materiales || []) {
    const mat = sinAcentos(m.material);
    const esColorPermitido = coloresOk.includes(mat) || (m.tono && coloresOk.includes(sinAcentos(m.tono)));
    if (permitidos.length && !permitidos.includes(mat) && !esColorPermitido) {
      change_set.push({ campo: 'material', de: '(set permitido)', a: m.material, tipo: 'material' });
    } else if (esColorPermitido) {
      change_set.push({ campo: 'color', de: '(set permitido)', a: m.tono || m.material, tipo: 'configuracion' });
    }
  }

  // Features que alteran el producto (iluminación, electrónica, estructura).
  const featDeriva = (intent.caracteristicas || []).filter((c) => ['iluminacion_integrada', 'electronica', 'cerraduras', 'ventilacion', 'estructural'].includes(c));
  for (const f of featDeriva) change_set.push({ campo: 'feature', de: null, a: f, tipo: 'feature' });

  const soloConfiguracion = change_set.length > 0 && change_set.every((c) => c.tipo === 'configuracion');
  if (change_set.length === 0) {
    motivos.push('idéntico al padre: producto de línea');
    return { clasificacion: CLASIFICACION.LINE_PRODUCT, parent_product_id: parent.id, parent_product_version: parent.version, change_set, motivos };
  }
  if (soloConfiguracion) {
    motivos.push('sólo opciones permitidas (color/acabado): línea configurada');
    return { clasificacion: CLASIFICACION.CONFIGURED_LINE_PRODUCT, parent_product_id: parent.id, parent_product_version: parent.version, change_set, motivos };
  }
  motivos.push('cambios fuera del set permitido: especial derivado (conserva linaje, no se cobra el estándar)');
  return { clasificacion: CLASIFICACION.DERIVED_SPECIAL, parent_product_id: parent.id, parent_product_version: parent.version, change_set, motivos };
}

// ---------------------------------------------------------------------------
//  4) PRODUCT SPEC · universal/extensible y VERSIONADO (§15,§18).
//     `componentes` es el BOM-seed en el contrato de `calcular()` (puede venir
//     vacío → la ingeniería queda pendiente; no se finge).
// ---------------------------------------------------------------------------
export function construirProductSpec(intent, dna, clasif, { rev = 1, componentes = [], id = null } = {}) {
  const spec = {
    id: id || ('ps_' + hashEstable({ t: intent.textoOriginal, rev }).slice(1)),
    rev,
    clasificacion: clasif.clasificacion,
    parent_product_id: clasif.parent_product_id,
    parent_product_version: clasif.parent_product_version,
    change_set: clasif.change_set,
    familia: intent.familia,
    dimensiones: intent.dimensiones,
    materiales: intent.materiales,
    acabados: intent.acabados,
    caracteristicas: intent.caracteristicas,
    capacidad: intent.capacidad,
    componentes,          // BOM-seed (contrato calcular)
    dna,
  };
  spec.hash = hashEstable({ ...spec, hash: undefined });
  return spec;
}

// ---------------------------------------------------------------------------
//  5) INGENIERÍA / BOM STATE · honesto. Sin componentes → no hay ingeniería.
//     Features eléctricas/electrónicas/estructurales → REQUIRES_VALIDATION.
// ---------------------------------------------------------------------------
const FEATURES_CRITICAS = ['electronica', 'cerraduras', 'ventilacion', 'iluminacion_integrada', 'estructural'];
export function estadoIngenieria(spec) {
  const criticas = (spec.caracteristicas || []).filter((c) => FEATURES_CRITICAS.includes(c));
  if (criticas.length) {
    return { estado: ENG_STATUS.REQUIRES_VALIDATION, faltantes: criticas, motivos: [`features que requieren validación de ingeniería: ${criticas.join(', ')}`] };
  }
  if (!(spec.componentes || []).length) {
    return { estado: ENG_STATUS.NONE, faltantes: ['BOM'], motivos: ['sin despiece (BOM): ingeniería por definir'] };
  }
  return { estado: ENG_STATUS.PROPOSED, faltantes: [], motivos: ['despiece propuesto, pendiente de validar por ingeniería'] };
}

// ---------------------------------------------------------------------------
//  6) MANUFACTURABILIDAD · honesta (§19). Un Smart Locker con capacidad
//     eléctrica/electrónica no certificada NUNCA es CAN_BUILD por IA.
// ---------------------------------------------------------------------------
const REQUISITOS_LOCKER = ['enclosure', 'doors', 'locks', 'controller', 'power', 'wiring', 'access', 'ventilation', 'maintenance', 'mounting', 'finish'];
export function manufacturabilidad(spec) {
  const esElectrico = spec.familia === FAMILIA.LOCKER || (spec.caracteristicas || []).some((c) => ['electronica', 'cerraduras'].includes(c));
  if (esElectrico) {
    const faltan = spec.familia === FAMILIA.LOCKER ? REQUISITOS_LOCKER : ['controlador/alimentación certificados'];
    return { estado: MFG_STATUS.REQUIRES_VALIDATION, requisitos: faltan, motivos: ['capacidad eléctrica/electrónica no certificada: requiere validación de ingeniería (la IA no puede aprobarla)'] };
  }
  if (spec.clasificacion === CLASIFICACION.NEW_SPECIAL && !(spec.componentes || []).length) {
    return { estado: MFG_STATUS.UNKNOWN, requisitos: ['BOM'], motivos: ['especial nuevo sin despiece: manufacturabilidad por determinar'] };
  }
  return { estado: MFG_STATUS.CAN_BUILD, requisitos: [], motivos: ['fabricable con procesos estándar'] };
}

// ---------------------------------------------------------------------------
//  7) COST SNAPSHOT · ORQUESTA costear (calculo.js). Honra VH-017: distingue
//     KNOWN / ESTIMATED / PENDING_* / UNKNOWN. El costo OFICIAL sólo existe si
//     todo el BOM es emitible (sin pendientes).
// ---------------------------------------------------------------------------
export function costearSpec(spec, insumos = {}, par = {}) {
  const comps = spec.componentes || [];
  if (!comps.length) {
    return { cost_status: COST_STATUS.UNKNOWN, known_cost: null, official_cost: null, unresolved_lines: ['sin BOM'], estimated_amount: null, certified_amount: null, evidencia: { motivo: 'sin despiece' }, costeo: null };
  }
  const costeo = calcular({ nombre: spec.familia, piezas: 1, componentes: comps, modoManoObra: 'porcentaje' }, 1, insumos, par);
  const e = costeoEmitible(costeo);
  const ignorados = costeo.componentesIgnorados || [];
  // ¿Los pendientes son por MATERIAL faltante o por PRECIO ausente?
  const pendMaterial = ignorados.filter((n) => comps.some((c) => (c.nombre === n) && !insumos[c.insumoId] && !c.insumo));
  const pendPrecio = ignorados.filter((n) => !pendMaterial.includes(n));

  let cost_status;
  if (!e.emitible) {
    cost_status = pendMaterial.length ? COST_STATUS.PENDING_MATERIAL : (pendPrecio.length ? COST_STATUS.PENDING_PRICE : COST_STATUS.UNKNOWN);
  } else {
    const usoEstimado = comps.some((c) => { const ins = insumos[c.insumoId] || c.insumo; return ins && ins.precio == null && precioUsable(ins); });
    cost_status = usoEstimado ? COST_STATUS.ESTIMATED : COST_STATUS.KNOWN;
  }
  return {
    cost_status,
    known_cost: e.subtotalConocido ?? null,                     // lo costeado hasta ahora
    official_cost: e.emitible ? e.costoTotal : null,            // sólo si es emitible
    unresolved_lines: e.pendientes || [],
    estimated_amount: cost_status === COST_STATUS.ESTIMATED ? costeo.costoUnitario : null,
    certified_amount: cost_status === COST_STATUS.KNOWN ? costeo.costoUnitario : null,
    evidencia: { ignorados, excluidos: costeo.componentesExcluidos || [] },
    costeo,
  };
}

// ---------------------------------------------------------------------------
//  8) LÍNEA DE COTIZACIÓN · seller-safe. Sólo hay precio si el costo es oficial.
//     Si el costo no es emitible → la línea queda "sin precio autorizado"
//     (requiere desarrollo), nunca con un precio inventado (§7,§14,§24).
// ---------------------------------------------------------------------------
export function lineaCocreada(spec, snapshot, { cantidad = 1 } = {}) {
  const base = {
    descripcion: descripcionCorta(spec),
    product_version_id: `${spec.id}@${spec.rev}#${spec.hash}`,
    cantidad,
    clasificacion: spec.clasificacion,
  };
  const costeable = snapshot.official_cost != null;
  if (!costeable) {
    return { ...base, sinPrecioAutorizado: true, requiere_desarrollo: true, cost_status: snapshot.cost_status, motivo: 'costo no emitible: la línea requiere desarrollo/precio real antes de cotizar' };
  }
  // NOTA: el PRECIO de venta lo fija la política de cotización (margen/lista),
  // no Cocrear. Aquí la línea viaja "lista para cotizar" con el costo oficial
  // disponible SÓLO para Dirección; el vendedor nunca recibe costo.
  return { ...base, cost_status: snapshot.cost_status, costeable: true, listaParaCotizar: true };
}

export function descripcionCorta(spec) {
  const fam = ({ RECEPCION: 'Recepción', ESCRITORIO: 'Escritorio', LOCKER: 'Smart Locker', DISPLAY: 'Exhibidor', MESA: 'Mesa', GUARDADO: 'Guardado', DESCONOCIDA: 'Producto' })[spec.familia] || 'Producto';
  const mats = (spec.materiales || []).map((m) => `${m.material}${m.tono ? ' ' + m.tono : ''}`).join(', ');
  const ancho = spec.dimensiones?.ancho_mm ? ` ${(spec.dimensiones.ancho_mm / 1000).toFixed(2)} m` : '';
  return `${fam}${ancho}${mats ? ' · ' + mats : ''}`.trim();
}

// ---------------------------------------------------------------------------
//  9) ORQUESTADOR · corre el vertical slice y devuelve TODO el pipeline + una
//     historia + los bloqueos reales + el estado global honesto.
// ---------------------------------------------------------------------------
export function cocrear(texto, { insumos = {}, par = {}, parent = null, rev = 1, componentes = [] } = {}) {
  const historia = [];
  const paso = (nombre, estado) => historia.push({ paso: nombre, estado, ts: historia.length });

  const intent = interpretarIntent(texto); paso('intent', intent.familia === FAMILIA.DESCONOCIDA ? 'parcial' : 'ok');
  const dna = extraerDNA(intent); paso('dna', 'ok');
  const clasif = clasificarProducto(intent, { parent }); paso('clasificacion', clasif.clasificacion);
  const spec = construirProductSpec(intent, dna, clasif, { rev, componentes }); paso('product_spec', `rev${spec.rev}`);
  const ingenieria = estadoIngenieria(spec); paso('ingenieria', ingenieria.estado);
  const mfg = manufacturabilidad(spec); paso('manufacturabilidad', mfg.estado);
  const costo = costearSpec(spec, insumos, par); paso('costo', costo.cost_status);
  const linea = lineaCocreada(spec, costo); paso('cotizacion', linea.costeable ? 'lista' : 'requiere_desarrollo');

  // Bloqueos reales (nada se finge como listo).
  const blockers = [];
  if (ingenieria.estado === ENG_STATUS.REQUIRES_VALIDATION) blockers.push('ingeniería requiere validación humana');
  if (mfg.estado === MFG_STATUS.REQUIRES_VALIDATION) blockers.push('manufacturabilidad requiere validación');
  if (mfg.estado === MFG_STATUS.UNKNOWN) blockers.push('manufacturabilidad por determinar');
  if (costo.official_cost == null) blockers.push('costo no emitible (' + costo.cost_status + ')');
  if (intent.desconocidos.length) blockers.push('faltan datos del brief: ' + intent.desconocidos.join(', '));

  let status;
  if (linea.costeable && !blockers.length) status = COCREO_STATUS.READY;
  else if (blockers.some((b) => /validación|validacion/.test(b))) status = COCREO_STATUS.BLOCKED;
  else status = (spec.componentes.length || intent.familia !== FAMILIA.DESCONOCIDA) ? COCREO_STATUS.PARTIAL : COCREO_STATUS.DRAFT;

  // Render: sólo se PREPARA el input (RenderSpec) cuando hay geometría/estado
  // suficiente; no se genera aquí (eso pasa por Voni/Render Director, §8).
  const render = { status: spec.componentes.length ? 'input_listo' : 'pendiente', ref: null, specHash: spec.hash };
  // Placement: sólo aplica cuando el producto se coloca en un FloorSpec.
  const placement = { status: 'no_aplica' };

  return { intent, dna, clasificacion: clasif, spec, ingenieria, manufacturabilidad: mfg, costo, lineaCotizacion: linea, render, placement, status, blockers, historia };
}

// ---------------------------------------------------------------------------
//  10) STALENESS · si el ProductSpec cambia (nueva rev), lo aguas-abajo
//      (costo/render/cotización) queda OBSOLETO hasta recalcular (§3,§22).
// ---------------------------------------------------------------------------
export function estaStale(resultadoPrevio, specNuevo) {
  if (!resultadoPrevio?.spec || !specNuevo) return false;
  return resultadoPrevio.spec.hash !== specNuevo.hash;
}
