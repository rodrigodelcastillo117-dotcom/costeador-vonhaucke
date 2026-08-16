// Hoja de costo (master 7.2, columna derecha). El resultado siempre visible.
import { pesos, pct1 } from '../util.js';
import { SECCIONES } from '../datos/insumos.js';
import { horasTotales } from '../datos/ue.js';
import { precioDe, precioVenta, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { precioDeLista } from '../datos/preciosVenta.js';

export default function HojaCosto({ resultado, insumos, pieza, parametros = PARAMETROS_DEFAULT }) {
  if (!resultado) return null;

  const intelisis = resultado.modeloCosteo === 'intelisis';
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

  // --- Desglose VISUAL: de qué se compone el precio (vivo) ---
  const utilidad = Math.max(0, precioLista - costoFabricacion);
  const segs = [
    { k: 'Material', v: resultado.materialTotal, c: '#C6A971' },
    { k: 'Mano de obra', v: (resultado.manoObra || 0) + (resultado.preparacion || 0) + (resultado.empaque || 0), c: '#3B6FB0' },
    { k: 'Indirectos', v: (resultado.indirectosFabrica || 0) + (resultado.gastosOperacion || 0), c: '#8A8178' },
    { k: 'Utilidad', v: utilidad, c: '#0F766E' },
  ].filter((s) => s.v > 0);
  const totSeg = segs.reduce((a, s) => a + s.v, 0) || 1;
  const margenReal = precioLista > 0 ? (utilidad / precioLista) * 100 : 0;

  return (
    <div className="hoja">
      <h3>HOJA DE COSTO</h3>

      {/* Desglose visual (vivo): así se compone el precio */}
      <div className="dvis">
        <div className="dvis-top">
          <div>
            <div className="dvis-lbl">Cuesta hacer 1</div>
            <div className="dvis-costo">{pesos(costoFabricacion)}</div>
          </div>
          <div className="dvis-arrow">→</div>
          <div style={{ textAlign: 'right' }}>
            <div className="dvis-lbl">Precio de lista</div>
            <div className="dvis-precio">{pesos(precioLista)}</div>
          </div>
        </div>
        <div className="dvis-bar" role="img" aria-label="Composición del precio">
          {segs.map((s) => <span key={s.k} className="dvis-seg" style={{ width: `${(s.v / totSeg) * 100}%`, background: s.c }} title={`${s.k}: ${pesos(s.v)}`} />)}
        </div>
        <div className="dvis-leg">
          {segs.map((s) => (
            <span className="dvis-leg-i" key={s.k}>
              <span className="dvis-dot" style={{ background: s.c }} />
              {s.k} <b>{pesos(s.v)}</b> <span className="gris">{Math.round((s.v / totSeg) * 100)}%</span>
            </span>
          ))}
        </div>
        {utilidad > 0 && <div className="dvis-gana">De cada venta, ganas <b>{pesos(utilidad)}</b> <span className="gris">({Math.round(margenReal)}% del precio)</span></div>}
      </div>


      {SECCIONES.filter((s) => porSeccion[s.id] > 0).map((s) => (
        <div className="fila" key={s.id}>
          <span>{s.nombre}</span>
          <span className="val">{pesos(porSeccion[s.id])}</span>
        </div>
      ))}

      <hr />
      <div className="fila"><strong>Material</strong><span className="val"><strong>{pesos(resultado.materialTotal)}</strong></span></div>
      <div className="fila sub"><span>· directo</span><span className="val">{pesos(resultado.materialDirecto)}</span></div>
      <div className="fila sub"><span>· indirecto</span><span className="val">{pesos(resultado.materialIndirecto)}</span></div>
      <div className="fila sub">
        <span>· de eso, desperdicio</span>
        <span className="val">
          {pesos(resultado.desperdicio)}
          {resultado.materialTotal > 0 && (
            <span className="gris"> · {pct1((resultado.desperdicio / resultado.materialTotal) * 100)}</span>
          )}
        </span>
      </div>

      <div className="fila">
        <span>Mano de obra{resultado.modoManoObra === 'horas' && horas > 0 ? ` (${horas.toFixed(2)} h)` : ''}</span>
        <span className="val">{pesos(resultado.manoObra)}</span>
      </div>
      {resultado.preparacion > 0 && (
        <div className="fila"><span>Preparacion</span><span className="val">{pesos(resultado.preparacion)}</span></div>
      )}
      {resultado.empaque > 0 && (
        <div className="fila"><span>Empaque</span><span className="val">{pesos(resultado.empaque)}</span></div>
      )}

      <hr />
      <div className="fila"><strong>Costo directo</strong><span className="val"><strong>{pesos(resultado.costoDirecto)}</strong></span></div>
      <div className="fila"><span>{intelisis ? 'Gastos indirectos (horas × $/h)' : 'Indirectos de fabrica (34%)'}</span><span className="val">{pesos(resultado.indirectosFabrica)}</span></div>
      {intelisis && resultado.gastosOperacion > 0 && (
        <div className="fila"><span>Gastos de operación (30%)</span><span className="val">{pesos(resultado.gastosOperacion)}</span></div>
      )}

      <hr className="doble" />
      <div className="fila total">
        <span>NOS CUESTA FABRICARLO</span>
        <span className="val">{pesos(resultado.costoUnitario)}</span>
      </div>
      {resultado.piezas > 1 && (
        <div className="fila sub"><span>lote de {resultado.piezas} · costo del lote</span><span className="val">{pesos(resultado.costoLoteConMerma)}</span></div>
      )}

      {/* Rubros para imprimir — pedidos por Ventas (levantamiento Rafa 14.6) */}
      <hr className="doble" />
      <div className="fila"><span>Costo de materia prima</span><span className="val">{pesos(materiaPrima)}</span></div>
      <div className="fila"><span>Costo de fabricacion</span><span className="val">{pesos(costoFabricacion)}</span></div>
      <div className="fila"><span>Precio mínimo <span className="gris">(línea, {minMarkup}% s/costo)</span></span><span className="val">{pesos(precioMinimo)}</span></div>
      <div className="fila total"><span>Precio de lista <span className="gris">{intelisis ? '(×3)' : `(${margenObjetivo}%)`}</span></span><span className="val">{pesos(precioLista)}</span></div>
      <div className="ayuda" style={{ marginTop: 4 }}>Se cotiza de la lista hacia abajo con descuento; el mínimo es el piso.</div>
    </div>
  );
}
