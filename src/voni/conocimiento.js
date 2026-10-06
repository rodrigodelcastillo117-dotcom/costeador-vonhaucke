// ============================================================================
// VONI · CONOCIMIENTO CANÓNICO VON HAUCKE
//
// FUENTES:
// - LINEAS_REG: líneas y configuraciones realmente implementadas/costeables.
// - acabados.js: catálogo real de melaminas y pintura.
// - catalogo.js: descripciones comerciales históricas, sólo como metadata.
//
// Regla de decisión:
// 1) LINE_PRODUCT si existe exactamente.
// 2) CONFIGURED_LINE_PRODUCT si sólo cambia una opción permitida.
// 3) DERIVED_SPECIAL si parte de una línea real pero sale de opciones/medidas.
// 4) NEW_SPECIAL sólo cuando no existe padre razonable.
// Nunca deformar un producto de línea para "hacerlo caber" al brief.
// ============================================================================
import { LINEAS_REG } from '../datos/lineas.js';
import { MELAMINA_POR_ESPESOR, PINTURA_COLORES } from '../datos/acabados.js';
import { LINEAS as LINEAS_META, MUEBLES } from '../datos/catalogo.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const uniq = (xs) => [...new Set((xs || []).filter(Boolean))];

const META = new Map((LINEAS_META || []).map((l) => [norm(l.nombre), l]));

export const PRINCIPIOS = [
  'Primero resolver con una línea/producto Von Haucke real; no inventar un especial si ya existe una solución.',
  'Una variante permitida conserva linaje y se trata como producto de línea configurado.',
  'Si el brief sale del set permitido pero existe un padre claro, se trata como especial derivado y conserva ese linaje.',
  'Von Haucke también fabrica mobiliario a la medida: si no existe padre razonable, se crea un especial nuevo con BOM y validación.',
  'Nunca sustituir silenciosamente medida, material, acabado, cancelería o variante. Todo ajuste debe quedar explícito.',
];

function paramsProducto(p = {}) {
  const out = {};
  if (p.largos?.length) out.largoMM = p.largos;
  if (p.fondos?.length) out.fondoMM = p.fondos;
  if (p.diametros?.length) out.diametroMM = p.diametros;
  if (p.usuarios?.length) out.usuarios = p.usuarios;
  if (p.largosLateral?.length) out.largoLateralMM = p.largosLateral;
  if (p.finishes?.length) out.finish = p.finishes.map((x) => x.id);
  if (p.colores?.length) out.color = p.colores.map((x) => x.id || x);
  if (p.biombo) out.biombo = ['cristal', 'melamina'];
  for (const s of p.selects || []) out[s.key] = (s.opciones || []).map((o) => o.id);
  return out;
}

export function acabadosVonHaucke() {
  const melamina = [];
  for (const [espesor, rows] of Object.entries(MELAMINA_POR_ESPESOR || {})) {
    for (const r of rows || []) melamina.push({ id:r.id, nombre:r.label, espesor_mm:Number(espesor), codigo:r.codigo });
  }
  return {
    melamina,
    pintura: (PINTURA_COLORES || []).map((x) => ({ id:x.id, nombre:x.label, codigo:x.codigo || null })),
  };
}

export function catalogoVonHauckeCompacto() {
  return Object.entries(LINEAS_REG).map(([ruta, L]) => {
    const meta = META.get(norm(L.titulo));
    return {
      ruta,
      linea: L.titulo,
      que: meta?.que || null,
      gama: meta?.gama ?? null,
      productos: (L.productos || []).map((p) => ({
        id:p.id,
        nombre:p.nombre,
        opciones:paramsProducto(p),
        checks:(p.checks || []).map((x) => x.key),
      })),
    };
  });
}

function tokensProducto(x) {
  const vals = [x.linea, x.ruta, ...(x.productos || []).flatMap((p) => [p.id, p.nombre])];
  return norm(vals.join(' '));
}

export function recomendar(query, max = 8) {
  const q = norm(query);
  if (!q.trim()) return [];
  const palabras = q.split(/\s+/).filter((x) => x.length >= 3);
  const out = [];
  for (const l of catalogoVonHauckeCompacto()) {
    const hay = tokensProducto(l);
    let score = 0;
    for (const w of palabras) if (hay.includes(w)) score += 1;
    // términos especialmente discriminantes del portafolio
    if (/cancel|mampar|division|muro|cristal|vidrio/.test(q) && /privacy|ergonova|biombo|cristal|mampara/.test(hay)) score += 5;
    if (/bench|operativ|workstation|estacion/.test(q) && /app|teamspace|spine|feather|via|rio/.test(hay)) score += 4;
    if (/recep|lobby|mostrador/.test(q) && /cirque|alba|eclipse|recep/.test(hay)) score += 4;
    if (/junta|consejo|conference|mesa/.test(q) && /cirque|alba|eclipse|mesa/.test(hay)) score += 3;
    if (score) out.push({ ...l, score });
  }
  return out.sort((a,b)=>b.score-a.score || a.linea.localeCompare(b.linea,'es')).slice(0,max);
}

export function explicar(nombreOId) {
  const q=norm(nombreOId);
  return catalogoVonHauckeCompacto().find((l)=>norm(l.linea)===q || norm(l.ruta)===q || q.includes(norm(l.linea))) || null;
}

export function conocimientoDe(query) {
  const acabados = acabadosVonHaucke();
  const recomendaciones = recomendar(query);
  return {
    principios: PRINCIPIOS,
    recomendaciones,
    linea: recomendaciones.length === 0 ? explicar(query) : null,
    a_la_medida_disponible: true,
    regla_custom: 'Usar NEW_SPECIAL sólo si ninguna línea/producto real es un padre razonable; si hay padre, conservarlo como DERIVED_SPECIAL.',
    acabados: {
      melamina: acabados.melamina,
      pintura: acabados.pintura,
      nota: 'Catálogo global real. La compatibilidad final depende del producto/generador; no asumir que todos los acabados aplican a todas las líneas.',
    },
  };
}

export function contextoCatalogoParaIA(query='') {
  return {
    principios: PRINCIPIOS,
    candidatos: recomendar(query, 10),
    catalogo_lineas: catalogoVonHauckeCompacto(),
    acabados: acabadosVonHaucke(),
    clasificacion_obligatoria: ['LINE_PRODUCT','CONFIGURED_LINE_PRODUCT','DERIVED_SPECIAL','NEW_SPECIAL'],
    regla: 'Antes de proponer NEW_SPECIAL, demuestra que ninguna línea/producto/configuración real resuelve el brief. Nunca cambies una línea real en silencio.',
  };
}

// Compatibilidad con código que presenta etiquetas de muebles del catálogo viejo.
export const legibles = (tipos = []) => tipos.map((t) => MUEBLES?.[t] || t);
