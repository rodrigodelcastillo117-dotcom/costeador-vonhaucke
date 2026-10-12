// ============================================================================
//  VH-090 (2026-10-12) · RECONCILIAR lo que describe una persona (VONI texto /
//  banco / catálogo) con lo que el PROGRAMA DEL PLANO ya puso en el proyecto.
//
//  Caso real (cotización 757): el plano se leyó primero y "Aplicar programa"
//  puso 7 partidas genéricas (op-8u, dir-1800x2400, mj-900x900, sillas…). Después
//  la persona describió el mobiliario con VONI y entraron 11 partidas con OTROS
//  ids (linea-banca_doble, p9-silla-operativa-win…). `juntarIguales` sólo funde
//  renglones idénticos → todo quedó DOBLE: 18 sillas para 10 puestos, dos mesas
//  de juntas, dos módulos directivos.
//
//  Regla: para el mismo ROL funcional, la partida que eligió la persona SUSTITUYE
//  a la genérica del programa y HEREDA su estructura (relation_role, instancia,
//  grupo, zona, ancla, capacidad) para que el acomodo siga sabiendo qué es. Nunca
//  se tocan precio/costo. Puro y determinista.
// ============================================================================
import { inferRole, esAncla, estructuraDe } from './confirmarPrograma.js';

const esDelPrograma = (p) => !!p && p.source === 'CONFIRMADO_PROGRAMA';

const norm = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const zonaDe = (p) => norm(p.zone_id ?? p.zonaSugerida ?? p.zona_destino ?? p.zonaDestino ?? '') || null;

/**
 * Release gate (2026-10-13): la conciliación respeta `requirement_id`, `zone_id`, ancla y grupo
 * funcional. Con VARIOS candidatos del programa en zonas distintas y una partida nueva SIN
 * evidencia de zona ni decisión explícita → NEEDS_REVIEW (`ambiguas`), nunca sustitución
 * automática. Cantidades parciales en dependientes: lo que la persona describió sustituye esa
 * parte y el resto del programa se conserva (nunca se borra un requerimiento del plano).
 *
 * @param {Array} existentes partidas ya en el proyecto
 * @param {Array} nuevas     partidas que entran (VONI texto / banco)
 * @param {{decisiones?: Record<string,string>}} opts  decisiones explícitas: id de partida nueva → id de la fila del programa que sustituye
 * @returns {{ partidas: Array, sustituidas: Array<{de:string, a:string, rol:string, parcial?:boolean, capacidadDistinta?:boolean}>, ambiguas: Array<{id:string, nombre:string, rol:string, opciones:Array<{id:string, nombre:string, zona:string|null}>}> }}
 */
export function reconciliarNuevasConPrograma(existentes = [], nuevas = [], { decisiones = {} } = {}) {
  const ex = Array.isArray(existentes) ? existentes : [];
  const nu = Array.isArray(nuevas) ? nuevas : [];
  const tomados = new Set();
  const ajustes = new Map();                    // índice existente → cantidad restante (parcial)
  const sustituidas = [];
  const ambiguas = [];
  const salida = [];

  for (const n of nu) {
    const rel = n.relation_role || inferRole(n);
    // Idempotente: una fila que YA sustituyó a una del programa no vuelve a consumir otra
    // (p. ej. SONATA ya conciliada no se come también a CONCERTO en la segunda aplicación).
    if (!rel || n.sustituyePrograma) { salida.push(n); continue; }
    let candidatos = ex.map((e, i) => ({ e, i })).filter(({ e, i }) => !tomados.has(i) && esDelPrograma(e) && (e.relation_role || inferRole(e)) === rel);
    if (!candidatos.length) { salida.push(n); continue; }
    // 1) Identidad del requerimiento manda; 2) decisión explícita de la persona; 3) misma zona.
    const decision = decisiones && n.id != null ? decisiones[String(n.id)] : null;
    if (n.requirement_id) candidatos = candidatos.filter(({ e }) => String(e.requirement_id || '') === String(n.requirement_id));
    else if (decision != null) candidatos = candidatos.filter(({ e }) => String(e.id) === String(decision));
    else if (zonaDe(n)) candidatos = candidatos.filter(({ e }) => zonaDe(e) === zonaDe(n));
    if (!candidatos.length) { salida.push(n); continue; }
    // Sin evidencia de zona ni decisión: si los candidatos viven en zonas/anclas distintas, es
    // ambiguo → NEEDS_REVIEW (la persona decide), no se sustituye nada.
    if (!n.requirement_id && decision == null && !zonaDe(n)) {
      // Eje de identidad: para anclas el requerimiento/instancia; para dependientes SU ancla o grupo.
      // La zona sólo decide cuando la fila no trae identidad (filas legacy). Así dos filas del mismo kit
      // (misma mesa) no cuentan como dos zonas aunque una esté parchada con zone_id y la otra no.
      const ejeDe = (e) => {
        const identidad = esAncla(rel) ? (e.requirement_id || e.instance_id || '') : (e.anchor_instance_id || e.functional_group_id || '');
        return identidad ? `id:${identidad}` : `zona:${zonaDe(e) || ''}`;
      };
      const ejes = new Set(candidatos.map(({ e }) => ejeDe(e)));
      if (ejes.size > 1) {
        ambiguas.push({ id: String(n.id), nombre: n.nombre || '?', rol: rel, opciones: candidatos.map(({ e }) => ({ id: String(e.id), nombre: e.nombre || e.bancoId || '?', zona: e.zone_id ?? null })) });
        salida.push(n); continue;
      }
    }
    // Mismo rol y misma zona: prefiere el MISMO modelo (silla-sonata ⊂ p9-silla-sonata-…); si no, el primero.
    const idN = String(n.piezaId || n.bancoId || '').toLowerCase();
    const mismoModelo = candidatos.find(({ e }) => { const b = String(e.bancoId || e.piezaId || '').toLowerCase(); return b && idN.includes(b); });
    const { e: prog, i: idxProg } = mismoModelo || candidatos[0];
    const cantN = Math.max(1, Number(n.cantidad) || 1);
    const cantP = Math.max(1, Number(prog.cantidad) || 1);
    const parcial = !esAncla(rel) && cantP > cantN;
    if (parcial) ajustes.set(idxProg, cantP - cantN); else tomados.add(idxProg);
    const capN = Number(n.user_capacity ?? n.usuarios) || null; const capP = Number(prog.user_capacity ?? prog.usuarios) || null;
    sustituidas.push({ de: prog.nombre || prog.bancoId || '?', a: n.nombre || '?', rol: rel, ...(parcial ? { parcial: true, restante: cantP - cantN } : {}), ...(esAncla(rel) && capN && capP && capN !== capP ? { capacidadDistinta: true, capacidadPrograma: capP, capacidadNueva: capN } : {}) });
    salida.push({
      ...n,
      ...estructuraDe(prog),
      relation_role: rel,
      anchor_role: n.anchor_role ?? prog.anchor_role ?? null,
      // Geometría: la del usuario si la trae; si no, la del producto del programa.
      w: n.w ?? prog.w ?? null,
      d: n.d ?? prog.d ?? null,
      // Capacidad: la del mueble que eligió la persona si la declara; si no, la del programa.
      ...(Number(n.user_capacity) > 0 ? { user_capacity: Number(n.user_capacity) }
        : (esAncla(rel) && Number(prog.user_capacity ?? prog.usuarios) > 0 ? { user_capacity: Number(prog.user_capacity ?? prog.usuarios) } : {})),
      sustituyePrograma: prog.bancoId || prog.piezaId || null,
    });
  }
  const restantes = ex.filter((_, i) => !tomados.has(i)).map((e) => {
    const i = ex.indexOf(e);
    return ajustes.has(i) ? { ...e, cantidad: ajustes.get(i), cantidadAjustadaPorConciliacion: true } : e;
  });
  return { partidas: [...restantes, ...salida], sustituidas, ambiguas };
}
