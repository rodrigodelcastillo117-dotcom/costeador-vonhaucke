// VH-152 · GEMELO ERP CERTIFICABLE. Por qué VONI "usa curados habiendo ERP exacto": la IA sólo ve el
// catálogo CURADO (por diseño) y muchos curados no tienen fuente certificada ("codigo SEMILLA sin fuente",
// "Compras, lista del 2026-08-14"), mientras Compras tiene el MISMO material con precio real de última
// compra (p. ej. curado `mdf` "MDF 19 mm" $437 sin fuente vs ERP `erp-mdf19` "MDF NATURAL HOJA 4 X 8
// ESPESOR 19 mm" $431.04 aprobado). Esta regla determinista propone el gemelo del ERP cuando coincide
// TÉCNICAMENTE (misma familia, mismo espesor/calibre, misma unidad y formato compatible) y el ERP sí es
// certificable. Es una PROPUESTA (SAME_FAMILY_COMPATIBLE_PROPOSED, por confirmar); nunca sustituye en
// silencio y nunca toca un material que la persona ya confirmó a mano.
import { familiaDeMaterial, espesoresDe, MATCH, severidadConflicto_, coloresExplicitos, fechaUltimaCompra } from './materialMatch.js';

const calibres = (t = '') => [...String(t).toLowerCase().matchAll(/\bcal(?:ibre)?\.?\s*(\d{1,2})\b/g)].map((m) => Number(m[1]));
// Todas las medidas en mm cuentan (una jaladera de 128 mm NO es gemela de una de 300 mm); el tope de 60 mm sólo
// aplica a tableros, donde "PIEZA DE 6000 mm" es largo y no espesor.
const esPanel = (fam) => ['mdf', 'melamina', 'laminado_hpl', 'chapa_madera', 'aglomerado', 'acrilico', 'cristal', 'triplay'].includes(fam);
// "16/19 mm" declara DOS medidas; el parser general sólo ve la que lleva "mm". Aquí se cuentan todas.
const medidasConBarra = (t = '') => [...String(t).toLowerCase().matchAll(/\b(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+)\s*mm\b/g)]
  .flatMap((m) => m[1].split('/').map((x) => Number(x.trim().replace(',', '.')))).filter((n) => Number.isFinite(n) && n > 0);
const medidasMM = (t = '') => [...new Set([...espesoresDe(t), ...medidasConBarra(t)])];
const espesoresPara = (t = '', fam = '') => (esPanel(fam) ? medidasMM(t).filter((x) => x <= 60) : medidasMM(t));
const unidadNorm = (u = '') => { const s = String(u || '').toLowerCase().trim(); return s === 'pieza' ? 'pza' : s === 'jgo' ? 'juego' : s; };
const esCertificable = (ins) => !!(ins && ins.evidencia && ins.evidencia.certificable === true);
// Igualdad de CONJUNTOS (no basta con que compartan un valor: "16/19 mm" no es "19 mm").
const mismoConjunto = (a, b) => { const A = [...new Set(a)].sort(), B = [...new Set(b)].sort(); return A.length === B.length && A.every((x, i) => x === B[i]); };
// Acabados explícitos (auditoría 13-oct: el gemelo no acepta diferencias de acabado). 'natural' no cuenta: en tableros
// significa "crudo/sin recubrir", que es el estado por omisión del curado.
const ACABADOS = [
  ['mate', /\bmate\b|matte/], ['brillante', /brillant|gloss/], ['satinado', /satin/], ['cromo', /cromad|\bcromo\b|chrome/],
  ['anodizado', /anodiz/], ['galvanizado', /galvaniz/], ['inoxidable', /inoxidable|\binox\b/], ['niquel', /n[ií]quel/],
  ['laca', /\blaca\b|lacad/], ['texturizado', /textur/], ['poro_abierto', /poro abierto/], ['poro_sellado', /poro sellado/],
];
const acabadosDe = (t = '') => { const s = String(t).toLowerCase(); return ACABADOS.filter(([, re]) => re.test(s)).map(([k]) => k).sort(); };
const formatoIgual = (a, b) => {
  const fa = a && a.formato, fb = b && b.formato;
  if (!fa && !fb) return true;
  if (!fa || !fb) return false;                                   // uno trae formato y el otro no: ausencia ≠ igualdad
  const dims = (f) => [Number(f.largoMM) || 0, Number(f.anchoMM) || 0].sort((x, y) => y - x);
  const [la, aa] = dims(fa), [lb, ab] = dims(fb);
  if (la > 0 && lb > 0) return Math.abs(la - lb) <= la * 0.01 && Math.abs(aa - ab) <= aa * 0.01;
  return Number(fa.medida) > 0 && Math.abs(Number(fa.medida) - Number(fb.medida)) <= Number(fa.medida) * 0.01;
};

/** ¿`fila` (ERP) es gemelo técnico exacto de `curado`? `pedido` = lo que pidió la persona/plano (material_solicitado + nombre de pieza):
 *  una medida o una especie/color explícita en el pedido que el ERP no cumple descalifica al gemelo. */
export function esGemeloExacto(curado, fila, pedido = '') {
  if (!curado || !fila || !fila.id || String(fila.id) === String(curado.id)) return false;
  if (fila.clasificacion !== 'erp' && !String(fila.id).startsWith('erp-')) return false;
  const famC = familiaDeMaterial(curado.nombre || curado.id), famF = familiaDeMaterial(fila.nombre || fila.id);
  if (!famC || famC !== famF) return false;
  const espC = espesoresPara(curado.nombre, famC), espF = espesoresPara(fila.nombre, famF);
  const calC = calibres(curado.nombre), calF = calibres(fila.nombre);
  if (!mismoConjunto(espC, espF)) return false;
  if (!mismoConjunto(calC, calF)) return false;
  // Color/especie y acabado: comparación SIMÉTRICA. Si el ERP declara "NEGRO", "ENCINO" o "CROMADO" y el curado no lo
  // declara (o al revés), no es el mismo artículo: la ausencia de un atributo NO prueba igualdad.
  if (!mismoConjunto(coloresExplicitos(curado.nombre), coloresExplicitos(fila.nombre))) return false;
  if (!mismoConjunto(acabadosDe(curado.nombre), acabadosDe(fila.nombre))) return false;
  if (!formatoIgual(curado, fila)) return false;
  // Identidad mínima: sin NINGÚN atributo contrastable (medida, calibre o formato) en ambos lados, la coincidencia sería
  // sólo de familia + unidad, y eso no es "exacto".
  if (!espC.length && !calC.length && !(curado.formato && fila.formato)) return false;
  // Lo PEDIDO manda: "jaladera recta 300 mm" vs ERP 128 mm, o "chapa nogal" vs ERP "ENCINO ROJO" → no es gemelo.
  // El gemelo no puede ser PEOR que el curado: si el curado ya difería de lo pedido en lo mismo (p.ej. pidió
  // MDF 18 mm, curado y ERP son 19 mm, par aprobado 18↔19), el gemelo no añade conflicto y sigue siendo gemelo.
  const ped = String(pedido || '').trim();
  if (ped && severidadConflicto_(famC, ped, fila.nombre || '').conflicto
      && !severidadConflicto_(famC, ped, curado.nombre || '').conflicto) return false;
  if (!unidadNorm(curado.unidad) || unidadNorm(curado.unidad) !== unidadNorm(fila.unidad)) return false;
  return true;
}

/** El mejor gemelo certificable entre varias filas del ERP: certificable, luego compra más reciente, luego precio presente. */
export function mejorGemeloCertificable(curado, filas = [], pedido = '') {
  const ok = (Array.isArray(filas) ? filas : []).filter((f) => esGemeloExacto(curado, f, pedido) && esCertificable(f) && f.precio != null);
  if (!ok.length) return null;
  // Compra REAL más reciente (no la fecha de modificación del registro).
  ok.sort((a, b) => { const fa = fechaUltimaCompra(a), fb = fechaUltimaCompra(b); return (fb > fa ? 1 : fb < fa ? -1 : 0) || String(a.id).localeCompare(String(b.id)); });
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
    const pedido = [c.material_solicitado, c.nombre].filter(Boolean).join(' · ');
    const g = mejorGemeloCertificable(curado, filas, pedido);
    if (!g) continue;
    if (typeof agregarInsumo === 'function') agregarInsumo(g);
    const previo = c.insumoId;
    c.insumoId = g.id; c.candidate_insumo_id = g.id; c.material_match = MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED;
    c._match = { ...(c._match || {}), clase: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED, candidate_insumo_id: g.id, resuelto: g.nombre, erp: true, gemelo: true, previo, autollenado: true, autocosteable: true,
      motivo: `Compras tiene el MISMO material con precio real de última compra${fechaUltimaCompra(g) ? ` (${fechaUltimaCompra(g)})` : ''}: ${g.nombre}. Sustituye al curado «${curado.nombre}» (sin precio certificado). Provisional: confírmalo.` };
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
