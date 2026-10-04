// ============================================================================
//  FLOOR PLAN · CONTRATO CANÓNICO DEL PLANO  (una sola verdad del espacio)
//  Un proyecto tiene UN plano. Su forma vive en estado.cotizacion.acomodo:
//    {
//      areasM:   Area[]   // FUENTE DE VERDAD, en METROS (lo que edita el usuario)
//      areas:    Area[]   // DERIVADO en mm (cache para el motor; nunca se edita a mano)
//      plan:     { colocacion:[{id,area,x,y,rot}], caben, zonas, auditoria, ... }
//      planReal: boolean  // el plano vino de un plano real/dibujado (no auto-crecer)
//      render3d: string   // imagen fotorrealista para portada/PDF (opcional)
//      dibujoMeta, escenas ...
//    }
//  Area (en metros en areasM, en mm en areas):
//    { nombre, tipo?, dentroDe?, contiene?, nivel?, x?, y?, ancho, largo,
//      poly?:[[x,y]], obstaculos?:[{x,y,w,h,tipo}], puertas?:[{x,y,ancho}] }
//  Reglas: areasM es la verdad; areas(mm) se deriva con aMM. x/y sólo existen si el
//  cuarto tiene posición REAL (plano subido/dibujado). poly es relativo a la esquina.
// ============================================================================

const r3 = (n) => Math.round((Number(n) || 0) * 1000);   // m → mm (entero)
const d3 = (n) => (Number(n) || 0) / 1000;               // mm → m

// Metros → mm, conservando forma (poly), huecos (obstaculos), puertas, anidamiento
// (dentroDe/contiene), piso (nivel) y posición real (x/y). Es el DERIVADO para el motor.
export function aMM(areas = []) {
  return (areas || []).map((a) => ({
    nombre: a.nombre,
    ...(a.tipo ? { tipo: a.tipo } : {}),
    ...(a.dentroDe ? { dentroDe: a.dentroDe } : {}),
    ...(a.contiene ? { contiene: a.contiene } : {}),
    ...(Number.isFinite(a.nivel) ? { nivel: a.nivel } : {}),
    ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: r3(a.x), y: r3(a.y) } : {}),
    ancho: r3(a.ancho),
    largo: r3(a.largo),
    ...(a.poly ? { poly: a.poly.map(([x, y]) => [r3(x), r3(y)]) } : {}),
    ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: r3(o.x), y: r3(o.y), w: r3(o.w), h: r3(o.h), tipo: o.tipo })) } : {}),
    ...(a.puertas?.length ? { puertas: a.puertas.map((p) => ({ x: r3(p.x), y: r3(p.y), ancho: r3(p.ancho) })) } : {}),
  }));
}

// mm → metros (inverso de aMM). Respaldo para plantas guardadas sólo en mm (legacy).
export function aMetros(areas = []) {
  return (areas || []).map((a) => ({
    nombre: a.nombre,
    ...(a.tipo ? { tipo: a.tipo } : {}),
    ...(a.dentroDe ? { dentroDe: a.dentroDe } : {}),
    ...(a.contiene ? { contiene: a.contiene } : {}),
    ...(Number.isFinite(a.nivel) ? { nivel: a.nivel } : {}),
    ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: d3(a.x), y: d3(a.y) } : {}),
    ancho: d3(a.ancho),
    largo: d3(a.largo),
    ...(a.poly ? { poly: a.poly.map(([x, y]) => [d3(x), d3(y)]) } : {}),
    ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: d3(o.x), y: d3(o.y), w: d3(o.w), h: d3(o.h), tipo: o.tipo })) } : {}),
    ...(a.puertas?.length ? { puertas: a.puertas.map((p) => ({ x: d3(p.x), y: d3(p.y), ancho: d3(p.ancho) })) } : {}),
  }));
}

// PRECISIÓN CANÓNICA 1 mm: areasM es la verdad, pero se guarda SNAPEADA a 0.001 m
// (= 1 mm) para que m→mm→m sea EXACTO y no se acumule deriva de floats (nada de
// 2.3999999997). cuantizar = pasar por mm y volver: snapea ancho/largo/x/y/poly/
// obstaculos/puertas de una sola forma, idéntica en toda la app.
export function cuantizar(areasM = []) {
  return aMetros(aMM(areasM));
}

// LOADER CANÓNICO: dado el `acomodo` guardado, devuelve las áreas EN METROS ya
// cuantizadas a 1 mm (la verdad editable). Prefiere areasM; si sólo hay areas(mm)
// legacy, las convierte; si no hay nada, []. Única puerta de entrada para rehidratar
// el editor. Al cuantizar en carga, un legacy con ruido de float queda canónico sin
// moverse más de 0.5 mm, y load→save→load es idempotente.
export function areasCanonicas(acomodo) {
  if (acomodo?.areasM?.length) return cuantizar(acomodo.areasM);
  if (acomodo?.areas?.length) return aMetros(acomodo.areas);
  return [];
}

// Al GUARDAR: el bloque canónico de geometría a mergear en `acomodo`. Garantiza que
// areasM (verdad, cuantizada a 1 mm) y areas (mm derivado) queden SIEMPRE en sync y
// que areasM === aMetros(areas) — una sola verdad, round-trip exacto.
export function bloqueGeometria(areasM = []) {
  const areas = aMM(areasM);
  return { areasM: aMetros(areas), areas };
}
