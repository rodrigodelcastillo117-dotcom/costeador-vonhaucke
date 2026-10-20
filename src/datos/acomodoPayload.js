// ============================================================================
//  P0.2 · BUILDER ÚNICO DEL PAYLOAD AL SOLVER (contrato de entrada).
//
//  Hoy el payload {areas,piezas} se arma en 4 sitios dispersos de AcomodoBase,
//  con flags inconsistentes y SIN garantía server-independiente de que:
//    (obj 1) el solver reciba SÓLO partidas CONFIRMADas,
//    (obj 2) CERO sug-* lleguen al input real,
//    (obj 3) NO se acomode sin un FloorSpec VÁLIDO.
//
//  Este módulo es la ÚNICA puerta de entrada. Es puro y testeable sin deploy
//  (CERTIFICADO AHORA). Devuelve el payload canónico (áreas en mm + piezas +
//  program_hash + floor_hash) o un rechazo explícito con motivo — nunca un
//  payload "a medias" que el solver pudiera malinterpretar.
// ============================================================================
import { areasCanonicas, aMM } from './floorPlan.js';
import { expandirPiezas } from './espacio.js';
import { marcarDestinoPartida, destinoMarcado } from './destinoAcomodo.js';
import { rolFromRel } from './confirmarPrograma.js';
import { programHashCanonico, floorHash } from './acomodoHash.js';

// Pasillo mínimo de circulación (mm) — parte del input geométrico para el hash.
const MIN_PASILLO_MM = 1000;

// Predicado sug-* local (no importa el componente Acomodo.jsx). Debe coincidir
// con Acomodo.jsx:esSugerida — misma regla ABSOLUTA #6/#97.
export const esSugerida = (p) => !!p?.sugeridoPlano || String(p?.id || '').startsWith('sug-');

/**
 * Validación GEOMÉTRICA del FloorSpec (áreas en metros). Determinista, sin IA.
 * No sustituye a floorSpec.js (que valida el FloorSpec rico leído del plano);
 * aquí sólo exigimos que el espacio sea acomodable: existe y cada área tiene
 * dimensiones positivas y finitas.
 * @returns {{ok:boolean, issues:string[]}}
 */
export function validarFloorSpecGeom(areasM) {
  const issues = [];
  const areas = Array.isArray(areasM) ? areasM : [];
  if (areas.length === 0) { issues.push('SIN_AREAS'); return { ok: false, issues }; }
  areas.forEach((a, i) => {
    const w = Number(a?.ancho), d = Number(a?.largo);
    const etiqueta = a?.nombre || `área ${i + 1}`;
    if (!Number.isFinite(w) || w <= 0) issues.push(`AREA_ANCHO_INVALIDO:${etiqueta}`);
    if (!Number.isFinite(d) || d <= 0) issues.push(`AREA_LARGO_INVALIDO:${etiqueta}`);
    if (Array.isArray(a?.poly) && a.poly.length > 0 && a.poly.length < 3) issues.push(`AREA_POLY_DEGENERADO:${etiqueta}`);
  });
  return { ok: issues.length === 0, issues };
}

/**
 * Construye el payload canónico para el solver, o lo rechaza con motivo.
 *
 * @param {{partidas?:Array, areasM?:Array}} entrada
 * @returns {
 *   {ok:true, areas:Array, piezas:Array, program_hash:string, floor_hash:string,
 *    requested:number, descartadosSugeridos:number, areasCanon:Array} |
 *   {ok:false, motivo:'SIN_PARTIDAS_CONFIRMADAS'|'SIN_FLOORSPEC'|'FLOORSPEC_INVALIDO',
 *    detalles?:string[]}
 * }
 */
// Estados de FloorSpec (de floorSpec.js / lectura de plano) que SÍ permiten
// colocar. Para un plano leído por IA, cualquier otro estado bloquea el solver.
const FLOORSPEC_ESTADOS_OK = new Set(['PASS', 'VALID', 'OK', 'VALIDO']);

export function construirPayloadAcomodo({ partidas = [], areasM = [], piezasExtra = [], floorSpecEstado = null } = {}) {
  // (obj 1/2) CONFIRMADas-only: se filtra sug-* SIEMPRE, aquí, aunque el caller
  // ya lo haya hecho. Es la garantía server-independiente contra el bypass de
  // montar AcomodoBase sin el wrapper. `descartadosSugeridos` deja rastro.
  const entrada = Array.isArray(partidas) ? partidas : [];
  const reales = entrada.filter((p) => !esSugerida(p)).map(marcarDestinoPartida);
  const descartadosSugeridos = entrada.length - reales.length;

  if (reales.length === 0) {
    return { ok: false, motivo: 'SIN_PARTIDAS_CONFIRMADAS', detalles: [], descartadosSugeridos };
  }

  // (obj 3) FloorSpec válido es PRE-CONDICIÓN del placement. Primero se valida el
  // espacio; sólo entonces se acomoda. No se mezcla detección con placement.
  const areasCanon = areasCanonicas({ areasM });
  if (areasCanon.length === 0) {
    return { ok: false, motivo: 'SIN_FLOORSPEC', detalles: ['areasCanonicas vacío'], descartadosSugeridos };
  }
  const val = validarFloorSpecGeom(areasCanon);
  if (!val.ok) {
    return { ok: false, motivo: 'FLOORSPEC_INVALIDO', detalles: val.issues, descartadosSugeridos };
  }
  // GAP3 · FloorSpec de PLANO/IA: aunque la GEOMETRÍA sea válida, si el estado
  // determinista del FloorSpec no permite placement, NO se llama al solver. El
  // espacio manual/simple (sin floorSpecEstado) pasa; un plano rechazado NO.
  if (floorSpecEstado != null && !FLOORSPEC_ESTADOS_OK.has(String(floorSpecEstado).toUpperCase())) {
    return { ok: false, motivo: 'FLOORSPEC_RECHAZADO', detalles: [String(floorSpecEstado)], descartadosSugeridos };
  }

  const piezas = expandirPiezas(reales);
  // VH-096: una pieza sin zona asignada (la describió una persona, no viene del programa) va a la
  // PRIMERA área cuyo tipo corresponde a su destino (privado/juntas/open/recepcion), deducido del
  // texto de la partida o, si no dice nada, de su rol. Así una credenza directiva no cae en sanitarios.
  const tipoPorDestino = { privado: 'privado', juntas: 'juntas', open: 'open', operativo: 'open', recepcion: 'recepcion' };
  const areaPorTipo = (tipo) => areasCanon.find((a) => String(a?.tipo || '').toLowerCase() === tipo);
  const areasDeTipo = (tipo) => areasCanon.filter((a) => String(a?.tipo || '').toLowerCase() === tipo);
  const tipoDePieza = (pz) => {
    const destino = destinoMarcado(pz) || rolFromRel(pz.relation_role) || ({ SUPPORT_STORAGE: 'privado', VISITOR_SEAT: 'privado' })[pz.relation_role] || null;
    return destino ? (tipoPorDestino[destino] || destino) : null;
  };
  // Prueba de Rodrigo 2026-10-19 (cotización 3354): con VARIAS áreas del mismo tipo (sala de consejo + sala creativa),
  // "la primera" metía las dos mesas en la misma sala. Las ANCLAS sin sala se reparten una por área de su tipo: la más
  // grande en el área con más lugares (asientos/puestos) y, a igualdad, más m². Sus sillas/gavetas NO se amarran a un
  // área: siguen a su mueble (el solver las adopta). Con una sola área del tipo, todo como antes.
  const ROL_ANCLA = /^ANCHOR_/;
  const SIGUE_A_SU_ANCLA = new Set(['MEETING_SEAT', 'WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'UNDERDESK_STORAGE']);
  const cupoArea = (a) => [Number(a?.asientos) || Number(a?.puestos) || 0, (Number(a?.ancho) || 0) * (Number(a?.largo) || 0)];
  const anclasLibres = new Map();
  for (const pz of piezas) {
    if (pz.zone_id != null || !ROL_ANCLA.test(String(pz.relation_role || ''))) continue;
    const tipo = tipoDePieza(pz); if (!tipo || areasDeTipo(tipo).length < 2) continue;
    if (!anclasLibres.has(tipo)) anclasLibres.set(tipo, []);
    anclasLibres.get(tipo).push(pz);
  }
  // Recorrido texto→plano (lab 19-oct): si la NOTA o el nombre de la partida nombra una sala ("Sala creativa resuelta
  // con…", "Mesa de consejo … para 10 lugares"), esa ancla va a ESA sala; sólo las que no dicen nada se reparten por tamaño.
  const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const VACIAS = new Set(['sala', 'salas', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'oficina', 'area', 'zona', 'nivel', 'n1', 'n2']);
  const clavesArea = (a) => normTxt(a?.nombre).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !VACIAS.has(w));
  const textoPartida = new Map(reales.map((p) => [String(p.id), normTxt(`${p.nota || ''} ${p.nombre || ''}`)]));
  const textoDe = (pz) => textoPartida.get(String(pz.id).replace(/-\d+$/, '')) || '';
  for (const [tipo, anclas] of anclasLibres) {
    const salas = areasDeTipo(tipo).slice().sort((x, y) => { const [ax, mx] = cupoArea(x), [ay, my] = cupoArea(y); return (ay - ax) || (my - mx); });
    const usadas = new Set();
    const sinNombre = [];
    for (const pz of anclas) {
      const t = textoDe(pz);
      const nombradas = salas.filter((a) => { const k = clavesArea(a); return k.length && k.every((w) => new RegExp(`\\b${w}\\b`).test(t)); });
      if (nombradas.length === 1) { pz.zone_id = nombradas[0].zone_id ?? nombradas[0].nombre; usadas.add(nombradas[0]); } else sinNombre.push(pz);
    }
    const libres = salas.filter((a) => !usadas.has(a));
    const destino = libres.length ? libres : salas;
    sinNombre.sort((x, y) => ((Number(y.w) || 0) * (Number(y.d) || 0) - (Number(x.w) || 0) * (Number(x.d) || 0)) || (String(x.id) < String(y.id) ? -1 : 1))
      .forEach((pz, i) => { const a = destino[i % destino.length]; pz.zone_id = a.zone_id ?? a.nombre; });
  }
  for (const pz of piezas) {
    if (pz.zone_id != null) continue;
    const tipo = tipoDePieza(pz);
    if (tipo && SIGUE_A_SU_ANCLA.has(pz.relation_role) && areasDeTipo(tipo).length > 1) continue;
    const area = tipo ? areaPorTipo(tipo) : null;
    if (area) pz.zone_id = area.zone_id ?? area.nombre;
  }
  // VH-092: una REFERENCIA (sin identidad de catálogo NI precio) sí se acomoda para que la
  // persona vea el borrador, pero queda listada con UNRESOLVED_PRODUCT y el acomodo NUNCA
  // se publica como VALIDADO mientras exista. PRELIMINAR (identidad sin precio autorizado, o
  // huella supuesta) se etiqueta; sólo `sug-*` se excluye del solver (ya arriba).
  const referencias = piezas.filter((pz) => pz.elegibilidad === 'REFERENCIA')
    .map((pz) => ({ id: pz.id, nombre: pz.nombre, codigo: 'UNRESOLVED_PRODUCT', motivo: 'Sin identidad de catálogo ni precio autorizado: se dibuja como borrador, no cuenta como mobiliario validado.' }));
  const preliminar = piezas.some((pz) => pz.elegibilidad !== 'CONFIRMADO' || pz.huella_fuente === 'INFERIDA');
  // Piezas EXTRA (p.ej. copias manuales `dup-*` del proyectista): ya vienen
  // expandidas (nivel pieza). Entran al solver pero NUNCA un sug-*.
  const extra = (Array.isArray(piezasExtra) ? piezasExtra : [])
    .filter((pz) => !esSugerida(pz) && !String(pz.id || '').startsWith('sug-'));
  // Blindaje final: ninguna pieza expandida puede provenir de un sug-*.
  const piezasLimpias = [...piezas, ...extra].filter((pz) => !esSugerida(pz) && !String(pz.id || '').startsWith('sug-'));

  return {
    ok: true,
    areas: aMM(areasCanon),                // mm, orden preservado (índice = identidad)
    areasCanon,                            // metros canónicos (para persistir/hash)
    piezas: piezasLimpias,
    // program_hash CANÓNICO: sobre las piezas EXPANDIDAS que recibe el solver
    // (captura cambios de dimensión canónica aunque id/cantidad comercial no cambien).
    program_hash: programHashCanonico(piezasLimpias),
    floor_hash: floorHash(areasCanon, { minPasillo: MIN_PASILLO_MM }),
    requested: piezasLimpias.length,
    descartadosSugeridos,
    referencias,                             // VH-092: piezas sin identidad ni precio (UNRESOLVED_PRODUCT): bloquean VALIDADO
    preliminar,                              // VH-092: alguna pieza no CONFIRMADA o con huella INFERIDA
    // VH-A10-06: cuántas piezas usan la huella estándar de silla (supuesta) y cuántas la medida de la ficha del catálogo.
    huellasEstandar: piezasLimpias.filter((pz) => pz.huella_fuente === 'ESTANDAR').length,
    huellasCatalogo: piezasLimpias.filter((pz) => pz.huella_fuente === 'CATALOGO').length,
    resumenElegibilidad: {
      confirmadas: piezasLimpias.filter((pz) => pz.elegibilidad === 'CONFIRMADO').length,
      preliminares: piezasLimpias.filter((pz) => pz.elegibilidad === 'PRELIMINAR').length,
      huellasInferidas: piezasLimpias.filter((pz) => pz.huella_fuente === 'INFERIDA').length,
      referencias: referencias.length,
    },
  };
}
