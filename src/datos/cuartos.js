// ============================================================================
//  CUARTOS · UN SOLO CLASIFICADOR POR NOMBRE (inventario §5 · VH-061)
//
//  Había dos lecturas del nombre de un cuarto que no se hablaban: `planner.rolArea`
//  (servicio/juntas/lounge/recepcion/privado/open/general, decide DÓNDE se acomoda)
//  y `floorSpec.zonaSemantica` (CEO/CONSEJO/OPERATIVA/RECEPCION/SANITARIOS/SITE/
//  GENERICA, decide QUÉ se permite). Medidas con 30 nombres reales (2026-10-11):
//  coincidían salvo "Site": floorSpec prohíbe todo mueble en SITE_IT y el planner lo
//  trataba como 'general' y le acomodaba muebles. Aquí hay UNA lectura con dos
//  vistas derivadas; la única diferencia de comportamiento es que site/IT/rack es
//  'servicio' también para el planner (nada se acomoda ahí).
// ============================================================================
export const ZONA = Object.freeze({
  CEO: 'OFICINA_CEO', CONSEJO: 'SALA_CONSEJO', OPERATIVA: 'AREA_OPERATIVA', RECEPCION: 'RECEPCION',
  SITE: 'SITE_IT', SANITARIOS: 'SANITARIOS', GENERICA: 'GENERICA',
});

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Clasifica un cuarto por su nombre. Orden = especificidad (lo más inequívoco primero).
 * @returns {{rol:string, zona:string}} rol para el planner · zona para floorSpec.
 */
export function clasificarCuarto(nombre) {
  const t = norm(nombre);
  if (/sanitar|ba[n]o|\bwc\b|w\.c|toilet|\bhombres?\b|\bmujeres?\b/.test(t)) return { rol: 'servicio', zona: ZONA.SANITARIOS };
  if (/\bsite\b|\bit\b|\bdata\b|rack|comunicac/.test(t)) return { rol: 'servicio', zona: ZONA.SITE };
  if (/nucleo|ducto|escaler|\bcore\b|cocin|kitchen/.test(t)) return { rol: 'servicio', zona: ZONA.GENERICA };
  // Un PASILLO / CIRCULACIÓN es zona de paso: NO lleva muebles. Sin esto, un corredor
  // amplio (p. ej. 22×2 m = 44 m²) caía por tamaño en 'juntas' y el programa le proponía
  // una mesa de juntas fantasma (plano de prueba, 2026-10-21). 'vestíbulo' y 'acceso' NO
  // entran aquí: ésos son recepción a propósito (regla de abajo).
  if (/circulac|pasillo|corredor|distribuidor/.test(t)) return { rol: 'servicio', zona: ZONA.GENERICA };
  if (/ceo|direcc|director/.test(t)) return { rol: 'privado', zona: ZONA.CEO };
  if (/jun|consejo|board|reunion/.test(t)) return { rol: 'juntas', zona: ZONA.CONSEJO };
  if (/lounge|descanso|estar|comedor|break|caf[e]|espera/.test(t)) return { rol: 'lounge', zona: ZONA.GENERICA };
  if (/recep|lobby|acceso|vestib/.test(t)) return { rol: 'recepcion', zona: ZONA.RECEPCION };
  if (/priv|gerenc|oficina/.test(t)) return { rol: 'privado', zona: ZONA.GENERICA };
  // 'apartado' y 'pax' son el vocabulario real que vino del lector de planos del CEO (línea viva 2026-10-08).
  if (/open|operativ|apartado|trabajo|estaci|planta libre|bench|isla|\bpax\b/.test(t)) return { rol: 'open', zona: ZONA.OPERATIVA };
  return { rol: 'general', zona: ZONA.GENERICA };
}
export const rolDeCuarto = (nombre) => clasificarCuarto(nombre).rol;
export const zonaDeCuarto = (nombre) => clasificarCuarto(nombre).zona;
