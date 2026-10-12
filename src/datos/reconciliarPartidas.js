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

/**
 * @param {Array} existentes partidas ya en el proyecto
 * @param {Array} nuevas     partidas que entran (VONI texto / banco)
 * @returns {{ partidas: Array, sustituidas: Array<{de:string, a:string, rol:string}> }}
 */
export function reconciliarNuevasConPrograma(existentes = [], nuevas = []) {
  const ex = Array.isArray(existentes) ? existentes : [];
  const nu = Array.isArray(nuevas) ? nuevas : [];
  const tomados = new Set();
  const sustituidas = [];
  const salida = [];

  for (const n of nu) {
    const rel = n.relation_role || inferRole(n);
    // Idempotente: una fila que YA sustituyó a una del programa no vuelve a consumir otra
    // (p. ej. SONATA ya conciliada no se come también a CONCERTO en la segunda aplicación).
    if (!rel || n.sustituyePrograma) { salida.push(n); continue; }
    const candidatos = ex.map((e, i) => ({ e, i })).filter(({ e, i }) => !tomados.has(i) && esDelPrograma(e) && (e.relation_role || inferRole(e)) === rel);
    if (!candidatos.length) { salida.push(n); continue; }
    // Mismo rol: prefiere la fila del programa cuyo producto es el MISMO modelo (silla-sonata ⊂
    // p9-silla-sonata-…); si no, la primera. Así SONATA sustituye a SONATA y no a CONCERTO.
    const idN = String(n.piezaId || n.bancoId || '').toLowerCase();
    const mismoModelo = candidatos.find(({ e }) => { const b = String(e.bancoId || e.piezaId || '').toLowerCase(); return b && idN.includes(b.replace(/^silla-/, 'silla-')); });
    const prog = (mismoModelo || candidatos[0]).e;
    tomados.add(ex.indexOf(prog));
    sustituidas.push({ de: prog.nombre || prog.bancoId || '?', a: n.nombre || '?', rol: rel });
    salida.push({
      ...n,
      ...estructuraDe(prog),
      relation_role: rel,
      anchor_role: n.anchor_role ?? prog.anchor_role ?? null,
      // Geometría: la del usuario si la trae; si no, la del producto del programa.
      w: n.w ?? prog.w ?? null,
      d: n.d ?? prog.d ?? null,
      ...(esAncla(rel) && !(Number(n.user_capacity) > 0) && Number(prog.user_capacity ?? prog.usuarios) > 0
        ? { user_capacity: Number(prog.user_capacity ?? prog.usuarios) } : {}),
      sustituyePrograma: prog.bancoId || prog.piezaId || null,
    });
  }
  const restantes = ex.filter((_, i) => !tomados.has(i));
  return { partidas: [...restantes, ...salida], sustituidas };
}
