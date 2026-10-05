// ============================================================================
// FLOOR PLAN · CONTRATO CANÓNICO DEL PLANO (una sola verdad del espacio)
// areasM es fuente editable en METROS; areas es derivado en mm para motores.
// La geometría de puerta rica (bisagra/arco) viaja completa en ambos sentidos.
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
