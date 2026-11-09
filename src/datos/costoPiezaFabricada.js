// ============================================================================
//  COSTO DE PIEZA FABRICADA (directiva Direccion 2026-11-09).
//  --------------------------------------------------------------------------
//  Una pieza fabricada (omega, cuerpo, puerta, frente...) NO es un SKU comprable:
//  se costea desde su MATERIA PRIMA (lamina comercial) + sus OPERACIONES. Este
//  modulo hace SOLO la parte fisica de materia prima, y REUSA el motor de
//  produccion (src/motor/calculo.js: piezasPorTablero/comprar/calcular). No crea
//  un segundo sistema de costeo.
//
//  Pasos (por pieza): identidad -> dimensiones/funcion -> calibre/material
//  (propuesto si no esta especificado) -> DESARROLLO PLANO cuando la geometria
//  alcanza -> area neta/consumo -> lamina comercial del catalogo -> aprovechamiento
//  /merma (motor) -> costo de MP con evidencia. Operaciones de corte/doblez van
//  al routing (NO se duplican en el precio de la hoja: la hoja cruda no trae corte).
//
//  REGLA DURA: si la geometria NO alcanza (caja 3D sin desarrollo de CAD), el
//  desarrollo queda PENDIENTE. No se inventan dimensiones. El calibre, cuando no
//  esta en el plano, es PROPUESTA sujeta a validacion de Ingenieria.
// ============================================================================
import { INSUMOS_SEMILLA } from './insumos.js';
import { piezasPorTablero, precioDeInsumo, PARAMETROS_DEFAULT } from '../motor/calculo.js';

// Lamina comercial del catalogo (metal, formato hoja, fraccion). Indice por calibre y formato.
const LAMINAS = INSUMOS_SEMILLA.filter((i) => i.seccion === 'metal' && i.formato && i.formato.tipo === 'lamina' && i.fraccion);
const calibreDeId = (id) => { const m = String(id).match(/(\d{2})(?!.*\d)/); return m ? +m[1] : null; };

/** Calibre explicito en el texto del plano ("... CALIBRE 24 ..."), o null. */
export function calibreDesdeTexto(desc) {
  const m = String(desc || '').toUpperCase().match(/CALIBRE\s*(\d{2})|\bCAL\.?\s*(\d{2})\b/);
  return m ? +(m[1] || m[2]) : null;
}

/**
 * Desarrollo plano a partir del bounding box. Fail-closed:
 *   - 2 cotas (o 3a <= 5mm = espesor): PANEL PLANO, desarrollo = L x W.
 *   - 3a cota 5..UMBRAL mm: PANEL CON PESTANAS, desarrollo = (L+2d) x (W+2d) (PROPUESTA).
 *   - 3a cota > UMBRAL: CAJA 3D -> desarrollo PENDIENTE (requiere CAD). No inventa.
 * @returns {{tipo, largoMM?, anchoMM?, area_m2?, nota?, pendiente?, motivo?}}
 */
export function desarrolloPlano(dims_mm = [], { umbralPestanaMM = 30 } = {}) {
  const d = (Array.isArray(dims_mm) ? dims_mm : []).map(Number).filter((x) => x > 0).sort((a, b) => b - a);
  if (d.length < 2) return { tipo: 'INSUFICIENTE', pendiente: true, motivo: 'dimensiones insuficientes (se necesitan al menos 2 cotas)' };
  const [L, W, D] = [d[0], d[1], d[2] || 0];
  if (D <= 5) {
    return { tipo: 'PANEL_PLANO', largoMM: L, anchoMM: W, area_m2: +((L * W) / 1e6).toFixed(4), nota: 'panel plano (3a cota es espesor o inexistente)' };
  }
  if (D <= umbralPestanaMM) {
    const lg = L + 2 * D, an = W + 2 * D;
    return { tipo: 'PANEL_PESTANAS', largoMM: lg, anchoMM: an, area_m2: +((lg * an) / 1e6).toFixed(4),
      nota: `panel con pestanas de ${D} mm: desarrollo = (L+2d)x(W+2d) (PROPUESTA; asume pestanas simples, sin troqueles/recortes)` };
  }
  return { tipo: 'CAJA_3D', pendiente: true,
    motivo: `caja 3D de ${L}x${W}x${D} mm: el desarrollo plano requiere el despliegue de CAD/Ingenieria (no se infiere del bounding box)` };
}

/** Elige la lamina comercial: por calibre (exacto o el inmediato mas grueso) y formato
 *  (3x10 si la pieza no cabe a lo largo de 2440 mm; si no, 4x8). Devuelve el insumo o null. */
export function elegirLamina(calibre, { largoMM = 0 } = {}) {
  if (!calibre) return null;
  const quiere3x10 = largoMM > 2440;            // no cabe en 4x8 (2440) -> formato 3x10 (3048)
  const candidatos = LAMINAS.filter((i) => {
    const es3x10 = i.formato.largoMM === 3048 || /3x10/.test(i.formato.corto || '');
    return quiere3x10 ? es3x10 : !es3x10;
  });
  const pool = candidatos.length ? candidatos : LAMINAS;
  // calibre exacto; si no, el de numero de calibre MAS CERCANO (|dif| minima). Nota:
  // numero de calibre mayor = lamina mas delgada; cal24 (no existe) -> cal22, no cal10.
  const exact = pool.find((i) => calibreDeId(i.id) === calibre);
  if (exact) return exact;
  const conCal = pool.filter((i) => calibreDeId(i.id) != null);
  if (!conCal.length) return null;
  return conCal.sort((a, b) => Math.abs(calibreDeId(a.id) - calibre) - Math.abs(calibreDeId(b.id) - calibre))[0];
}

/**
 * Cuesta la MATERIA PRIMA de una pieza fabricada reusando el nesteo del motor
 * (piezasPorTablero). Devuelve el componente para `calcular` y la evidencia fisica.
 * @param {{clave, nombre, dims_mm, piezas, calibrePropuesto?, desc?}} pieza
 * @returns {{estado, componente?, evidencia?, pregunta?}}
 */
export function costearMateriaPrima(pieza, { calibreDefault = 22, par = PARAMETROS_DEFAULT } = {}) {
  const dev = desarrolloPlano(pieza.dims_mm);
  if (dev.pendiente) {
    return { estado: 'DESARROLLO_PENDIENTE', motivo: dev.motivo,
      pregunta: `Desarrollo plano / calibre de pieza fabricada "${pieza.clave}" (${dev.motivo}).` };
  }
  const calTexto = calibreDesdeTexto(pieza.desc || pieza.nombre);
  const calibre = pieza.calibrePropuesto || calTexto || calibreDefault;
  const calibreFuente = pieza.calibrePropuesto ? 'propuesto' : calTexto ? 'del plano' : 'default propuesto';
  const lamina = elegirLamina(calibre, { largoMM: dev.largoMM });
  if (!lamina) return { estado: 'SIN_LAMINA', motivo: `no hay lamina comercial para calibre ${calibre}`,
    pregunta: `Lamina comercial para calibre ${calibre} (pieza ${pieza.clave}).` };

  const qty = Number(pieza.piezas) || 1;
  const fmtL = lamina.formato.largoMM || par.tableroLargoMM;   // 4x8 no trae largoMM -> default 2440
  const fmtA = lamina.formato.anchoMM || par.tableroAnchoMM;   // -> default 1220
  const ppt = piezasPorTablero(dev.largoMM, dev.anchoMM, { ...par, tableroLargoMM: fmtL, tableroAnchoMM: fmtA });
  const precioHoja = precioDeInsumo(lamina, par);
  const cabe = ppt > 0;
  const hojasPorPieza = cabe ? 1 / ppt : 1;            // si no cabe, 1 hoja por pieza (y se avisa)
  const hojasTotal = +(hojasPorPieza * qty).toFixed(4);
  const costoMP = +(hojasTotal * precioHoja).toFixed(2);
  const areaNeta = +(dev.area_m2 * qty).toFixed(4);
  const areaHoja = +((fmtL * fmtA) / 1e6).toFixed(4);
  const aprovechamiento = cabe ? +((areaNeta / (hojasTotal * areaHoja)) * 100).toFixed(1) : null;

  return {
    estado: cabe ? 'COSTEADA' : 'NO_CABE',
    // componente listo para `calcular` (reusa el motor; MO/GIF por POLITICA_VH):
    componente: { nombre: pieza.nombre || pieza.clave, insumoId: lamina.id, largoMM: dev.largoMM, anchoMM: dev.anchoMM, piezas: qty, seccion: 'metal' },
    evidencia: {
      desarrollo: dev,
      calibre, calibre_fuente: calibreFuente,
      lamina: { id: lamina.id, nombre: lamina.nombre, precio_hoja: precioHoja, fuente: lamina.fuente || null, formato: `${fmtL}x${fmtA} mm`, area_hoja_m2: areaHoja, merma_corte_pct: lamina.mermaCorte },
      area_neta_m2: areaNeta, piezas_por_hoja: cabe ? +ppt.toFixed(2) : 0, hojas: hojasTotal, aprovechamiento_pct: aprovechamiento,
      costo_mp_mxn: costoMP,
      corte_incluido_en_precio: false,   // hoja cruda: el CORTE es operacion aparte (routing). No doble-conteo.
      nota_doble_conteo: 'Precio de HOJA CRUDA: el corte/doblez NO estan incluidos -> son operaciones del routing. No se suma un corte ya cobrado.',
    },
    pregunta: calibreFuente !== 'del plano'
      ? `Confirmar calibre y material de "${pieza.clave}" (se uso ${calibre} ${calibreFuente}).`
      : null,
  };
}
