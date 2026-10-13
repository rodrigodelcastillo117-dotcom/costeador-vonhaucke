// VH-152 · GEMELO ERP CERTIFICABLE. Por qué VONI "usa curados habiendo ERP exacto": la IA sólo ve el
// catálogo CURADO (por diseño) y muchos curados no tienen fuente certificada ("codigo SEMILLA sin fuente",
// "Compras, lista del 2026-08-14"), mientras Compras tiene el MISMO material con precio real de última
// compra (p. ej. curado `mdf` "MDF 19 mm" $437 sin fuente vs ERP `erp-mdf19` "MDF NATURAL HOJA 4 X 8
// ESPESOR 19 mm" $431.04 aprobado). Esta regla determinista propone el gemelo del ERP cuando coincide
// TÉCNICAMENTE (misma familia, mismo espesor/calibre, misma unidad y formato compatible) y el ERP sí es
// certificable. Es una PROPUESTA (SAME_FAMILY_COMPATIBLE_PROPOSED, por confirmar); nunca sustituye en
// silencio y nunca toca un material que la persona ya confirmó a mano.
import { familiaDeMaterial, espesoresDe, MATCH } from './materialMatch.js';

const calibres = (t = '') => [...String(t).toLowerCase().matchAll(/\bcal(?:ibre)?\.?\s*(\d{1,2})\b/g)].map((m) => Number(m[1]));
const espesores = (t = '') => espesoresDe(t).filter((x) => x <= 60);
const unidadNorm = (u = '') => { const s = String(u || '').toLowerCase().trim(); return s === 'pieza' ? 'pza' : s === 'jgo' ? 'juego' : s; };
const esCertificable = (ins) => !!(ins && ins.evidencia && ins.evidencia.certificable === true);
const mismoConjunto = (a, b) => (!a.length && !b.length) || (a.length > 0 && b.length > 0 && a.some((x) => b.includes(x)));

/** ¿`fila` (ERP) es gemelo técnico exacto de `curado`? */
export function esGemeloExacto(curado, fila) {
  if (!curado || !fila || !fila.id || String(fila.id) === String(curado.id)) return false;
  if (fila.clasificacion !== 'erp' && !String(fila.id).startsWith('erp-')) return false;
  const famC = familiaDeMaterial(curado.nombre || curado.id), famF = familiaDeMaterial(fila.nombre || fila.id);
  if (!famC || famC !== famF) return false;
  if (!mismoConjunto(espesores(curado.nombre), espesores(fila.nombre))) return false;
  if (!mismoConjunto(calibres(curado.nombre), calibres(fila.nombre))) return false;
  if (unidadNorm(curado.unidad) !== unidadNorm(fila.unidad)) return false;
  // Si el curado se consume por área con formato, el ERP también debe traer formato (si no, P0-02 lo deja pendiente).
  if (curado.formato && curado.fraccion && !(fila.formato && fila.formato.medida > 0)) return false;
  return true;
}

/** El mejor gemelo certificable entre varias filas del ERP: certificable, luego compra más reciente, luego precio presente. */
export function mejorGemeloCertificable(curado, filas = []) {
  const ok = (Array.isArray(filas) ? filas : []).filter((f) => esGemeloExacto(curado, f) && esCertificable(f) && f.precio != null);
  if (!ok.length) return null;
  ok.sort((a, b) => (String(b.actualizado || '') > String(a.actualizado || '') ? 1 : String(b.actualizado || '') < String(a.actualizado || '') ? -1 : 0) || String(a.id).localeCompare(String(b.id)));
  return ok[0];
}

/** Término de búsqueda para el ERP a partir del nombre curado ("MDF 19 mm" → "mdf 19 mm"). */
export function consultaGemelo(curado) {
  const t = String(curado?.nombre || '').toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const palabras = t.split(' ').filter((w) => w.length > 1 && !['de', 'la', 'el', 'y', 'con', 'sin', 'para'].includes(w));
  return palabras.slice(0, 4).join(' ');
}

/**
 * Para cada componente con insumo CURADO sin precio certificable y sin confirmación humana, busca en el
 * ERP y propone el gemelo certificable. `buscar(q, n)` = buscarInsumosMotor. Devuelve copias; no muta.
 */
export async function proponerGemelosErp(componentes = [], { insumos = {}, buscar, agregarInsumo } = {}) {
  const out = (Array.isArray(componentes) ? componentes : []).map((c) => ({ ...c }));
  const propuestos = [];
  if (typeof buscar !== 'function') return { comps: out, propuestos };
  const cache = new Map();
  for (const c of out) {
    if (!c || !c.insumoId || c.excluida || c.material_confirmado === true || c?._match?.confirmado_por_usuario) continue;
    if (String(c.insumoId).startsWith('erp-')) continue;
    const curado = insumos[c.insumoId];
    if (!curado || esCertificable(curado)) continue;
    const q = consultaGemelo(curado); if (q.length < 3) continue;
    // Dos consultas (con y sin "mm": el ERP escribe "ESPESOR 19 mm" y también "19MM"/"19 MM") y tope 60: la búsqueda
    // del servidor es ILIKE por tokens y con 30 filas los enchapados tapaban al "MDF NATURAL ... 19 mm".
    const consultas = [...new Set([q, q.replace(/\bmm\b/g, '').replace(/\s+/g, ' ').trim()])].filter((x) => x.length >= 3);
    let filas = cache.get(q);
    if (!filas) {
      filas = []; const vistos = new Set();
      for (const qq of consultas) { let r = []; try { r = await buscar(qq, 60); } catch (_e) { r = []; } for (const f of (r || [])) if (f && f.id && !vistos.has(f.id)) { vistos.add(f.id); filas.push(f); } }
      cache.set(q, filas);
    }
    const g = mejorGemeloCertificable(curado, filas);
    if (!g) continue;
    if (typeof agregarInsumo === 'function') agregarInsumo(g);
    const previo = c.insumoId;
    c.insumoId = g.id; c.candidate_insumo_id = g.id; c.material_match = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED;
    c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, candidate_insumo_id: g.id, resuelto: g.nombre, erp: true, gemelo: true, previo, autollenado: true, autocosteable: true,
      motivo: `Compras tiene el MISMO material con precio real de última compra${g.actualizado ? ` (${String(g.actualizado).slice(0, 10)})` : ''}: ${g.nombre}. Sustituye al curado «${curado.nombre}» (sin precio certificado). Provisional: confírmalo.` };
    propuestos.push({ nombre: c.nombre, previo, id: g.id, insumoNombre: g.nombre, precio: g.precio == null ? null : Number(g.precio), precioPrevio: curado.precio ?? curado.precioBase ?? null });
  }
  return { comps: out, propuestos };
}

/** Fusión tardía sobre el BOM vigente: sólo si la pieza sigue con el MISMO curado y sin confirmación humana. */
export function fusionarGemelosEnBom(actuales = [], propuestosComps = []) {
  const act = Array.isArray(actuales) ? actuales : [];
  if (!Array.isArray(propuestosComps) || act.length !== propuestosComps.length) return act;
  return act.map((c, i) => {
    const p = propuestosComps[i];
    if (!c || !p || c.nombre !== p.nombre || !p?._match?.gemelo) return c;
    if (c.material_confirmado === true || c?._match?.confirmado_por_usuario || c.insumoId !== p._match.previo) return c;
    return { ...c, insumoId: p.insumoId, candidate_insumo_id: p.candidate_insumo_id, material_match: p.material_match, _match: p._match };
  });
}

// VH-151 · TAMAÑO DE HOJA ≠ PIEZA. La IA a veces pone como largo×ancho de una pieza el tamaño de la hoja
// comercial (1220×2440) en vez de la pieza real; el motor la rechaza ("no cabe en el formato") sin decir por
// qué. Aquí se detecta de forma determinista para avisar y pedir la corrección (no se inventa la pieza).
export function piezasConTamanoDeHoja(componentes = [], insumos = {}) {
  const out = [];
  for (const c of Array.isArray(componentes) ? componentes : []) {
    if (!c || c.excluida || !(Number(c.largoMM) > 0 && Number(c.anchoMM) > 0)) continue;
    const ins = insumos[c.insumoId]; const f = ins && ins.formato;
    const L = Math.max(Number(c.largoMM), Number(c.anchoMM)), A = Math.min(Number(c.largoMM), Number(c.anchoMM));
    const fl = f && Math.max(Number(f.largoMM) || 0, Number(f.anchoMM) || 0), fa = f && Math.min(Number(f.largoMM) || 0, Number(f.anchoMM) || 0);
    const hojasConocidas = [[2440, 1220], [2440, 1525], [3048, 914], [3050, 1220]];
    const cerca = (x, y) => Math.abs(x - y) <= Math.max(25, y * 0.03);
    const esHoja = (fl > 0 && fa > 0 && cerca(L, fl) && cerca(A, fa)) || hojasConocidas.some(([hl, ha]) => cerca(L, hl) && cerca(A, ha));
    const excede = fl > 0 && fa > 0 && (L > fl * 1.03 || A > fa * 1.03);
    if (esHoja || excede) out.push({ nombre: c.nombre, largoMM: c.largoMM, anchoMM: c.anchoMM, motivo: esHoja ? 'TAMANO_HOJA' : 'EXCEDE_FORMATO', formato: f ? `${f.largoMM}×${f.anchoMM}` : null });
  }
  return out;
}
