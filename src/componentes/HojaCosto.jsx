// Hoja de costo (master 7.2, columna derecha). El resultado siempre visible.
import { pesos2, pct1 } from '../util.js';
import { SECCIONES } from '../datos/insumos.js';
import { horasTotales } from '../datos/ue.js';
import { precioDe, precioVenta, costeoEmitible, PARAMETROS_DEFAULT, formulaDePieza, FORMULA_ALBA_V1, MOTOR_VERSION } from '../motor/calculo.js';
import { precioDeLista } from '../datos/preciosVenta.js';
import { preciosVH } from '../datos/politicaVH.js';

export default function HojaCosto({ resultado, insumos, pieza, parametros = PARAMETROS_DEFAULT, tipo = 'mueble_fabricado', mostrarVolumen = false, mostrarComercial = true }) {
  if (!resultado) return null;

  const intelisis = resultado.modeloCosteo === 'intelisis';
  // FAIL-CLOSED (audit 2026-10-01): si hay partidas SIN costear, el "costo" de aquí
  // es apenas un SUBTOTAL CONOCIDO. No se calcula ni se imprime precio de lista,
  // mínimo, utilidad ni precios por volumen: eso sería vender sobre un hueco.
  const emision = costeoEmitible(resultado);
  const pendientes = emision.pendientes || [];
  const incompleto = !emision.emitible;
  // Los 4 rubros que pidio Ventas para imprimir (levantamiento Rafa 14.6)
  const margenObjetivo = parametros.margenObjetivo ?? 50;
  const minMarkup = parametros.minMarkupLinea ?? 45;
  const materiaPrima = resultado.materialTotal;
  const costoFabricacion = resultado.costoUnitario;
  const precioMinimo = costoFabricacion * (1 + minMarkup / 100); // piso de linea (utilidad sobre costo)
  // El modelo Intelisis escupe el "precio 2", que Von Haucke nunca cotiza:
  // siempre se le quita el 40% para llegar al precio de lista.
  const precioLista = intelisis ? precioDeLista(precioVenta(costoFabricacion, parametros).lista) : precioDe(costoFabricacion, margenObjetivo);

  // Agrupar el material por seccion del insumo, para el desglose de arriba
  const porSeccion = {};
  for (const c of resultado.detalleInsumos) {
    const sec = c.seccion || 'otros';
    porSeccion[sec] = (porSeccion[sec] || 0) + c.costo;
  }

  const horas = horasTotales(pieza?.horas);
  // Método de costeo (discreto): Alba V1 para producto nuevo; si la pieza trae factores
  // a mano es un costo heredado. No cambia ningún número, solo lo nombra.
  const formula = formulaDePieza(pieza || {});
  const metodoEtq = formula === FORMULA_ALBA_V1 ? 'Alba V1' : formula === 'LEGACY_55' ? 'Legacy 55 (histórico)' : formula;

  // --- Desglose VISUAL: de qué se compone el precio (vivo) ---
  // Sin costo completo no hay utilidad real: el precio es "Pendiente", no un número.
  const utilidad = (!mostrarComercial || incompleto) ? 0 : Math.max(0, precioLista - costoFabricacion);
  const segs = [
    { k: 'Material', v: resultado.materialTotal, c: '#C6A971' },
    { k: 'Mano de obra', v: (resultado.manoObra || 0) + (resultado.preparacion || 0) + (resultado.empaque || 0), c: '#3B6FB0' },
    { k: 'Indirectos', v: (resultado.indirectosFabrica || 0) + (resultado.gastosOperacion || 0), c: '#8A8178' },
    { k: 'Utilidad', v: utilidad, c: '#0F766E' },
  ].filter((s) => s.v > 0);
  const totSeg = segs.reduce((a, s) => a + s.v, 0) || 1;
  const margenReal = precioLista > 0 ? (utilidad / precioLista) * 100 : 0;

  // Escalón de precios por volumen (T.D.C. de Alba), sobre el costo de fabricación.
  const nivelesVolumen = [
    { volumen: 'alto', etq: 'Alto (mucho vol.)' },
    { volumen: 'intermedio', etq: 'Intermedio' },
    { volumen: 'bajo', etq: 'Bajo (pocas pzas)' },
  ].map((t) => ({ ...t, ...preciosVH(costoFabricacion, { tipo, volumen: t.volumen }) }));

  return (
    <div className="hoja">
      <h3>HOJA DE COSTO</h3>
      <div className="ayuda" style={{ marginTop: -4, marginBottom: 8, opacity: 0.75 }} title={`Motor ${MOTOR_VERSION}`}>Método de costeo: <strong>{metodoEtq}</strong> <span className="gris">· motor {MOTOR_VERSION}</span></div>

      {/* Desglose visual (vivo): así se compone el precio */}
      <div className="dvis">
        <div className="dvis-top">
          <div>
            <div className="dvis-lbl">{incompleto ? 'Subtotal conocido' : 'Cuesta hacer 1'}</div>
            <div className="dvis-costo">{pesos2(costoFabricacion)}</div>
          </div>
          {mostrarComercial && <>
            <div className="dvis-arrow">→</div>
            <div style={{ textAlign: 'right' }}>
              <div className="dvis-lbl">Precio de lista</div>
              <div className="dvis-precio" style={incompleto ? { color: '#b22a22', fontSize: '0.8em' } : undefined}>{incompleto ? 'Pendiente' : pesos2(precioLista)}</div>
            </div>
          </>}
        </div>
        {incompleto && (
          <div className="alerta roja" style={{ marginTop: 8 }}>
            <span className="texto">⚠ <strong>Costo NO EMITIBLE</strong> — {pendientes.length} bloqueo(s): {pendientes.slice(0, 6).join(' · ')}{pendientes.length > 6 ? '…' : ''}. No hay precio oficial hasta resolverlos.</span>
          </div>
        )}
        <div className="dvis-bar" role="img" aria-label="Composición del precio">
          {segs.map((s) => <span key={s.k} className="dvis-seg" style={{ width: `${(s.v / totSeg) * 100}%`, background: s.c }} title={`${s.k}: ${pesos2(s.v)}`} />)}
        </div>
        <div className="dvis-leg">
          {segs.map((s) => (
            <span className="dvis-leg-i" key={s.k}>
              <span className="dvis-dot" style={{ background: s.c }} />
              {s.k} <b>{pesos2(s.v)}</b> <span className="gris">{Math.round((s.v / totSeg) * 100)}%</span>
            </span>
          ))}
        </div>
        {mostrarComercial && utilidad > 0 && <div className="dvis-gana">De cada venta, ganas <b>{pesos2(utilidad)}</b> <span className="gris">({Math.round(margenReal)}% del precio)</span></div>}
      </div>


      {SECCIONES.filter((s) => porSeccion[s.id] > 0).map((s) => (
        <div className="fila" key={s.id}>
          <span>{s.nombre}</span>
          <span className="val">{pesos2(porSeccion[s.id])}</span>
        </div>
      ))}

      <hr />
      <div className="fila"><strong>Material</strong><span className="val"><strong>{pesos2(resultado.materialTotal)}</strong></span></div>
      <div className="fila sub"><span>· directo</span><span className="val">{pesos2(resultado.materialDirecto)}</span></div>
      <div className="fila sub"><span>· indirecto</span><span className="val">{pesos2(resultado.materialIndirecto)}</span></div>
      <div className="fila sub">
        <span>· de eso, desperdicio</span>
        <span className="val">
          {pesos2(resultado.desperdicio)}
          {resultado.materialTotal > 0 && (
            <span className="gris"> · {pct1((resultado.desperdicio / resultado.materialTotal) * 100)}</span>
          )}
        </span>
      </div>

      <div className="fila">
        <span>Mano de obra{resultado.modoManoObra === 'horas' && horas > 0 ? ` (${horas.toFixed(2)} h)` : ''}</span>
        <span className="val">{pesos2(resultado.manoObra)}</span>
      </div>
      {resultado.preparacion > 0 && (
        <div className="fila"><span>Preparacion</span><span className="val">{pesos2(resultado.preparacion)}</span></div>
      )}
      {resultado.empaque > 0 && (
        <div className="fila"><span>Empaque</span><span className="val">{pesos2(resultado.empaque)}</span></div>
      )}

      <hr />
      <div className="fila"><strong>Costo directo</strong><span className="val"><strong>{pesos2(resultado.costoDirecto)}</strong></span></div>
      <div className="fila"><span>{intelisis ? 'Gastos indirectos (horas × $/h)' : 'Indirectos de fabrica (34%)'}</span><span className="val">{pesos2(resultado.indirectosFabrica)}</span></div>
      {intelisis && resultado.gastosOperacion > 0 && (
        <div className="fila"><span>Gastos de operación (30%)</span><span className="val">{pesos2(resultado.gastosOperacion)}</span></div>
      )}

      <hr className="doble" />
      <div className="fila total">
        <span>{incompleto ? 'SUBTOTAL CONOCIDO (incompleto)' : 'NOS CUESTA FABRICARLO'}</span>
        <span className="val">{pesos2(resultado.costoUnitario)}</span>
      </div>
      {resultado.piezas > 1 && (
        <div className="fila sub"><span>lote de {resultado.piezas} · costo del lote</span><span className="val">{pesos2(resultado.costoLoteConMerma)}</span></div>
      )}

      {/* Rubros para imprimir — pedidos por Ventas (levantamiento Rafa 14.6).
          FAIL-CLOSED: no se imprimen precios sobre un costo incompleto. */}
      <hr className="doble" />
      <div className="fila"><span>Costo de materia prima</span><span className="val">{pesos2(materiaPrima)}</span></div>
      <div className="fila"><span>{incompleto ? 'Subtotal de fabricación (parcial)' : 'Costo de fabricacion'}</span><span className="val">{pesos2(costoFabricacion)}</span></div>
      {mostrarComercial && (incompleto ? (
        <div className="ayuda" style={{ marginTop: 4, color: '#b22a22' }}>Precio mínimo, de lista y por volumen quedan pendientes hasta costear todas las partidas.</div>
      ) : (
        <>
          <div className="fila"><span>Precio mínimo <span className="gris">(línea, {minMarkup}% s/costo)</span></span><span className="val">{pesos2(precioMinimo)}</span></div>
          <div className="fila total"><span>Precio de lista <span className="gris">{intelisis ? '(×3)' : `(${margenObjetivo}%)`}</span></span><span className="val">{pesos2(precioLista)}</span></div>
          <div className="ayuda" style={{ marginTop: 4 }}>Se cotiza de la lista hacia abajo con descuento; el mínimo es el piso.</div>
        </>
      ))}

      {/* Precios por volumen — método T.D.C. de Alba (REG-DCC-IDP-031), verificado
          al centavo contra el copete C-CO-516R. precio_mínimo = costo × factor de
          volumen; lista = mín/0.7; precio_2 = mín/0.42. A mayor volumen, menor
          factor → menor precio. SOLO en el Costeador de producto nuevo: en las
          líneas de catálogo el precio ya está calibrado y este escalón confundiría. */}
      {mostrarComercial && mostrarVolumen && !incompleto && (
        <>
          <hr className="doble" />
          <div className="fila"><strong>Precios por volumen</strong><span className="gris">método Vonhaucke</span></div>
          <table className="hoja-vol" style={{ width: '100%', fontSize: '0.85em', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
              <tr style={{ textAlign: 'right', color: '#8A8178' }}>
                <th style={{ textAlign: 'left' }}>Volumen</th><th>Mínimo</th><th>Lista</th><th>Precio 2</th>
              </tr>
            </thead>
            <tbody>
              {nivelesVolumen.map((r) => (
                <tr key={r.volumen} style={{ textAlign: 'right' }}>
                  <td style={{ textAlign: 'left' }}>{r.etq}</td>
                  <td>{pesos2(r.precioMin)}</td>
                  <td>{pesos2(r.precioLista)}</td>
                  <td>{pesos2(r.precio2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ayuda" style={{ marginTop: 4 }}>Sobre el costo de fabricación de arriba. A más volumen, más barato.</div>
        </>
      )}
    </div>
  );
}
