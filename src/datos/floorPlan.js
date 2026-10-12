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
//    { nombre, tipo?, dentroDe?, contiene?, nivel?, puestos?, x?, y?, ancho, largo,
//      poly?:[[x,y]], obstaculos?:[{x,y,w,h,tipo}], puertas?:[{x,y,ancho}] }
//  ⚠️ `puestos` (escritorios CONTADOS por el lector del plano) es dato SEMÁNTICO, no
//  geométrico: no se convierte, se TRANSPORTA. Cuando este contrato nació (beaa005)
//  la lista blanca de campos lo omitió y el programa volvió a re-estimar puestos por
//  geometría (regresó VH-002: 48 "estimados" donde el plano dibujaba 8). Cualquier
//  campo semántico nuevo que ponga el lector va en SEMANTICOS, no se agrega a mano.
//  Reglas: areasM es la verdad; areas(mm) se deriva con aMM. x/y sólo existen si el
//  cuarto tiene posición REAL (plano subido/dibujado). poly es relativo a la esquina.
//  La geometría de puerta rica (bisagra/arco) viaja completa en ambos sentidos (m ↔ mm).
// ============================================================================

const r3 = (n) => Math.round((Number(n) || 0) * 1000);   // m → mm
const d3 = (n) => (Number(n) || 0) / 1000;               // mm → m

const puertaAMM = (p = {}) => ({
  x: r3(p.x), y: r3(p.y), ancho: r3(p.ancho),
  ...(typeof p.tieneBarrido === 'boolean' ? { tieneBarrido: p.tieneBarrido } : {}),
  ...(Number.isFinite(Number(p.bisagraX)) ? { bisagraX: r3(p.bisagraX) } : {}),
  ...(Number.isFinite(Number(p.bisagraY)) ? { bisagraY: r3(p.bisagraY) } : {}),
  ...(Number.isFinite(Number(p.anguloCerradaDeg)) ? { anguloCerradaDeg: Number(p.anguloCerradaDeg) } : {}),
  ...(p.sentido ? { sentido: p.sentido } : {}),
  ...(Number.isFinite(Number(p.barridoDeg)) ? { barridoDeg: Number(p.barridoDeg) } : {}),
  ...(p.confianza ? { confianza: p.confianza } : {}),
});

const puertaAMetros = (p = {}) => ({
  x: d3(p.x), y: d3(p.y), ancho: d3(p.ancho),
  ...(typeof p.tieneBarrido === 'boolean' ? { tieneBarrido: p.tieneBarrido } : {}),
  ...(Number.isFinite(Number(p.bisagraX)) ? { bisagraX: d3(p.bisagraX) } : {}),
  ...(Number.isFinite(Number(p.bisagraY)) ? { bisagraY: d3(p.bisagraY) } : {}),
  ...(Number.isFinite(Number(p.anguloCerradaDeg)) ? { anguloCerradaDeg: Number(p.anguloCerradaDeg) } : {}),
  ...(p.sentido ? { sentido: p.sentido } : {}),
  ...(Number.isFinite(Number(p.barridoDeg)) ? { barridoDeg: Number(p.barridoDeg) } : {}),
  ...(p.confianza ? { confianza: p.confianza } : {}),
});

// Campos que NO son geometría y viajan intactos en ambas direcciones (m ↔ mm).
// `puestos`: conteo de escritorios dibujados (entero > 0) que pone leer-plano.
const SEMANTICOS = ['puestos'];
const semanticos = (a) => Object.fromEntries(
  SEMANTICOS.filter((k) => Number.isFinite(a[k]) && a[k] > 0).map((k) => [k, a[k]]),
);

// Metros → mm, conservando forma (poly), huecos (obstaculos), puertas, anidamiento
// (dentroDe/contiene), piso (nivel) y posición real (x/y). Es el DERIVADO para el motor.
export function aMM(areas = []) {
  return (areas || []).map((a) => ({
    nombre: a.nombre,
    ...(a.tipo ? { tipo: a.tipo } : {}),
    ...(a.dentroDe ? { dentroDe: a.dentroDe } : {}),
    ...(a.contiene ? { contiene: a.contiene } : {}),
    ...(Number.isFinite(a.nivel) ? { nivel: a.nivel } : {}),
    ...semanticos(a),
    ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: r3(a.x), y: r3(a.y) } : {}),
    ancho: r3(a.ancho),
    largo: r3(a.largo),
    ...(a.poly ? { poly: a.poly.map(([x, y]) => [r3(x), r3(y)]) } : {}),
    ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: r3(o.x), y: r3(o.y), w: r3(o.w), h: r3(o.h), tipo: o.tipo })) } : {}),
    ...(a.puertas?.length ? { puertas: a.puertas.map(puertaAMM) } : {}),
  }));
}

export function aMetros(areas = []) {
  return (areas || []).map((a) => ({
    nombre: a.nombre,
    ...(a.tipo ? { tipo: a.tipo } : {}),
    ...(a.dentroDe ? { dentroDe: a.dentroDe } : {}),
    ...(a.contiene ? { contiene: a.contiene } : {}),
    ...(Number.isFinite(a.nivel) ? { nivel: a.nivel } : {}),
    ...semanticos(a),
    ...(Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: d3(a.x), y: d3(a.y) } : {}),
    ancho: d3(a.ancho),
    largo: d3(a.largo),
    ...(a.poly ? { poly: a.poly.map(([x, y]) => [d3(x), d3(y)]) } : {}),
    ...(a.obstaculos?.length ? { obstaculos: a.obstaculos.map((o) => ({ x: d3(o.x), y: d3(o.y), w: d3(o.w), h: d3(o.h), tipo: o.tipo })) } : {}),
    ...(a.puertas?.length ? { puertas: a.puertas.map(puertaAMetros) } : {}),
  }));
}

export function cuantizar(areasM = []) {
  return aMetros(aMM(areasM));
}

export function areasCanonicas(acomodo) {
  if (acomodo?.areasM?.length) return cuantizar(acomodo.areasM);
  if (acomodo?.areas?.length) return aMetros(acomodo.areas);
  return [];
}

export function bloqueGeometria(areasM = []) {
  const areas = aMM(areasM);
  return { areasM: aMetros(areas), areas };
}
