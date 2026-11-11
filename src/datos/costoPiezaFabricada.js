// ============================================================================
//  COSTO DE PIEZA FABRICADA — materia prima autoritativa, FAIL-CLOSED.
//  Auditoria Direccion 2026-11-09 (SHA f8bd9bc): corrige 6 defectos.
//  --------------------------------------------------------------------------
//  Una pieza fabricada se costea desde su MATERIA PRIMA (lamina comercial) +
//  operaciones, NO como SKU. REUSA el nesteo del motor (piezasPorTablero). La
//  fuente economica es el CATALOGO VIGENTE del servidor (precio exacto + version
//  precio_id + unidad + evidencia + certificable), NO el seed.
//
//  Estados (vocabulario del servidor, ver autoridadCosteoServidor.js):
//   · BLOQUEADO   cantidad invalida; o la pieza no cabe en ningun formato disponible.
//   · INCOMPLETO  falta un dato: desarrollo (caja 3D sin CAD) o precio autoritativo.
//   · PRELIMINAR  se costea con supuestos: calibre propuesto (no del plano), desarrollo
//                 inferido (L+2D), lamina sustituida o precio no certificable. Bloquea certificacion.
//   · VERIFICABLE calibre del plano + desarrollo verificado + precio certificable exacto.
//  Nunca convierte un supuesto en material confirmado. Nunca asigna una hoja en silencio.
// ============================================================================
import { piezasPorTablero, PARAMETROS_DEFAULT } from '../motor/calculo.js';

/** Calibre explicito en el texto del plano ("... CALIBRE 24 ..."), o null. */
export function calibreDesdeTexto(desc) {
  const m = String(desc || '').toUpperCase().match(/CALIBRE\s*(\d{2})|\bCAL\.?\s*(\d{2})\b/);
  return m ? +(m[1] || m[2]) : null;
}

/**
 * Desarrollo plano fail-closed, distinguiendo VERIFICADO de INFERIDO.
 *   - 2 cotas, o 3a <= 5mm (espesor): PANEL_PLANO -> metodo VERIFICADO (huella real LxW).
 *   - 3a cota 5..UMBRAL: PANEL_PESTANAS -> metodo INFERIDO_L2D (propuesta (L+2d)x(W+2d)).
 *   - 3a cota > UMBRAL: CAJA_3D -> PENDIENTE (requiere CAD). No inventa.
 */
export function desarrolloPlano(dims_mm = [], { umbralPestanaMM = 30 } = {}) {
  const d = (Array.isArray(dims_mm) ? dims_mm : []).map(Number).filter((x) => x > 0).sort((a, b) => b - a);
  if (d.length < 2) return { tipo: 'INSUFICIENTE', pendiente: true, motivo: 'dimensiones insuficientes (se necesitan al menos 2 cotas)' };
  const [L, W, D] = [d[0], d[1], d[2] || 0];
  if (D <= 5) return { tipo: 'PANEL_PLANO', metodo: 'VERIFICADO', verificado: true, largoMM: L, anchoMM: W, area_m2: +((L * W) / 1e6).toFixed(4), nota: 'panel plano: huella real L x W' };
  if (D <= umbralPestanaMM) {
    const lg = L + 2 * D, an = W + 2 * D;
    return { tipo: 'PANEL_PESTANAS', metodo: 'INFERIDO_L2D', verificado: false, largoMM: lg, anchoMM: an, area_m2: +((lg * an) / 1e6).toFixed(4),
      nota: `desarrollo INFERIDO (L+2d)x(W+2d) con pestanas de ${D} mm; asume pestanas simples sin troqueles. Requiere validacion.` };
  }
  return { tipo: 'CAJA_3D', pendiente: true, motivo: `caja 3D de ${L}x${W}x${D} mm: el desarrollo plano requiere el despliegue de CAD/Ingenieria (no se infiere del bounding box)` };
}

/** Registros autoritativos de lamina para un calibre (y acero): exacto o el mas cercano (sustituido). */
export function laminasParaCalibre(calibre, catalogoLamina = [], acero = null) {
  let cat = Array.isArray(catalogoLamina) ? catalogoLamina.filter((l) => Number(l.precio) > 0 && l.formato) : [];
  // Si se pide un acero, se EXIGE ese acero. Nunca se cae a otras familias en silencio (auditoria p2).
  if (acero) cat = cat.filter((l) => l.acero === acero);
  if (!cat.length || !calibre) return { exacto: false, registros: [] };
  const exactos = cat.filter((l) => Number(l.calibre) === calibre);
  if (exactos.length) return { exacto: true, registros: exactos };
  // mas cercano por |dif| de calibre (numero mayor = mas delgada)
  const min = Math.min(...cat.map((l) => Math.abs(Number(l.calibre) - calibre)));
  return { exacto: false, registros: cat.filter((l) => Math.abs(Number(l.calibre) - calibre) === min) };
}

const bloq = (clave, estado, motivo, extra = {}) => ({ estado, clave, motivo, pregunta: `${motivo} (pieza ${clave}).`, ...extra });

/**
 * Cuesta la materia prima de una pieza fabricada. Fail-closed y autoritativo.
 * @param {{clave,nombre,dims_mm,cantidad,calibrePropuesto?,desc?}} pieza
 * @param {{catalogoLamina:Array, par?}} opts  catalogoLamina = filas autoritativas (catalogo_vigente)
 */
export function costearMateriaPrima(pieza = {}, { catalogoLamina = [], par = PARAMETROS_DEFAULT } = {}) {
  const clave = pieza.clave || 'pieza';

  // P1.5: cantidad invalida/faltante BLOQUEA (no Number(x)||1).
  const q = Number(pieza.cantidad);
  if (!Number.isFinite(q) || q <= 0) return bloq(clave, 'BLOQUEADO', 'cantidad invalida o faltante: no se costea');

  // Desarrollo: CAD confirmado (geometria EXPLICITA y versionada) tiene prioridad y NO se re-infiere
  // del bounding box (punto 2 de la auditoria). Si no, se calcula (P1.3: verificado vs inferido).
  let dev;
  const dc = pieza.desarrolloConfirmado;
  if (dc && Number(dc.largoMM) > 0 && Number(dc.anchoMM) > 0) {
    const area = Number(dc.area_m2) > 0 ? +Number(dc.area_m2).toFixed(4) : +((dc.largoMM * dc.anchoMM) / 1e6).toFixed(4);
    dev = { tipo: 'CAD', metodo: 'CAD_CONFIRMADO', verificado: true, largoMM: Number(dc.largoMM), anchoMM: Number(dc.anchoMM), area_m2: area,
      fuente: dc.fuente || 'CAD', version: dc.version || null, nota: 'desarrollo plano CONFIRMADO por Ingenieria (CAD); geometria explicita versionada' };
  } else {
    dev = desarrolloPlano(pieza.dims_mm);
    if (dev.pendiente) return bloq(clave, 'INCOMPLETO', dev.motivo);
  }

  // Calibre: CONFIRMADO por Ingenieria > del plano > propuesto (P1.2: un propuesto nunca se confirma solo).
  const calTexto = calibreDesdeTexto(pieza.desc || pieza.nombre);
  const calConf = Number(pieza.calibreConfirmado);
  const tieneConf = Number.isFinite(calConf) && calConf > 0;
  const calibre = tieneConf ? calConf : (pieza.calibrePropuesto || calTexto || 22);
  const calibreConfirmado = tieneConf || (!!calTexto && !pieza.calibrePropuesto);
  const calibreFuente = tieneConf ? 'confirmado (Ingenieria)' : pieza.calibrePropuesto ? 'propuesto (override)' : calTexto ? 'del plano' : 'default propuesto';

  // Esta función costea LÁMINA DE ACERO. Si la pieza es claramente de OTRO material (MDF/melamina/
  // madera/acrílico/vidrio) y nadie propuso un acero, NO se defaultea a acero negra en silencio:
  // eso costearía madera a precio de acero (fail-open). Falta el precio/identidad de su material.
  const NO_ACERO = /mdf|melamina|madera|triplay|aglomerado|tablero|acril|policarbon|cristal|vidrio|poliuret|\bfoam\b/i;
  const matTexto = String(pieza.desc || pieza.nombre || '');
  const matNorm = matTexto.normalize('NFD').replace(/[̀-ͯ]/g, '');   // sin acentos: "acrílico" → "acrilico"
  if (!pieza.aceroPropuesto && NO_ACERO.test(matNorm)) {
    return bloq(clave, 'INCOMPLETO', `la pieza no es lámina de acero (parece "${matTexto.slice(0, 48)}"): falta el precio/identidad de su material real — Ingeniería/Compras`, { material_texto: matTexto });
  }
  // Lamina autoritativa (P1.1) del acero correcto (default negra para mueble pintado DE ACERO).
  const acero = pieza.aceroPropuesto || 'negra';
  const { exacto, registros } = laminasParaCalibre(calibre, catalogoLamina, acero);
  if (!registros.length) return bloq(clave, 'INCOMPLETO', `sin precio autoritativo de lamina ${acero} calibre ${calibre} en el catalogo vigente`, { calibre, acero });

  // P1.4: elegir el formato que SI CABE. Nunca asignar una hoja en silencio.
  // Criterio: primero certificable, luego MENOR costo por pieza (precio/ppt).
  let mejor = null;
  for (const lam of registros) {
    const fmtL = Math.max(lam.formato.largoMM, lam.formato.anchoMM);
    const fmtA = Math.min(lam.formato.largoMM, lam.formato.anchoMM);
    const ppt = piezasPorTablero(dev.largoMM, dev.anchoMM, { ...par, tableroLargoMM: fmtL, tableroAnchoMM: fmtA });
    if (ppt > 0) {
      const areaHoja = +((fmtL * fmtA) / 1e6).toFixed(4);
      const costoPorPieza = Number(lam.precio) / ppt;
      const cand = { lam, ppt, fmtL, fmtA, areaHoja, costoPorPieza };
      const mejorCert = !!(mejor && mejor.lam.certificable), estaCert = !!lam.certificable;   // ambos booleanos: evita false===undefined que descartaba la lámina más barata
      if (!mejor || (estaCert && !mejorCert) || (estaCert === mejorCert && costoPorPieza < mejor.costoPorPieza)) mejor = cand;
    }
  }
  if (!mejor) {
    return bloq(clave, 'BLOQUEADO', `la pieza (${dev.largoMM}x${dev.anchoMM} mm) NO cabe en ningun formato de lamina disponible (cal ${calibre}): requiere seccionar o formato especial (decision de Ingenieria)`, { calibre, desarrollo: dev });
  }

  const { lam, ppt, fmtL, fmtA, areaHoja } = mejor;
  const hojasPorPieza = 1 / ppt;
  const hojas = +(hojasPorPieza * q).toFixed(4);
  const costoMP = +(hojas * Number(lam.precio)).toFixed(2);
  const areaNeta = +(dev.area_m2 * q).toFixed(4);
  const aprovechamiento = +((areaNeta / (hojas * areaHoja)) * 100).toFixed(1);

  // Motivos que impiden "VERIFICABLE".
  const motivos = [];
  if (!calibreConfirmado) motivos.push('calibre no confirmado (propuesto)');
  if (!dev.verificado) motivos.push('desarrollo inferido (L+2D), sin CAD');
  if (!exacto) motivos.push(`calibre sustituido a ${lam.calibre} (no habia ${calibre} exacto)`);
  if (!lam.certificable) motivos.push('precio de lamina no certificable');
  const estado = motivos.length ? 'PRELIMINAR' : 'VERIFICABLE';

  return {
    estado, clave,
    componente: { nombre: pieza.nombre || clave, insumoId: lam.insumo_id, largoMM: dev.largoMM, anchoMM: dev.anchoMM, piezas: q, seccion: 'metal',
      insumo: { ...lam, unidad: lam.unidad, formato: { tipo: 'lamina', largoMM: fmtL, anchoMM: fmtA, medida: areaHoja }, fraccion: true, mermaCorte: 0, seccion: 'metal', nombre: lam.insumo_id } },
    evidencia: {
      calibre: { valor: calibre, confirmado: calibreConfirmado, fuente: calibreFuente, lamina_calibre: lam.calibre, exacto },
      desarrollo: { tipo: dev.tipo, metodo: dev.metodo, verificado: dev.verificado, largoMM: dev.largoMM, anchoMM: dev.anchoMM, area_m2: dev.area_m2, fuente: dev.fuente || null, version: dev.version || null },
      lamina: { insumo_id: lam.insumo_id, acero: lam.acero, acabado: lam.acabado, precio: Number(lam.precio), precio_id: lam.precio_id, version: lam.precio_id, unidad: lam.unidad,
        vigente_desde: lam.vigente_desde, certificable: !!lam.certificable, estatus: lam.estatus, fuente: lam.fuente,
        formato: `${fmtL}x${fmtA} mm`, area_hoja_m2: areaHoja },
      area_neta_m2: areaNeta, piezas_por_hoja: +ppt.toFixed(2), hojas, aprovechamiento_pct: aprovechamiento,
      costo_mp_mxn: costoMP,
      corte_incluido_en_precio: false,
      nota_doble_conteo: 'Precio de HOJA cruda: corte/doblez NO incluidos -> operaciones del routing. No sumar un corte ya cobrado.',
      motivos,
    },
    pregunta: motivos.length ? `Confirmar ${motivos.join('; ')} de "${clave}".` : null,
  };
}
