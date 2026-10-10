// ============================================================================
//  ROL FUNCIONAL INFERIDO para piezas que llegan al solver SIN programa confirmado
//  (COT-P0-025, OPERACIÓN RESCATE 2026-10-10).
//
//  Evidencia E2E real (Torre Sur): las partidas que crea Voni/CotizadorIA (líneas y
//  banco) no traen `relation_role` ni `functional_group_id`; el kit-solver sólo arma
//  kits con anclas `ANCHOR_*` y asigna sillas/gavetas por grupo → 23 piezas, 0 colocadas.
//
//  Aquí se INFIERE —y se MARCA como inferido (`rol_inferido:true`)— el rol, el grupo
//  funcional y la capacidad, con IDENTIDAD primero (piezaId del banco / ruta+producto
//  de línea / destino marcado) y texto del nombre sólo como respaldo. Nunca pisa un
//  rol que ya venga del programa confirmado (OBSERVADO/CONFIRMADO ≠ INFERIDO).
// ============================================================================
import { destinoMarcado } from './destinoAcomodo.js';
import { puestosDe } from './porCuarto.js';

const norm = (s = '') => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ANCLAS = new Set(['ANCHOR_WORKSTATION', 'ANCHOR_DESK', 'ANCHOR_MEETING', 'ANCHOR_RECEPTION']);
const ZONA_DE_ROL = {
  ANCHOR_WORKSTATION: 'open', WORK_SEAT: 'open', UNDERDESK_STORAGE: 'open',
  ANCHOR_DESK: 'privado', EXECUTIVE_SEAT: 'privado', VISITOR_SEAT: 'privado',
  ANCHOR_MEETING: 'juntas', MEETING_SEAT: 'juntas',
  ANCHOR_RECEPTION: 'recepcion',
  SUPPORT_STORAGE: null,
};

/** Rol de UNA pieza (sin tocar la pieza). null si no se reconoce. */
export function rolDePieza(p = {}) {
  const id = norm(`${p.piezaId || ''} ${p.productoId || p.producto || ''} ${p.source_ref || ''}`);
  const ruta = norm(p.ruta || '');
  const nombre = norm(p.nombre || '');
  const tipo = norm(p.tipo || '');
  const destino = destinoMarcado(p);               // vh-dest-* que viaja en `ruta`
  const texto = `${id} ${nombre}`;
  const esAsiento = tipo === 'asiento' || /silla|asiento|sillon|chair|seat|taburete/.test(texto);

  // --- Asientos (identidad del banco primero: ids reales de Von Haucke) ---
  if (esAsiento) {
    if (/alpha|energy|directiv|ejecutiv|presiden|gerenc/.test(texto)) return 'EXECUTIVE_SEAT';
    if (/sonata|junta|consejo|board|meeting/.test(texto) || destino === 'juntas') return 'MEETING_SEAT';
    if (/concerto|delta|re570|visita|espera|confidente/.test(texto)) return 'VISITOR_SEAT';
    if (destino === 'privado') return 'EXECUTIVE_SEAT';
    if (destino === 'recepcion') return 'VISITOR_SEAT';
    return 'WORK_SEAT';                           // WIN, GAMMA, DEX, C4… operativas
  }
  // --- Guardado ---
  if (/gaveta|pedestal|cajoner/.test(texto)) return 'UNDERDESK_STORAGE';
  if (/archiv|credenza|librero|locker|armario|guarda|modulor|storage/.test(texto)) return 'SUPPORT_STORAGE';
  // --- Anclas (ruta/producto de línea primero) ---
  if (/recepci|mostrador|lobby|rec-/.test(texto) || destino === 'recepcion' || tipo === 'recepcion') return 'ANCHOR_RECEPTION';
  if (/mesa_juntas|mesa_consejo|mesa de junta|mesa junta|mesa de consejo|mj-/.test(texto) || tipo === 'juntas') return 'ANCHOR_MEETING';
  const esEscritorioLinea = /banca|bench|escritorio|cantilever|qvadrat|estacion|workstation|op-|esc-|dir-|ger-/.test(texto) || tipo === 'escritorio';
  if (esEscritorioLinea) {
    const esOperativo = /banca|bench|op-|usuarios|puestos/.test(texto) || puestosDe(p.nombre) > 1;
    if (esOperativo && destino !== 'privado') return 'ANCHOR_WORKSTATION';
    if (/eclipse|drift|alba|luna|anteo|directiv|ejecutiv|gerenc|dir-|ger-|privad/.test(`${ruta} ${texto}`) || destino === 'privado') return 'ANCHOR_DESK';
    return 'ANCHOR_WORKSTATION';
  }
  return null;
}

/**
 * Enriquece las piezas EXPANDIDAS (nivel solver) que no traen rol. Devuelve copias.
 *  · relation_role + rol_inferido:true (si faltaba)
 *  · functional_group_id por ZONA inferida (open/privado/juntas/recepcion): el solver
 *    reparte sillas/gavetas entre las anclas del mismo grupo por capacidad
 *  · user_capacity del ancla: bench = puestos del nombre; privado = 1 + visitas del grupo
 * Las piezas con rol del programa se devuelven intactas (sólo se les completa grupo
 * si no lo traen, para que sus dependientes inferidos puedan encontrarlas).
 */
export function inferirRolFuncional(piezas = [], { areas = [] } = {}) {
  const out = (Array.isArray(piezas) ? piezas : []).map((p) => {
    if (!p || p.relation_role) return p;
    const rol = rolDePieza(p);
    return rol ? { ...p, relation_role: rol, rol_inferido: true } : p;
  });
  // Cuarto destino por tipo (zone_id = nombre del área canónica). Sólo se usa para
  // anclas sueltas de guardado, que no tienen filtro por tipo en el solver.
  const areaDe = (zona) => {
    const lista = Array.isArray(areas) ? areas : [];
    const porTipo = lista.find((a) => a && norm(a.tipo) === zona);
    const porNombre = lista.find((a) => a && ({ privado: /privad|ceo|direcc|gerenc/, open: /open|operativ|trabajo|bench/, juntas: /junta|consejo/, recepcion: /recepci|lobby/ }[zona] || /$^/).test(norm(a.nombre)));
    const a = porTipo || porNombre;
    return a ? (a.zone_id ?? a.nombre) : null;
  };
  // Grupo funcional por zona inferida (sólo cuando falta).
  // E2E real Torre Sur 14:01Z: credenza y archivero (SUPPORT_STORAGE) quedaban SIN grupo
  // y el kit-solver los trata como dependientes sin ancla → "2 piezas sin un mueble que
  // las reciba". El guardado de apoyo va con el privado (credenza Eclipse, archivero
  // "guarda de privado") cuando hay escritorio privado; si no, con el área operativa.
  const hayDesk = out.some((p) => p?.relation_role === 'ANCHOR_DESK');
  const zonaStorage = (p) => {
    const d = destinoMarcado(p);
    if (d === 'privado' || d === 'open' || d === 'juntas' || d === 'recepcion') return d;
    const t = norm(`${p.ruta || ''} ${p.piezaId || ''} ${p.nombre || ''}`);
    if (/eclipse|drift|alba|luna|anteo|directiv|ejecutiv|credenza/.test(t) && hayDesk) return 'privado';
    return hayDesk ? 'privado' : 'open';
  };
  const conGrupo = out.map((p) => {
    if (!p || p.functional_group_id || !p.relation_role) return p;
    // E2E real 14:2xZ: agrupar credenza+archivero como "gavetas" del escritorio los ENCIMÓ
    // (componerKit los pone bajo tablero: OVERLAP, hard FAIL). El guardado de apoyo es un
    // mueble LIBRE contra muro: va como ANCLA propia (kit de sí mismo, capacidad 0) en el
    // cuarto de su zona. Topología desconocida ⇒ el juez pide revisión, nunca falla.
    if (p.relation_role === 'SUPPORT_STORAGE' && p.rol_inferido) {
      const zona = zonaStorage(p);
      const zone_id = areaDe(zona);
      return { ...p, relation_role: 'ANCHOR_STORAGE', rol_original_inferido: 'SUPPORT_STORAGE', ...(zone_id ? { zone_id } : {}) };
    }
    const zona = ZONA_DE_ROL[p.relation_role];
    if (!zona) return p;
    return { ...p, functional_group_id: `inferido:${zona}`, grupo_inferido: true };
  });
  // Capacidad de las anclas inferidas.
  const visitasPorGrupo = new Map();
  for (const p of conGrupo) if (p?.relation_role === 'VISITOR_SEAT' && p.functional_group_id) visitasPorGrupo.set(p.functional_group_id, (visitasPorGrupo.get(p.functional_group_id) || 0) + 1);
  return conGrupo.map((p) => {
    if (!p || !p.rol_inferido || !ANCLAS.has(p.relation_role) || Number(p.user_capacity) > 0) return p;
    if (p.relation_role === 'ANCHOR_WORKSTATION') {
      const n = puestosDe(p.nombre);
      return n > 1 ? { ...p, user_capacity: n } : p;
    }
    if (p.relation_role === 'ANCHOR_DESK') {
      return { ...p, user_capacity: 1 + (visitasPorGrupo.get(p.functional_group_id) || 0) };
    }
    return p;
  });
}
