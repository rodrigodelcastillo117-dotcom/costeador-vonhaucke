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
import { capacidadDeNombre } from './capacidadDeclarada.js';

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
    const cantN0 = Math.max(1, Number(n.cantidad) || 1);
    // Fila repartida (una unidad de n con la estructura de SU instancia del programa). Conserva identidad,
    // precio y medidas de la persona; hereda zona/instancia/requerimiento de la instancia del programa.
    const filaRepartida = (prog, idxProg, id) => {
      tomados.add(idxProg);
      sustituidas.push({ de: prog.nombre || prog.bancoId || '?', a: n.nombre || '?', rol: rel, repartida: true, zona: prog.zone_id ?? null });
      return {
        ...n, id, cantidad: 1, ...estructuraDe(prog), relation_role: rel,
        anchor_role: n.anchor_role ?? prog.anchor_role ?? null, w: n.w ?? prog.w ?? null, d: n.d ?? prog.d ?? null,
        ...(Number(n.user_capacity) > 0 ? { user_capacity: Number(n.user_capacity) }
          : capacidadDeNombre(n.nombre, { w: n.w ?? prog.w, rol: rel }) ? { user_capacity: capacidadDeNombre(n.nombre, { w: n.w ?? prog.w, rol: rel }), user_capacity_inferida: true }
          : (Number(prog.user_capacity ?? prog.usuarios) > 0 ? { user_capacity: Number(prog.user_capacity ?? prog.usuarios) } : {})),
        sustituyePrograma: prog.bancoId || prog.piezaId || null, repartidaPorConciliacion: true,
      };
    };
    const opcionDe = (e) => ({ id: String(e.id), nombre: e.nombre || e.bancoId || '?', zona: e.zone_id ?? null });

    // VH-116 (al aplicar): un ancla de la persona YA vinculada a un requerimiento (la mesa ×2 que
    // confirmarPrograma ató a la SALA A) con cantidad ≥ 2, y anclas del programa del mismo rol en OTROS
    // requerimientos (SALA B). La cantidad NO prueba intención: sin decisión explícita no se mueve
    // ninguna unidad (NEEDS_REVIEW con opciones). Con decisión 'repartir' (o la instancia elegida) se
    // reparte UNA unidad por instancia destino, consumiendo esa instancia del programa.
    if (n.requirement_id && esAncla(rel) && cantN0 >= 2) {
      const otros = candidatos.filter(({ e }) => String(e.requirement_id || '') !== String(n.requirement_id));
      const porReq = new Map();
      for (const c of otros) { const k = String(c.e.requirement_id || c.e.instance_id || c.e.id); if (!porReq.has(k)) porReq.set(k, c); }
      const posibles = [...porReq.values()].slice(0, cantN0 - 1);
      if (posibles.length) {
        const elegidos = decision === 'repartir' ? posibles : posibles.filter(({ e }) => String(e.id) === String(decision));
        if (elegidos.length) {
          salida.push({ ...n, cantidad: cantN0 - elegidos.length, relation_role: rel });
          elegidos.forEach(({ e: prog, i: idxProg }, k) => salida.push(filaRepartida(prog, idxProg, `${n.id}#${k + 2}`)));
          continue;
        }
        if (decision == null) {
          ambiguas.push({ id: String(n.id), nombre: n.nombre || '?', rol: rel, cantidad: cantN0, zonaActual: n.zone_id ?? null, puedeRepartir: true, motivo: 'CANTIDAD_MAYOR_QUE_LUGAR', opciones: posibles.map(({ e }) => opcionDe(e)) });
        }
        salida.push(n); continue;   // decisión "conservar" o sin decisión: nada se mueve
      }
    }
    if (n.requirement_id) candidatos = candidatos.filter(({ e }) => String(e.requirement_id || '') === String(n.requirement_id));
    else if (decision != null && decision !== 'repartir') candidatos = candidatos.filter(({ e }) => String(e.id) === String(decision));
    else if (zonaDe(n) && decision !== 'repartir') candidatos = candidatos.filter(({ e }) => zonaDe(e) === zonaDe(n));
    if (!candidatos.length) { salida.push(n); continue; }
    // Sin evidencia de zona ni decisión: si los candidatos viven en zonas/anclas distintas, es
    // ambiguo → NEEDS_REVIEW (la persona decide), no se sustituye nada.
    if (!n.requirement_id && (decision == null || decision === 'repartir') && (!zonaDe(n) || decision === 'repartir')) {
      // Eje de identidad: para anclas el requerimiento/instancia; para dependientes SU ancla o grupo.
      // La zona sólo decide cuando la fila no trae identidad (filas legacy). Así dos filas del mismo kit
      // (misma mesa) no cuentan como dos zonas aunque una esté parchada con zone_id y la otra no.
      const ejeDe = (e) => {
        const identidad = esAncla(rel) ? (e.requirement_id || e.instance_id || '') : (e.anchor_instance_id || e.functional_group_id || '');
        return identidad ? `id:${identidad}` : `zona:${zonaDe(e) || ''}`;
      };
      const ejes = new Set(candidatos.map(({ e }) => ejeDe(e)));
      if (ejes.size > 1) {
        const porEje = new Map();
        for (const c of candidatos) { const k = ejeDe(c.e); if (!porEje.has(k)) porEje.set(k, c); }
        const destinos = [...porEje.values()];
        // VH-116: con decisión explícita 'repartir' y cantidad suficiente, una unidad por instancia/zona.
        if (decision === 'repartir' && esAncla(rel) && cantN0 >= destinos.length) {
          destinos.forEach(({ e: prog, i: idxProg }, k) => salida.push(filaRepartida(prog, idxProg, k === 0 ? n.id : `${n.id}#${k + 1}`)));
          const sobra = cantN0 - destinos.length;
          if (sobra > 0) salida.push({ ...n, id: `${n.id}#resto`, cantidad: sobra, relation_role: rel });
          continue;
        }
        ambiguas.push({ id: String(n.id), nombre: n.nombre || '?', rol: rel, cantidad: cantN0, puedeRepartir: esAncla(rel) && cantN0 >= destinos.length, opciones: candidatos.map(({ e }) => opcionDe(e)) });
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
      // VH-112: la capacidad que DECLARÓ la persona (explícita o en el nombre: "8 usuarios") manda sobre la
      // del módulo del programa (un módulo de 12 no convierte una banca de 8 en una de 12: sillas encimadas).
      ...(Number(n.user_capacity) > 0 ? { user_capacity: Number(n.user_capacity) }
        : capacidadDeNombre(n.nombre, { w: n.w ?? prog.w, rol: rel }) ? { user_capacity: capacidadDeNombre(n.nombre, { w: n.w ?? prog.w, rol: rel }), user_capacity_inferida: true }
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
