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

// --- Opciones y defaults para el ESTUDIO EN VIVO (co-diseño con el cliente) ---
// El cliente y Von Haucke ajustan estos ejes y ven el producto tomar forma.
export const FAMILIAS_EDIT = [FAMILIA.RECEPCION, FAMILIA.ESCRITORIO, FAMILIA.MESA, FAMILIA.GUARDADO, FAMILIA.LOCKER, FAMILIA.DISPLAY];
export const MATERIALES_EDIT = ['nogal', 'roble', 'encino', 'maple', 'laminado', 'solid_surface', 'cristal', 'metal', 'piedra'];
export const TONOS_EDIT = [null, 'claro', 'oscuro'];
export const FEATURES_EDIT = ['curva', 'iluminacion_integrada', 'cerraduras', 'electronica', 'ventilacion'];

// Dimensiones por defecto por familia (mm) para el visual cuando el brief no las da.
export const DIMS_DEFAULT = {
  [FAMILIA.RECEPCION]: { ancho_mm: 2400, alto_mm: 1100, prof_mm: 700 },
  [FAMILIA.ESCRITORIO]: { ancho_mm: 1500, alto_mm: 750, prof_mm: 700 },
  [FAMILIA.MESA]: { ancho_mm: 2400, alto_mm: 740, prof_mm: 1100 },
  [FAMILIA.GUARDADO]: { ancho_mm: 900, alto_mm: 1100, prof_mm: 450 },
  [FAMILIA.LOCKER]: { ancho_mm: 1800, alto_mm: 1950, prof_mm: 500 },
  [FAMILIA.DISPLAY]: { ancho_mm: 1200, alto_mm: 1800, prof_mm: 450 },
  [FAMILIA.DESCONOCIDA]: { ancho_mm: 1500, alto_mm: 900, prof_mm: 600 },
};

const _hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const _rgb = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const _mezclar = (a, b, t) => { const A = _hex(a), B = _hex(b); return _rgb(A.map((v, i) => v + (B[i] - v) * t)); };

// Color de un material + tono, para el visual paramétrico (y, a futuro, el render).
export function colorMaterial(material, tono) {
  const base = {
    nogal: '#6B4423', roble: '#B88A5A', encino: '#C9A06A', maple: '#D8B98A',
    laminado: '#CBB79B', solid_surface: '#ECEAE6', cristal: '#AFC8D6',
    metal: '#9AA0A6', piedra: '#C9C3B8',
  }[material] || '#B89A7A';
  if (tono === 'oscuro') return _mezclar(base, '#1E140C', 0.42);
  if (tono === 'claro') return _mezclar(base, '#F6EFE6', 0.45);
  return base;
}

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
  if (/cajon|gaveta|storage|almacen/.test(t)) caracteristicas.push('cajones');
  if (/flotante|flote|suspend/.test(t)) caracteristicas.push('flotante');
  if (/carga|cargador|celular|inalambric|wireless/.test(t)) caracteristicas.push('carga_inalambrica');

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
export function cocrear(texto, opts = {}) {
  return cocrearDesdeIntent(interpretarIntent(texto), opts);
}

// Variante que parte de un INTENT ya estructurado (el estudio en vivo edita el
// intent con controles — medidas, material, forma, features — y recalcula sin
// re-parsear texto). `cocrear(texto)` es azúcar sobre esto.
export function cocrearDesdeIntent(intent, { insumos = {}, par = {}, parent = null, rev = 1, componentes = [] } = {}) {
  const historia = [];
  const paso = (nombre, estado) => historia.push({ paso: nombre, estado, ts: historia.length });

  paso('intent', intent.familia === FAMILIA.DESCONOCIDA ? 'parcial' : 'ok');
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
//  CAMBIOS EN LENGUAJE NATURAL · el cliente habla, el producto CAMBIA de verdad.
//  Convierte "hazlo más largo / quiero nogal / ponle cajones / más elegante" en
//  un cambio ESTRUCTURADO del intent. Si la intención es ambigua ("más elegante")
//  NO cambia en silencio: devuelve 2-3 PROPUESTAS para que el cliente elija (§9,§10).
// ---------------------------------------------------------------------------
const _clon = (x) => JSON.parse(JSON.stringify(x));
const _setTono = (intent, tono) => {
  if (!intent.materiales?.length) intent.materiales = [{ material: 'laminado', tono: null }];
  intent.materiales[0].tono = tono;
};
const _addFeat = (intent, f) => { intent.caracteristicas = [...new Set([...(intent.caracteristicas || []), f])]; };
const _delFeat = (intent, f) => { intent.caracteristicas = (intent.caracteristicas || []).filter((c) => c !== f); };

export function aplicarCambioTexto(intent, frase) {
  const t = sinAcentos(frase);
  const next = _clon(intent);
  const dd = DIMS_DEFAULT[next.familia] || DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
  if (!next.dimensiones) next.dimensiones = { ancho_mm: dd.ancho_mm };
  const cambios = [];

  // --- Dimensión principal (ancho) ---
  const cm = t.match(/(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b/);
  const quiereMenos = /(corto|corta|angost|chic|peque|reduce|reducir|menos|acorta)/.test(t);
  const quiereMas = /(larg|anch|grande|alarga|agranda|extiende|mas\s+espacio)/.test(t);
  const anchoAct = next.dimensiones.ancho_mm || dd.ancho_mm;
  if (cm) {
    const delta = aMM(cm[1], cm[2]);
    let nuevo = delta;                                    // "2.70 m" = set absoluto
    if (quiereMenos) nuevo = Math.max(300, anchoAct - delta);
    else if (quiereMas) nuevo = anchoAct + delta;
    next.dimensiones.ancho_mm = nuevo;
    cambios.push({ campo: 'dimension.ancho_mm', a: nuevo, tipo: 'dimensional' });
  } else if (quiereMas) {
    next.dimensiones.ancho_mm = Math.round(anchoAct * 1.12);
    cambios.push({ campo: 'dimension.ancho_mm', a: next.dimensiones.ancho_mm, tipo: 'dimensional' });
  } else if (quiereMenos) {
    next.dimensiones.ancho_mm = Math.round(anchoAct * 0.88);
    cambios.push({ campo: 'dimension.ancho_mm', a: next.dimensiones.ancho_mm, tipo: 'dimensional' });
  }

  // --- Material ---
  for (const [mat, re] of MATERIALES_TXT) {
    if (re.test(t)) {
      const tono0 = next.materiales?.[0]?.tono || null;
      next.materiales = [{ material: mat, tono: tono0 }, ...(next.materiales || []).slice(1)];
      cambios.push({ campo: 'material', a: mat, tipo: 'material' });
      break;
    }
  }
  // --- Tono / color ---
  if (/oscur|negr|dark/.test(t)) { _setTono(next, 'oscuro'); cambios.push({ campo: 'tono', a: 'oscuro', tipo: 'acabado' }); }
  else if (/clar|blanc|light/.test(t)) { _setTono(next, 'claro'); cambios.push({ campo: 'tono', a: 'claro', tipo: 'acabado' }); }

  // --- Forma ---
  if (/curv|redonde|organ/.test(t)) { _addFeat(next, 'curva'); cambios.push({ campo: 'forma', a: 'curva', tipo: 'forma' }); }
  if (/recto|recta|angular|cuadrad/.test(t)) { _delFeat(next, 'curva'); cambios.push({ campo: 'forma', a: 'recta', tipo: 'forma' }); }

  // --- Features concretas ---
  const feat = [
    [/ilumina|\bluz\b|\bled\b|backlight/, 'iluminacion_integrada'],
    [/cajon|gaveta|guardar|storage|almacen/, 'cajones'],
    [/flotante|flote|suspend/, 'flotante'],
    [/carga|cargar|celular|telefono|inalambric|wireless/, 'carga_inalambrica'],
    [/cerradura|lock|chapa/, 'cerraduras'],
    [/pantalla|screen|touch/, 'electronica'],
    [/ventilaci/, 'ventilacion'],
  ];
  for (const [re, f] of feat) if (re.test(t)) { _addFeat(next, f); cambios.push({ campo: 'feature', a: f, tipo: 'feature' }); }
  if (/sin\s+(cajon|gaveta)/.test(t)) { _delFeat(next, 'cajones'); cambios.push({ campo: 'feature', a: '-cajones', tipo: 'feature' }); }

  // --- Intención ABSTRACTA sin cambio concreto → proponer caminos (no adivinar) ---
  if (!cambios.length) {
    const abstract = /(mas|más)?\s*(elegante|premium|ligero|liviano|moderno|sobrio|calid|limpio|minimal)/.test(t);
    if (abstract) return { tipo: 'propuestas', propuestas: propuestasDeEstilo(t, intent) };
    return { tipo: 'nada', intent, mensaje: 'No entendí un cambio concreto. Prueba: "más largo", "quiero nogal", "ponle cajones", "más elegante".' };
  }
  return { tipo: 'aplicado', intent: next, cambios };
}

// Rutas (2-3) para una intención abstracta. Cada una es un delta aplicable.
function propuestasDeEstilo(t, intent) {
  const rutas = [];
  const base = () => _clon(intent);
  if (/elegante|premium|calid/.test(t)) {
    const a = base(); _addFeat(a, 'flotante'); _setTono(a, 'oscuro');
    rutas.push({ id: 'escultorica', label: 'Más escultórica', detalle: 'Base retranqueada (flotante) + tono más profundo.', intent: a, impacto: 'visual' });
    const b = base(); b.materiales = [{ material: 'nogal', tono: null }]; _addFeat(b, 'iluminacion_integrada');
    rutas.push({ id: 'calida', label: 'Más cálida', detalle: 'Presencia de nogal + iluminación integrada.', intent: b, impacto: 'visual' });
    const c = base(); _addFeat(c, 'curva');
    rutas.push({ id: 'suave', label: 'Más suave', detalle: 'Radios más suaves (forma curva).', intent: c, impacto: 'visual' });
  } else if (/ligero|liviano|limpio|minimal|sobrio/.test(t)) {
    const a = base(); _addFeat(a, 'flotante');
    rutas.push({ id: 'retranqueada', label: 'Base retranqueada', detalle: 'Efecto flotante, menor impacto económico.', intent: a, impacto: 'visual' });
    const b = base(); b.materiales = [{ material: 'metal', tono: null }];
    rutas.push({ id: 'metal', label: 'Estructura metálica delgada', detalle: 'Más limpio visualmente; costo mayor.', intent: b, impacto: 'costo' });
    const c = base(); _setTono(c, 'claro');
    rutas.push({ id: 'claro', label: 'Acabado más claro', detalle: 'Se percibe más ligero sin cambiar estructura.', intent: c, impacto: 'visual' });
  } else {
    const a = base(); _setTono(a, 'claro');
    rutas.push({ id: 'claro', label: 'Más claro', detalle: 'Acabado claro.', intent: a, impacto: 'visual' });
    const b = base(); _addFeat(b, 'curva');
    rutas.push({ id: 'curva', label: 'Más suave', detalle: 'Forma curva.', intent: b, impacto: 'visual' });
  }
  return rutas;
}

// ---------------------------------------------------------------------------
//  VONI PROACTIVO · revisa el diseño y propone mejoras HONESTAS (riesgo, valor,
//  mantenimiento, decisiones faltantes). Determinista, con evidencia; nunca
//  inventa vida útil ni certifica. También sabe decir "no cambiaría nada" (§45-51).
// ---------------------------------------------------------------------------
export function sugerenciasVoni(spec) {
  const out = [];
  const ancho = spec?.dimensiones?.ancho_mm || 0;
  const feats = spec?.caracteristicas || [];
  const fam = spec?.familia;

  // Claro largo → riesgo de flexión (recepción/mesa/escritorio con cubierta).
  if ([FAMILIA.RECEPCION, FAMILIA.MESA, FAMILIA.ESCRITORIO].includes(fam) && ancho >= 2600 && !feats.includes('refuerzo_inferior')) {
    out.push({ tipo: 'riesgo', que: `Claro largo (${(ancho / 1000).toFixed(2)} m)`, porque: 'Una cubierta de ese claro puede flexionar con el tiempo.', impacto: 'estructural', confianza: 'media', accion: { addFeature: 'refuerzo_inferior', label: 'Evaluar refuerzo inferior' } });
  }
  // Locker: decisión de acceso + validación eléctrica.
  if (fam === FAMILIA.LOCKER) {
    if (!feats.includes('acceso_definido')) out.push({ tipo: 'decision', que: 'Falta definir el sistema de acceso', porque: 'Un locker inteligente necesita acceso (QR / RFID / cerradura autónoma).', impacto: 'funcional', confianza: 'alta', accion: { addFeature: 'acceso_definido', label: 'Definir acceso (RFID)' } });
    out.push({ tipo: 'validacion', que: 'La parte eléctrica/electrónica requiere validación', porque: 'La IA no certifica electrónica; lo revisa ingeniería.', impacto: 'manufacturabilidad', confianza: 'alta', accion: null });
  }
  // Iluminación → registro de mantenimiento del driver.
  if (feats.includes('iluminacion_integrada') && !feats.includes('registro_mantenimiento')) {
    out.push({ tipo: 'mantenimiento', que: 'El driver LED necesita acceso de servicio', porque: 'Sin un registro de mantenimiento, cambiar el driver obliga a desarmar.', impacto: 'mantenimiento', confianza: 'media', accion: { addFeature: 'registro_mantenimiento', label: 'Agregar registro frontal' } });
  }
  // Guard de sobre-ingeniería: si no hay nada, dilo (no inventes mejoras).
  if (!out.length) out.push({ tipo: 'ok', que: 'No recomiendo cambios estructurales', porque: 'El diseño actual es razonable para su uso previsto.', impacto: null, confianza: 'media', accion: null });
  return out;
}

// ---------------------------------------------------------------------------
//  10) STALENESS · si el ProductSpec cambia (nueva rev), lo aguas-abajo
//      (costo/render/cotización) queda OBSOLETO hasta recalcular (§3,§22).
// ---------------------------------------------------------------------------
export function estaStale(resultadoPrevio, specNuevo) {
  if (!resultadoPrevio?.spec || !specNuevo) return false;
  return resultadoPrevio.spec.hash !== specNuevo.hash;
}
