// ============================================================================
//  FloorSpec — CAPA DETERMINISTA DE VERDAD del plano (P0-PLAN).
//
//  El problema que arregla: la lectura de plano vivía confiando en el PROMPT de la
//  IA ("ANTES DE RESPONDER COMPRUEBA…"), que NO es validación. Resultado real
//  (Golden ARQ-01): la app leyó 178 m² cuando las cotas dan 132, contó 17 puestos
//  mezclando sillas de junta y sanitarios, "confirmó" 17 archiveros que eran una
//  REGLA (no estaban dibujados) y "confirmó" SKUs que el plano nunca nombró.
//
//  Aquí NO hay IA. Son funciones puras y deterministas que:
//   · separan los roles semánticos (un puesto NO es una silla de junta NI un
//     sanitario);
//   · exigen que las cotas (grid) cuadren con la envolvente (cota > escala > IA);
//   · mantienen la disciplina de procedencia (una sugerencia JAMÁS se vuelve
//     "confirmada" sola);
//   · imponen la invariante de acomodo (pedidas = colocadas + sin_colocar +
//     excluidas) y el estado de layout.
//
//  Todo lo que la IA proponga pasa por aquí. Si no cuadra: INVALID, y el frontend
//  bloquea Propuesta/3D/PDF oficial (no se presenta algo medio hecho).
// ============================================================================

// --- Roles semánticos. CAPACIDAD != PUESTOS != SILLAS. Nunca se mezclan. --------
export const ROL = {
  WORKSTATION: 'WORKSTATION',       // posición de trabajo (escritorio/bench)
  WORK_SEAT: 'WORK_SEAT',           // silla operativa (en zona de trabajo)
  MEETING_SEAT: 'MEETING_SEAT',     // silla en sala de juntas/consejo
  VISITOR_SEAT: 'VISITOR_SEAT',     // silla de visita
  EXECUTIVE_SEAT: 'EXECUTIVE_SEAT', // silla directiva (oficina CEO/dirección)
  DESK: 'DESK',
  TABLE: 'TABLE',                   // mesa de juntas/consejo
  STORAGE: 'STORAGE',               // archivero/credenza/guarda
  RECEPTION: 'RECEPTION',
  FIXTURE: 'FIXTURE',               // sanitario, site/IT, built-in — NUNCA una silla
  OTHER: 'OTHER',
};

// Zonas semánticas reconocidas (para interpretar un símbolo DENTRO de su zona).
export const ZONA = {
  CEO: 'OFICINA_CEO',
  CONSEJO: 'SALA_CONSEJO',
  OPERATIVA: 'AREA_OPERATIVA',
  RECEPCION: 'RECEPCION',
  SITE: 'SITE_IT',
  SANITARIOS: 'SANITARIOS',
  GENERICA: 'GENERICA',
};

// Normaliza el nombre libre de una zona a su tipo semántico (sin inventar zonas).
export function zonaSemantica(nombre = '') {
  const t = String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/ceo|direcc|director/.test(t)) return ZONA.CEO;
  if (/consejo|junta|board|reunion|sala de/.test(t)) return ZONA.CONSEJO;
  if (/operativ|open|bench|estacion|trabajo/.test(t)) return ZONA.OPERATIVA;
  if (/recepc|lobby|acceso/.test(t)) return ZONA.RECEPCION;
  // Sanitarios ANTES que site, y site con límites de palabra: "saNITarios" contiene
  // "it" y "nit" — un \bit\b suelto lo clasificaba mal como SITE.
  if (/sanitar|bano|baño|wc|toilet|hombre|mujer/.test(t)) return ZONA.SANITARIOS;
  if (/\bsite\b|\bit\b|\bdata\b|rack|comunicac/.test(t)) return ZONA.SITE;
  return ZONA.GENERICA;
}

// Un símbolo tipo "silla" (círculo) se interpreta SEGÚN SU ZONA. Un sanitario NUNCA
// es una silla. Esta es la regla que impidió los "17 puestos": las sillas de la
// Sala de Consejo son MEETING_SEAT, no WORKSTATION.
export function rolDeSimboloEnZona(simbolo, zonaTipo) {
  const s = String(simbolo || '').toLowerCase();
  // Los artefactos de sanitario / fixtures jamás se vuelven sillas/puestos.
  if (/sanitar|inodoro|wc|lavabo|mingitorio|fixture|rack|site/.test(s)) return ROL.FIXTURE;
  const esSilla = /silla|asiento|chair|circulo|círculo|seat/.test(s);
  if (esSilla) {
    switch (zonaTipo) {
      case ZONA.CONSEJO: return ROL.MEETING_SEAT;
      case ZONA.CEO: return ROL.EXECUTIVE_SEAT;
      case ZONA.RECEPCION: return ROL.VISITOR_SEAT;
      case ZONA.OPERATIVA: return ROL.WORK_SEAT;
      default: return ROL.VISITOR_SEAT;
    }
  }
  if (/escritorio|desk/.test(s)) return ROL.DESK;
  if (/bench|puesto|estacion|workstation/.test(s)) return ROL.WORKSTATION;
  if (/mesa|table/.test(s)) return ROL.TABLE;
  if (/archiv|credenza|guarda|gaveta|storage|pedestal/.test(s)) return ROL.STORAGE;
  if (/recepc|reception/.test(s)) return ROL.RECEPTION;
  return ROL.OTHER;
}

// Cuenta observaciones por rol SIN mezclar. Devuelve un objeto con un contador por
// rol (los ausentes en 0). `detected_workstations` jamás incluye sillas de junta ni
// sanitarios.
export function contarRoles(observaciones = []) {
  const c = Object.fromEntries(Object.values(ROL).map((r) => [r, 0]));
  for (const o of observaciones) {
    const rol = o?.semantic_role || o?.rol;
    const q = Number(o?.quantity_group ?? o?.cantidad ?? 1) || 1;
    if (rol && c[rol] != null) c[rol] += q;
    else c[ROL.OTHER] += q;
  }
  return c;
}

// --- Procedencia. Una sugerencia JAMÁS se vuelve "confirmada" sola. ------------
export const PROCEDENCIA = {
  DETECTED_FROM_PLAN: 'DETECTED_FROM_PLAN',
  USER_CONFIRMED: 'USER_CONFIRMED',
  CATALOG_MATCH: 'CATALOG_MATCH',
  RULE_SUGGESTION: 'RULE_SUGGESTION',
  AI_SUGGESTION: 'AI_SUGGESTION',
};
// SOLO lo que el plano dibujó o lo que el usuario confirmó cuenta como "confirmado".
const CONFIRMADAS = new Set([PROCEDENCIA.DETECTED_FROM_PLAN, PROCEDENCIA.USER_CONFIRMED]);
export function esConfirmado(item) {
  return CONFIRMADAS.has(item?.source || item?.procedencia);
}
// Un modelo EXACTO (SKU) solo puede ser confirmado con evidencia; un match de
// catálogo o una preferencia del algoritmo NO lo confirman.
export function modeloConfirmado(mueble) {
  return !!(mueble?.exact_model && esConfirmado({ source: mueble?.exact_model_source }));
}

// --- Geometría determinista ---------------------------------------------------
export function areaPoligono(puntos = []) {
  if (!Array.isArray(puntos) || puntos.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < puntos.length; i++) {
    const [x1, y1] = puntos[i];
    const [x2, y2] = puntos[(i + 1) % puntos.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
export function puntoEnPoligono([x, y], poligono = []) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    const cruza = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// COTA > ESCALA > ESTIMACIÓN IA: la envolvente debe cuadrar con la suma de las cotas
// del grid. Si el grid existe y no suma, la lectura es INVÁLIDA (el bug 178 vs 132).
export function validarEnvolvente(envelope = {}, grid = {}, tolPct = 0.02) {
  const issues = [];
  const ancho = Number(envelope.width_mm ?? envelope.ancho) || 0;
  const largo = Number(envelope.height_mm ?? envelope.largo) || 0;
  if (ancho <= 0 || largo <= 0) issues.push({ code: 'ENVELOPE_NO_POSITIVA', msg: 'La envolvente debe ser positiva.' });
  const sum = (a) => (Array.isArray(a) ? a.reduce((s, v) => s + (Number(v) || 0), 0) : 0);
  const sh = sum(grid.horizontal);
  const sv = sum(grid.vertical);
  if (sh > 0 && ancho > 0 && Math.abs(sh - ancho) / ancho > tolPct) {
    issues.push({ code: 'GRID_ANCHO_NO_CUADRA', msg: `La suma de cotas horizontales (${sh}) no coincide con el ancho de la envolvente (${ancho}).` });
  }
  if (sv > 0 && largo > 0 && Math.abs(sv - largo) / largo > tolPct) {
    issues.push({ code: 'GRID_LARGO_NO_CUADRA', msg: `La suma de cotas verticales (${sv}) no coincide con el largo de la envolvente (${largo}).` });
  }
  return { ok: issues.length === 0, issues, area_m2: (ancho / 1000) * (largo / 1000) };
}

// Validador determinista del FloorSpec completo. Devuelve status VALID|INVALID.
export function validarFloorSpec(spec = {}) {
  const issues = [];
  const env = validarEnvolvente(spec.envelope || {}, spec.grid || {});
  issues.push(...env.issues);

  const zonas = Array.isArray(spec.zones) ? spec.zones : [];
  let areaZonas = 0;
  for (const z of zonas) {
    const poly = z.polygon || z.puntos;
    if (poly && poly.length >= 3) {
      const a = areaPoligono(poly);
      if (a <= 0) issues.push({ code: 'ZONA_AREA_CERO', msg: `Zona ${z.name || z.id} con área no positiva.` });
      areaZonas += a;
    }
  }
  // La suma de zonas no puede exceder (razonablemente) la envolvente.
  const areaEnvMM = (Number(spec.envelope?.width_mm ?? spec.envelope?.ancho) || 0) * (Number(spec.envelope?.height_mm ?? spec.envelope?.largo) || 0);
  if (areaEnvMM > 0 && areaZonas > areaEnvMM * 1.05) {
    issues.push({ code: 'ZONAS_EXCEDEN_ENVOLVENTE', msg: 'La suma de zonas excede la envolvente.' });
  }

  // Mobiliario DENTRO de su zona; fixtures no son sillas; cantidades coherentes.
  const obs = Array.isArray(spec.furniture_observations) ? spec.furniture_observations : [];
  const zonaPorId = new Map(zonas.map((z) => [z.id, z]));
  for (const o of obs) {
    if (o.semantic_role === ROL.FIXTURE) continue; // fixtures no se validan como mueble
    const z = zonaPorId.get(o.zone_id);
    const poly = z && (z.polygon || z.puntos);
    if (poly && o.center && !puntoEnPoligono(o.center, poly)) {
      issues.push({ code: 'MUEBLE_FUERA_DE_ZONA', msg: `Mueble ${o.id} fuera de su zona ${o.zone_id}.` });
    }
    if (Number(o.quantity_group ?? 1) <= 0) issues.push({ code: 'CANTIDAD_INVALIDA', msg: `Mueble ${o.id} con cantidad no positiva.` });
  }

  return { status: issues.length === 0 ? 'VALID' : 'INVALID', issues, area_m2: env.area_m2 };
}

// --- Estado del acomodo (layout). Nada desaparece. ----------------------------
// Invariante ABSOLUTA: requested = placed + unplaced + excluded.
// LAYOUT_VALID solo si todo está colocado, sin colisiones, sin salirse y sin tapar
// puertas. Si no, LAYOUT_INCOMPLETE (y el frontend NO habilita Propuesta/3D/PDF).
export function estadoLayout({ requested = 0, placed = 0, unplaced = 0, excluded = 0, colisiones = 0, fuera = 0, puertasBloqueadas = 0 } = {}) {
  const issues = [];
  const cuadra = requested === placed + unplaced + excluded;
  if (!cuadra) issues.push({ code: 'INVARIANTE_CONTEO', msg: `pedidas (${requested}) != colocadas (${placed}) + sin_colocar (${unplaced}) + excluidas (${excluded}).` });
  const valido = cuadra && unplaced === 0 && colisiones === 0 && fuera === 0 && puertasBloqueadas === 0;
  return {
    status: valido ? 'LAYOUT_VALID' : 'LAYOUT_INCOMPLETE',
    invariante_ok: cuadra,
    requested, placed, unplaced, excluded, colisiones, fuera, puertasBloqueadas,
    issues,
  };
}

// ¿Se puede presentar una Propuesta / 3D oficial / PDF final? Solo con datos y
// acomodo válidos. (El diagnóstico sí se puede ver, pero marcado como tal.)
export function puedePresentarPropuesta(floorStatus, layoutStatus) {
  return floorStatus === 'VALID' && layoutStatus === 'LAYOUT_VALID';
}

// El render OFICIAL solo si lo renderizado == lo colocado (no un 3D bonito de un
// layout roto).
export function renderFiel({ rendered = 0, placed = 0 } = {}) {
  return rendered === placed;
}
