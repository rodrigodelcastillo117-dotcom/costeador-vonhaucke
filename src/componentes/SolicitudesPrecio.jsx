import { useEffect, useState, useCallback } from 'react';
import { solicitudesPrecioAbiertas, resolverSolicitudPrecio } from '../nube.js';

// LEVER B · Cola de "Precios por pedir a Compras". El costeo encola aquí los materiales con precio viejo o
// sin precio (botón "Pedir precio a Compras"). Dirección/Compras ven la cola, consiguen el precio real, lo
// cargan por el flujo normal de precios, y marcan la solicitud como resuelta. Esta pantalla NO cambia precios:
// sólo lleva la cola. Sólo la ve Dirección (App.jsx la monta tras esDireccion). RLS respalda el rol.
const MOTIVO = { precio_viejo: 'precio por actualizar', pendiente: 'falta precio' };

export default function SolicitudesPrecio() {
  const [filas, setFilas] = useState(null);     // null = cargando
  const [error, setError] = useState('');
  const [enCurso, setEnCurso] = useState(new Set());
  const [cerradas, setCerradas] = useState(0);

  const cargar = useCallback(async () => {
    setError(''); setFilas(null);
    const r = await solicitudesPrecioAbiertas();
    if (!r.ok) { setError(r.error); setFilas([]); return; }
    setFilas(r.filas);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (id, estado) => {
    setEnCurso((s) => new Set(s).add(id)); setError('');
    const r = await resolverSolicitudPrecio(id, estado);
    setEnCurso((s) => { const n = new Set(s); n.delete(id); return n; });
    if (!r.ok) { setError(`No se pudo ${estado === 'resuelta' ? 'resolver' : 'descartar'} #${id}: ${r.error}`); return; }
    setFilas((fs) => (fs || []).filter((f) => f.id !== id));
    setCerradas((n) => n + 1);
  };

  if (filas === null) return <div className="contenido"><p>Cargando solicitudes…</p></div>;

  return (
    <div className="contenido">
      <h2>Precios por pedir a Compras</h2>
      <p style={{ color: '#555', maxWidth: 700 }}>
        Materiales que el costeo marcó con <b>precio viejo</b> o <b>sin precio</b> y que alguien pidió a Compras.
        Cuando Compras dé el precio real, cárgalo por el flujo normal de precios y aquí marca la solicitud como
        <b> resuelta</b>. Esta pantalla sólo lleva la cola de pendientes; <b>no cambia ningún precio</b>.
      </p>
      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
      <p><b>{filas.length}</b> pedido(s) abierto(s){cerradas > 0 ? ` · ${cerradas} cerrado(s) en esta sesión` : ''}.</p>
      {filas.length === 0
        ? <p>No hay pedidos de precio pendientes. ✅</p>
        : (
          <table className="tabla" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th>Material</th><th>Insumo</th><th>Mueble</th><th>Motivo</th><th>Pidió</th><th></th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid #eee' }}>
                  <td>{f.material_texto || '—'}</td>
                  <td>{f.insumo_id || '—'}</td>
                  <td>{f.mueble || '—'}</td>
                  <td>{MOTIVO[f.motivo] || f.motivo || '—'}</td>
                  <td title={f.solicitado_en || ''}>{f.solicitado_por || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => resolver(f.id, 'resuelta')} disabled={enCurso.has(f.id)}>
                      {enCurso.has(f.id) ? '…' : 'Resuelta'}
                    </button>{' '}
                    <button onClick={() => resolver(f.id, 'descartada')} disabled={enCurso.has(f.id)}>Descartar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
