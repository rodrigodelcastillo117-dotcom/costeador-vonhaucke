// ============================================================================
//  BENCHING POR COMPONENTES — armar una banca sumando precios reales del Excel.
//  ---------------------------------------------------------------------------
//  Rodrigo (2026-08-18): las bancas casi nunca vienen completas en el catálogo
//  (una sola banca entera, pero 483 cubiertas + 135 estructuras + 129 patas).
//  Se cotizan sumando sus PIEZAS: cubierta + patas + omegas + conducto + biombo.
//
//  El despiece que ya calcula el modelo (`pieza.componentes`) nombra cada pieza
//  y su medida. El nudo: el modelo usa una CLAVE distinta a la del Excel para la
//  misma pieza (dice `RICUBRECI25ABS` cuando la cubierta real de Rio es
//  `RICUCECV75ABS`). Por eso NO se casa por clave: se casa por **tipo + medida +
//  material dentro de la línea**, la misma técnica del resolvedor de muebles.
//  Cada línea trae sus propias piezas en el Excel (Alba 95 cubiertas, App 51…),
//  así que el match vive dentro de la ruta.
//
//  Capa PURA. Se prueba offline contra el catálogo real.
// ============================================================================
import { PRECIOS_LINEA } from './preciosLinea.js';

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Tipo de un componente del despiece → sustantivo con el que empieza en el
// catálogo. `null` = no es una pieza que se cotice suelta (el canto va dentro
// de la cubierta; el faldón dentro del biombo), así que no cuenta ni suma.
export function tipoComponente(nombre) {
  const d = norm(nombre);
  if (/^CANTO\b/.test(d)) return null;
  if (/FALDON|SOPORTE/.test(d)) return null;
  if (/^CUBIERTA/.test(d)) return 'CUBIERTA';
  if (/^PATA/.test(d)) return 'PATA';
  if (/OMEGA|REFUERZO/.test(d)) return 'OMEGA';
  if (/CONDUCTO|DUCTO/.test(d)) return 'CONDUCTO';
  if (/BIOMBO/.test(d)) return 'BIOMBO';
  if (/CHAROLA/.test(d)) return 'CHAROLA';
  if (/RIEL/.test(d)) return 'RIEL';
  if (/PLACA/.test(d)) return 'PLACA';
  if (/^TAPA/.test(d)) return 'TAPA';
  if (/ESTRUCTURA|BASTIDOR/.test(d)) return 'ESTRUCTURA';
  return null;
}

/** El largo principal (mm) de la descripción del catálogo, o null. */
function largoCat(desc) {
  const d = norm(desc);
  const m = d.match(/\bDE\s+(?:Ø\s*)?(\d{3,4})\s*(?:X|MM|\b)/) || d.match(/\b(\d{3,4})\s*X\s*\d{2,4}/);
  return m ? Number(m[1]) : null;
}

// El material del componente, desde su insumo o su nombre → término del catálogo.
function materialComp(comp) {
  const s = norm((comp.insumoId || '') + ' ' + (comp.nombre || ''));
  if (/MELAMINA|ABS/.test(s)) return 'MELAMINA';
  if (/ACRILICO|PET|CRISTAL|VIDRIO/.test(s)) return 'ACRILICO';
  if (/LAMINA|PTR|METAL|ESCUADRA|PASACABLE|CHAROLA|DUCTO|PATA-METAL/.test(s)) return 'METAL';
  return null;
}
function materialCat(desc) {
  const d = norm(desc);
  if (/MELAMINA|ABS/.test(d)) return 'MELAMINA';
  if (/ACRILICO|PET|CRISTAL|VIDRIO/.test(d)) return 'ACRILICO';
  if (/METALIC|LAMINA|PTR|ACERO|ALUMINIO/.test(d)) return 'METAL';
  return null;
}

const TOL_MM = 60;   // tolerancia de medida (mm): "1500" casa con 1450–1560.

/**
 * Casa UN componente del despiece contra el catálogo de su línea.
 * @returns el artículo (forma mínima) o null si no hay pieza equivalente.
 */
export function casarComponente(ruta, comp) {
  const tipo = tipoComponente(comp.nombre);
  if (!tipo) return null;
  let pool = PRECIOS_LINEA.filter((a) => a.ruta === ruta && norm(a.d).startsWith(tipo));
  if (!pool.length) return null;
  const largo = Number(comp.largoMM) || null;
  if (largo) {
    const cerca = pool.filter((a) => { const L = largoCat(a.d); return L != null && Math.abs(L - largo) <= TOL_MM; });
    if (cerca.length) pool = cerca;
    // Si ninguna trae medida cercana, se queda el pool por tipo (mejor el más
    // barato del tipo que nada); la medida ya afinó lo que pudo.
  }
  const mat = materialComp(comp);
  if (mat) {
    const conMat = pool.filter((a) => materialCat(a.d) === mat);
    if (conMat.length) pool = conMat;
  }
  // El más barato que cumple: no inflar la banca eligiendo la variante cara.
  const elegido = pool.slice().sort((a, b) => (a.l || 0) - (b.l || 0))[0];
  return { clave: elegido.c, descripcion: elegido.d, lista: elegido.l, full: elegido.f, minimo: elegido.m };
}

/**
 * Cotiza una banca sumando sus componentes del catálogo.
 * @param {string} ruta
 * @param {Array} componentes  el `pieza.componentes` del despiece del modelo
 * @returns {{ estado:'ok'|'parcial'|'ninguno', precio, full, casados, cotizables, lineas, faltan }}
 *   · precio = suma de (lista × piezas) de lo casado.
 *   · estado 'ok' si casó TODO lo cotizable; 'parcial' si faltó algo; 'ninguno'
 *     si no casó nada (el llamador se queda con el modelo).
 */
export function cotizarPorComponentes(ruta, componentes) {
  const lineas = [];
  const faltan = [];
  let precio = 0, full = 0, cotizables = 0;
  for (const comp of componentes || []) {
    const tipo = tipoComponente(comp.nombre);
    if (!tipo) continue;                 // canto/faldón: no es pieza suelta
    cotizables++;
    const piezas = Math.max(1, Number(comp.piezas) || 1);
    const art = casarComponente(ruta, comp);
    if (art) {
      precio += art.lista * piezas;
      full += (art.full || art.lista) * piezas;
      lineas.push({ tipo, piezas, clave: art.clave, lista: art.lista, descripcion: art.descripcion });
    } else {
      faltan.push({ tipo, largoMM: comp.largoMM || null, nombre: comp.nombre });
    }
  }
  const casados = lineas.length;
  if (!casados) return { estado: 'ninguno', precio: 0, full: 0, casados: 0, cotizables, lineas, faltan };
  return {
    estado: faltan.length ? 'parcial' : 'ok',
    precio, full, casados, cotizables, lineas, faltan,
  };
}
