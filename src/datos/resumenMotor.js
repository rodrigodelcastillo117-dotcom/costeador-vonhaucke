// ============================================================================
//  RESUMEN DEL MOTOR para la auditoría de Costear: los NÚMEROS válidos de consumo (m², hojas,
//  metros, kg, método) salen de `calcular()` (detalleInsumos), no del texto narrativo de la IA.
//  Puro: recibe el resultado del motor y devuelve renglones listos para pintar.
// ============================================================================

const METODO_TXT = {
  FRACCION_DIRECTA_RAFA: 'fracción de hoja declarada (sin re-nestear)',
  RENDIMIENTO_GEOMETRICO: 'rejilla de corte + regla A14 (½ / 1 hoja en piezas grandes)',
  APROVECHAMIENTO_GENERICO: 'aprovechamiento genérico del formato',
  INVENTARIO_CONTINUO: 'inventario continuo (metros / kg con merma del insumo)',
  FORMATO_COMPLETO: 'formatos completos',
  CONSUMO_DIRECTO: 'consumo directo (piezas)',
};
const r2 = (x) => Math.round(Number(x) * 100) / 100;

/**
 * @param {object} resultado  salida de calcular()
 * @returns {{renglones:Array, hojasTablero:number, m2Tablero:number, mermaPct:(number|null), pendientes:Array<string>}}
 */
export function resumenMotor(resultado) {
  const det = Array.isArray(resultado?.detalleInsumos) ? resultado.detalleInsumos : [];
  const renglones = [];
  let hojasTablero = 0, m2Tablero = 0, compradoTablero = 0;
  for (const d of det) {
    const esTablero = d?.formato?.tipo === 'tablero';
    const unidades = Number(d.unidades) || 0, neto = Number(d.neto) || 0, comprado = Number(d.comprado) || 0;
    if (esTablero) { hojasTablero += unidades; m2Tablero += neto; compradoTablero += comprado; }
    const fmt = d.formato || null;
    const compra = unidades > 0 && fmt && fmt.medida
      ? `${r2(unidades)} ${d.unidad === 'hoja' ? 'hoja(s)' : 'tramo(s)'} × ${fmt.medida} ${d.unidad === 'hoja' ? 'm²' : 'm'}`
      : `${r2(comprado || neto)} ${d.unidad}`;
    renglones.push({
      insumoId: d.insumoId, nombre: d.nombre, seccion: d.seccion, unidad: d.unidad,
      neto: r2(neto), comprado: r2(comprado), unidades: r2(unidades), compra,
      metodo: METODO_TXT[d.metodoConsumo] || d.metodoConsumo || '',
      reglasProduccion: Array.isArray(d.reglasProduccion) ? d.reglasProduccion : [],
      pct: Number.isFinite(Number(d.pct)) ? r2(d.pct) : null,
      piezas: (d.nombresComponentes || []).slice(0, 6),
    });
  }
  const nom = (x) => (typeof x === 'string' ? x : x?.nombre || x?.insumoId || x?.motivo || '');
  const porConfirmar = (resultado?.materialesPorConfirmar || []).map(nom).filter(Boolean);   // costean provisional; bloquean emisión
  const sinCosto = (resultado?.componentesIgnorados || []).map(nom).filter(Boolean);        // no entran al costo
  const pendientes = [...porConfirmar, ...sinCosto];
  const mermaPct = compradoTablero > 0 ? r2(((compradoTablero - m2Tablero) / compradoTablero) * 100) : null;
  return { renglones, hojasTablero: r2(hojasTablero), m2Tablero: r2(m2Tablero), mermaPct, pendientes, porConfirmar, sinCosto };
}
