import { pesos2 } from '../util.js';

// ============================================================================
//  LEVER A · "Realidad del material". Parte el costo de MATERIAL del mueble en lo que tiene precio REAL
//  (certificado y vigente, con material confirmado) vs lo SUPUESTO (material por confirmar / precio por
//  actualizar) y dice QUÉ piezas lo arrastran. Así una pieza vieja deja de "pintar" todo el mueble de irreal:
//  se ve que el 95% es real y sólo 1-2 piezas lo bajan. NO cambia ningún costo — lo revela.
//  Se alimenta de desgloseRealidad (puro, probado). Presentacional, compartido por Costeador y Asistente.
// ============================================================================
const ETIQUETA = { por_confirmar: 'material por confirmar', precio_viejo: 'precio por actualizar', pendiente: 'falta material' };

const claveItem = (it) => String(it.insumoId || it.materialTexto || it.nombre || '');

export default function RealidadMaterial({ realidad, onPedirPrecio = null, pedidas = null }) {
  if (!realidad || (realidad.totalConocido <= 0 && !realidad.hayPendiente)) return null;
  const { realMonto, supuestoMonto, pctReal, pendientes, items } = realidad;
  const palabra = pctReal == null ? '' : pctReal >= 80 ? 'sólido' : pctReal >= 50 ? 'parcial' : 'flojo';
  const color = pctReal == null ? '#555' : pctReal >= 80 ? '#1a7f37' : pctReal >= 50 ? '#8a6d00' : '#b42318';
  return (
    <div className="tarjeta">
      <h2>Realidad del material</h2>
      {pctReal != null && (
        <div className="ayuda">
          <strong style={{ color }}>{pctReal}%</strong> del material tiene <strong>precio real certificado y vigente</strong> — respaldo <strong>{palabra}</strong>.
        </div>
      )}
      <div className="ayuda" style={{ marginTop: 4 }}>
        ✓ Real: <strong>{pesos2(realMonto)}</strong>
        {supuestoMonto > 0 && <> · <span style={{ color: '#8a6d00' }}>⚠ Por confirmar/actualizar: <strong>{pesos2(supuestoMonto)}</strong></span></>}
        {pendientes > 0 && <> · <strong style={{ color: '#b42318' }}>{pendientes}</strong> pieza(s) sin material</>}
      </div>
      {items.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary className="ayuda" style={{ cursor: 'pointer' }}>
            Ver {items.length === 1 ? 'la pieza que baja' : `las ${items.length} piezas que bajan`} la realidad del costo
          </summary>
          <ul className="ayuda" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {items.map((it, i) => {
              const pedida = pedidas && pedidas.has(claveItem(it));
              return (
                <li key={i}>
                  <strong>{it.nombre}</strong> — {ETIQUETA[it.clase] || it.clase}
                  {it.monto > 0 ? ` (${pesos2(it.monto)})` : ''}
                  {it.motivo ? <span style={{ opacity: 0.8 }}> · {it.motivo}</span> : null}
                  {onPedirPrecio && it.solicitable && (
                    pedida
                      ? <span style={{ marginLeft: 6, color: '#1a7f37' }}>· pedido a Compras ✓</span>
                      : <>{' '}<button type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => onPedirPrecio(it)}>Pedir precio a Compras</button></>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <div className="ayuda" style={{ marginTop: 6, opacity: 0.75, fontSize: '0.85em' }}>
        No cambia ningún costo: revela qué parte del material es precio real y qué parte es supuesto. La mano de obra se calcula aparte.
      </div>
    </div>
  );
}
