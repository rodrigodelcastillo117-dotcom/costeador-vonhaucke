// ============================================================================
//  APROBACIONES PENDIENTES · cola de Dirección (VH-057)
//  El Deal Desk vive dentro de un PROYECTO comercial, así que una cotización sin
//  proyecto (la mayoría: nacen en el Costeador) pedía aprobación a un buzón que
//  Dirección nunca abría. Esta tarjeta lista TODAS las pendientes (RLS: Dirección
//  las ve todas) y resuelve por la RPC del servidor (sólo Dirección, sólo PENDIENTE).
// ============================================================================
import { useEffect, useState } from 'react';
import { listarAprobacionesPendientes, resolverAprobacion } from '../datos/crm.js';

export default function AprobacionesPendientes({ visible = false, onResuelta = null }) {
  const [lista, setLista] = useState(null);   // null = cargando
  const [err, setErr] = useState('');
  const [ocupada, setOcupada] = useState(null);
  async function cargar() {
    setErr('');
    const { data, error } = await listarAprobacionesPendientes();
    if (error) { setErr(error.message || 'No se pudieron leer las aprobaciones.'); setLista([]); return; }
    setLista(Array.isArray(data) ? data : []);
  }
  useEffect(() => { if (visible) cargar(); /* eslint-disable-next-line */ }, [visible]);
  if (!visible) return null;
  async function resolver(a, estado) {
    setOcupada(a.id); setErr('');
    const { error } = (await resolverAprobacion(a.id, estado)) || {};
    setOcupada(null);
    if (error) { setErr(`No se pudo ${estado === 'APROBADA' ? 'aprobar' : 'rechazar'}: ${error.message || 'error del servidor'}.`); return; }
    onResuelta?.(a, estado);
    cargar();
  }
  return (
    <div className="tarjeta" data-testid="aprobaciones-pendientes">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong>Aprobaciones pendientes{lista ? ` (${lista.length})` : ''}</strong>
        <button className="boton fantasma" style={{ minHeight: 44, fontSize: 13 }} onClick={cargar}>Actualizar</button>
      </div>
      <p className="ayuda" style={{ marginTop: 4 }}>Lo que un vendedor pidió aprobar desde su cotización. Aprobar firma ESA versión exacta: si la cambia, tendrá que pedirla de nuevo.</p>
      {err && <div className="alerta roja" role="alert"><span className="texto">{err}</span></div>}
      {lista === null && <span className="ayuda">Cargando…</span>}
      {lista && lista.length === 0 && <span className="ayuda">Nada pendiente.</span>}
      {lista && lista.map((a) => (
        <div key={a.id} data-testid="aprobacion-fila" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--linea)' }}>
          <div style={{ minWidth: 0 }}>
            <div><b>Cotización {a.cotizacion_id}</b> · solicitó {a.solicitado_por || '—'} · {a.creado ? new Date(a.creado).toLocaleDateString('es-MX') : ''}</div>
            <div className="ayuda" style={{ fontSize: 12 }}>
              {a.descuento_solicitado != null && Number(a.descuento_solicitado) > 0 ? `Descuento ${a.descuento_solicitado} % · ` : ''}
              {a.motivo ? `Motivo: ${a.motivo}` : 'Sin motivo escrito'}{a.revision_hash ? ` · versión ${String(a.revision_hash).slice(0, 8)}` : ''}
            </div>
          </div>
          <div className="fila-botones" style={{ gap: 6 }}>
            <button className="boton" style={{ minHeight: 34 }} disabled={ocupada === a.id} onClick={() => resolver(a, 'APROBADA')}>Aprobar</button>
            <button className="boton fantasma" style={{ minHeight: 34 }} disabled={ocupada === a.id} onClick={() => resolver(a, 'RECHAZADA')}>Rechazar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
