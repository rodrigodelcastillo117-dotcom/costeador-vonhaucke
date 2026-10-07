// ============================================================================
//  resolverPrograma · PRODUCT RESOLVER del programa (P0.1).
//  Cierra el cuello de botella: FloorSpec → ProgramRequirement → PRODUCTO REAL
//  → configuración real → partida confirmable (con identidad) → anchor → layout.
//
//  Problema que erradica (#102): el camino del programa fabricaba geometría con
//  `ceil(n/2)*1500` (10u → 7500) e inventaba partidas `sug-*` sin productoId ni
//  precio. Aquí NO se inventa nada: cada requerimiento se resuelve contra un
//  producto REAL del BANCO (banco.js) por usuarios/medidas, con composición
//  determinista para capacidades no exactas (ej. 5u = 4u + 1u). El 10u resuelve
//  al módulo real `op-10u-6000x1200-cristal` (6000×1200), NUNCA 7500.
//
//  Reglas duras: solo productos reales del BANCO; nunca `sug-*`; nunca $0; nunca
//  geometría inventada; un dependiente sin ancla NO se resuelve aquí (lo bloquea
//  `coherenciaPrograma`). Funciones puras/testeables.
// ============================================================================
import { BANCO } from './banco.js';

// "6000 × 1200 mm" / "Ø 600 × 398 mm" / "2420 × 830 mm" → { w, d } en mm.
export function medidasAwd(medidas) {
  const s = String(medidas || '').replace(/mm/gi, '').replace(/[Øø]/g, ' ');
  const m = s.match(/(\d[\d.,]*)\s*[×x]\s*(\d[\d.,]*)/);
  if (!m) return null;
  const num = (t) => Math.round(parseFloat(String(t).replace(/,/g, '')));
  const w = num(m[1]); const d = num(m[2]);
  return (Number.isFinite(w) && Number.isFinite(d) && w > 0 && d > 0) ? { w, d } : null;
}

// Resolvemos SOLO contra los módulos CANÓNICOS del banco (carga limpia Tradeco,
// ids `op-Nu-WxH`/`esc-`/`ger-`/`dir-`/`mj-`/`rec-`, con geometría y precio reales),
// no contra los renglones `p9-*` del Excel (geometría inconsistente). Una sola verdad.
const MODULOS_OPERATIVOS = BANCO.filter((b) => /^op-\d+u-/.test(String(b.id)) && Number(b.usuarios) > 0);
const ESCRITORIOS = BANCO.filter((b) => /^(esc|ger|dir)-/.test(String(b.id)));
const MESAS_JUNTAS = BANCO.filter((b) => /^mj-/.test(String(b.id)) && Number(b.usuarios) > 0);
const RECEPCIONES = BANCO.filter((b) => /^rec-/.test(String(b.id)));

// Normaliza un producto del banco a una RESOLUCIÓN con geometría real + identidad.
function resolucion(prod, { requerimiento, anchor_role, zona = null, cantidad = 1 }) {
  if (!prod) return null;
  const wd = medidasAwd(prod.medidas);
  return {
    requerimiento,
    bancoId: prod.id,
    source_ref: prod.id,     // para conIdentidadV2 (producto_maestro ids_por_ref)
    source_type: 'banco',
    nombre: prod.nombre,
    linea: prod.linea || null,
    usuarios: Number(prod.usuarios) || null,
    w: wd ? wd.w : null,
    d: wd ? wd.d : null,
    precio: Number(prod.precio) || null,   // precio de proyecto cerrado (real); NO $0
    anchor_role,
    zona,
    cantidad,
    source: 'RESUELTO',      // jamás 'SUGERIDO'/'sug-*'
  };
}

// --- OPERATIVOS: N usuarios → módulo(s) real(es). Exacto o compuesto. ---
export function resolverOperativos(nUsuarios, { linea = 'App LT' } = {}) {
  const n = Math.max(0, Math.floor(Number(nUsuarios) || 0));
  if (!n) return { resoluciones: [], faltante: 0, usuariosCubiertos: 0 };
  const disp = MODULOS_OPERATIVOS
    .filter((m) => (linea ? m.linea === linea : true) && Number(m.usuarios) > 0)
    .sort((a, b) => b.usuarios - a.usuarios); // mayor → menor para empaque greedy

  // Exacto primero.
  const exacto = disp.find((m) => m.usuarios === n);
  if (exacto) return { resoluciones: [resolucion(exacto, { requerimiento: 'operativo', anchor_role: 'ANCHOR_WORKSTATION', cantidad: 1 })], faltante: 0, usuariosCubiertos: n };

  // Composición determinista: greedy del módulo mayor que no exceda el restante.
  const resoluciones = [];
  let restante = n;
  const acumula = (prod) => {
    const prev = resoluciones.find((r) => r.bancoId === prod.id);
    if (prev) prev.cantidad += 1; else resoluciones.push(resolucion(prod, { requerimiento: 'operativo', anchor_role: 'ANCHOR_WORKSTATION', cantidad: 1 }));
  };
  while (restante > 0) {
    const cabe = disp.find((m) => m.usuarios <= restante);
    if (!cabe) break; // no hay módulo de 1u (no debería pasar en App LT)
    acumula(cabe);
    restante -= cabe.usuarios;
  }
  const usuariosCubiertos = n - restante;
  return { resoluciones, faltante: restante, usuariosCubiertos };
}

// --- PRIVADO / CEO: escritorio directivo real. ---
export function resolverPrivado() {
  const prod = ESCRITORIOS.find((e) => /directivo/i.test(e.nombre || ''))
    || ESCRITORIOS.find((e) => /gerente/i.test(e.nombre || '') && /1800/.test(e.medidas || ''))
    || ESCRITORIOS.find((e) => /escritorio/i.test(e.nombre || ''));
  return resolucion(prod, { requerimiento: 'privado', anchor_role: 'ANCHOR_DESK', cantidad: 1 });
}

// --- JUNTAS: capacidad → mesa real con usuarios >= capacidad (la más chica que cubre). ---
export function resolverJuntas(capacidad) {
  const cap = Math.max(1, Math.floor(Number(capacidad) || 0));
  const porCapacidad = MESAS_JUNTAS.slice().sort((a, b) => a.usuarios - b.usuarios);
  const prod = porCapacidad.find((m) => m.usuarios >= cap) || porCapacidad[porCapacidad.length - 1];
  return resolucion(prod, { requerimiento: 'juntas', anchor_role: 'ANCHOR_MEETING', cantidad: 1 });
}

// --- RECEPCIÓN: módulo recepción real. ---
export function resolverRecepcion() {
  const prod = RECEPCIONES[0] || BANCO.find((b) => /recep/i.test(b.nombre || ''));
  return resolucion(prod, { requerimiento: 'recepcion', anchor_role: 'ANCHOR_RECEPTION', cantidad: 1 });
}

// --- ORQUESTADOR: programa (de programaDelPlano) → ProgramRequirement[] + ProductResolution[]. ---
// `programa`: { operativos, privados, salas:[capacidades], recepcion:bool }.
export function resolverPrograma(programa = {}, { linea = 'App LT' } = {}) {
  const requerimientos = [];
  const resoluciones = [];
  const incompletos = [];
  const push = (r) => { if (r) resoluciones.push(r); };

  const nOp = Math.max(0, Math.floor(Number(programa.operativos) || 0));
  if (nOp > 0) {
    requerimientos.push({ rol: 'operativo', anchor_role: 'ANCHOR_WORKSTATION', capacidad: nOp });
    const op = resolverOperativos(nOp, { linea });
    op.resoluciones.forEach(push);
    if (op.faltante > 0) incompletos.push({ code: 'OPERATIVO_NO_RESUELTO', faltante: op.faltante });
  }

  const nPriv = Math.max(0, Math.floor(Number(programa.privados) || 0));
  for (let i = 0; i < nPriv; i++) {
    requerimientos.push({ rol: 'privado', anchor_role: 'ANCHOR_DESK', capacidad: 1 });
    const r = resolverPrivado();
    if (r) push(r); else incompletos.push({ code: 'PRIVADO_NO_RESUELTO' });
  }

  const salas = Array.isArray(programa.salas) ? programa.salas : [];
  for (const cap of salas) {
    requerimientos.push({ rol: 'juntas', anchor_role: 'ANCHOR_MEETING', capacidad: Number(cap) || 0 });
    const r = resolverJuntas(cap);
    if (r) push(r); else incompletos.push({ code: 'JUNTAS_NO_RESUELTO', capacidad: cap });
  }

  if (programa.recepcion) {
    requerimientos.push({ rol: 'recepcion', anchor_role: 'ANCHOR_RECEPTION', capacidad: 1 });
    const r = resolverRecepcion();
    if (r) push(r); else incompletos.push({ code: 'RECEPCION_NO_RESUELTO' });
  }

  return {
    ok: incompletos.length === 0 && resoluciones.length > 0,
    requerimientos,
    resoluciones,
    incompletos,
    // Invariante: cada resolución es un producto REAL (bancoId + precio > 0), nunca sug-*.
    todasReales: resoluciones.every((r) => r.bancoId && Number(r.precio) > 0 && r.source === 'RESUELTO'),
  };
}
