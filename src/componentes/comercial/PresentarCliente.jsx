// ============================================================================
//  WOW — PRESENTAR AL CLIENTE (IMPLEMENTED_PENDING_VISUAL_SMOKE).
//  Modo presentación a pantalla completa, CLIENT-SAFE POR DISEÑO: el payload se
//  construye con `construirPresentacionCliente` (0 claves económicas internas,
//  garantizado por `sinEconomia`). 5 etapas. Sin costos/margen/insumos/IDs/menú
//  admin. Lee la cotización por `cotizacion_segura` (sanitizada).
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { pesos } from '../../util.js';
import { cotizacionSegura } from '../../datos/crm.js';
import { construirPresentacionCliente } from '../../datos/clientSafe.js';
import { esClientSafe } from '../../datos/economia.js';

const dinero = (n) => (n == null || isNaN(n) || !isFinite(n) ? '—' : pesos(n));
const ETAPAS = ['NECESIDAD', 'DISTRIBUCIÓN', 'SOLUCIÓN', 'VISUAL', 'INVERSIÓN'];

export default function PresentarCliente({ proyecto, cots = [], onCerrar }) {
  const [paso, setPaso] = useState(0);
  const [estado, setEstado] = useState('cargando');
  const [partidas, setPartidas] = useState([]);
  const cot = cots[0] || null;

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!cot) { setEstado('ok'); return; }
      const { data, error } = await cotizacionSegura(cot.id);
      if (!vivo) return;
      if (error) { setEstado('error'); return; }
      const d = data && (data.partidas || data.cotizacion?.partidas) ? (data.partidas || data.cotizacion.partidas) : [];
      setPartidas(Array.isArray(d) ? d : []);
      setEstado('ok');
    })();
    return () => { vivo = false; };
  }, [cot]);

  const payload = useMemo(() => construirPresentacionCliente({
    brief: { resumen: proyecto?.brief, preguntasPendientes: [] },
    zonas: [],
    reconciliacion: { zonas: proyecto?.reconciliacion_zonas || [] },
    partidas,
    renders: [],
    inversion: { presupuesto: proyecto?.presupuesto, total: cots.reduce((s, c) => s + (Number(c.total) || 0), 0) },
    escenarios: [],
  }), [proyecto, partidas, cots]);

  const seguro = esClientSafe(payload);

  const wrap = { position: 'fixed', inset: 0, background: '#0d1b2a', color: '#fff', zIndex: 9999, overflow: 'auto', padding: '32px 24px' };
  const h1 = { fontSize: 34, fontWeight: 800, margin: '0 0 4px' };
  const sub = { opacity: 0.7, fontSize: 15, marginBottom: 24 };

  if (!seguro) {
    return (
      <div style={wrap}>
        <button className="boton" onClick={onCerrar}>Salir</button>
        <p style={{ marginTop: 40 }}>No se pudo preparar una vista segura para el cliente. Avisa a soporte.</p>
      </div>
    );
  }

  const Nav = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 }}>
      <button className="boton fantasma" style={{ color: '#fff' }} onClick={() => (paso > 0 ? setPaso(paso - 1) : onCerrar())}>{paso > 0 ? '‹ Atrás' : 'Salir'}</button>
      <div style={{ display: 'flex', gap: 6 }}>{ETAPAS.map((_, i) => <span key={i} style={{ width: 10, height: 10, borderRadius: 999, background: i <= paso ? '#4ea8de' : 'rgba(255,255,255,.25)' }} />)}</div>
      <button className="boton primario" onClick={() => (paso < ETAPAS.length - 1 ? setPaso(paso + 1) : onCerrar())}>{paso < ETAPAS.length - 1 ? 'Siguiente ›' : 'Terminar'}</button>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={sub}>{proyecto?.nombre || 'Proyecto'} · Von Haucke · {ETAPAS[paso]}</div>

        {estado === 'cargando' && <p>Preparando…</p>}
        {estado === 'error' && <p>No se pudo cargar la propuesta.</p>}

        {estado !== 'cargando' && paso === 0 && (
          <div>
            <h1 style={h1}>Lo que necesitas</h1>
            <p style={{ fontSize: 18 }}>{payload.necesidad.resumen || 'Resumen del proyecto por confirmar.'}</p>
            {payload.necesidad.preguntasPendientes.length > 0 && (
              <ul>{payload.necesidad.preguntasPendientes.map((q, i) => <li key={i} style={{ fontSize: 16 }}>{q}</li>)}</ul>
            )}
          </div>
        )}

        {estado !== 'cargando' && paso === 1 && (
          <div>
            <h1 style={h1}>Distribución</h1>
            {payload.distribucion.zonas.length === 0
              ? <p style={{ fontSize: 17, opacity: 0.8 }}>La distribución por zonas se mostrará cuando el plano esté interpretado.</p>
              : payload.distribucion.zonas.map((z, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
                  <span>{z.nombre}</span>
                  <span>{z.requerido ?? '—'} req · {z.cotizado ?? '—'} cot · {z.acomodado ?? '—'} aco {z.estado === 'ok' ? '✓' : '⚠'}</span>
                </div>
              ))}
          </div>
        )}

        {estado !== 'cargando' && paso === 2 && (
          <div>
            <h1 style={h1}>Solución</h1>
            {payload.solucion.productos.length === 0
              ? <p style={{ fontSize: 17, opacity: 0.8 }}>Aún no hay productos en la cotización.</p>
              : payload.solucion.productos.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
                  <span>{p.cantidad ? `${p.cantidad}× ` : ''}{p.nombre}{p.acabado ? ` · ${p.acabado}` : ''}</span>
                  <span>{dinero(p.precioUnitario)}</span>
                </div>
              ))}
          </div>
        )}

        {estado !== 'cargando' && paso === 3 && (
          <div>
            <h1 style={h1}>Visual</h1>
            {payload.visual.renders.length === 0
              ? <p style={{ fontSize: 17, opacity: 0.8 }}>Los renders del proyecto aparecerán aquí.</p>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                {payload.visual.renders.map((r, i) => <img key={i} src={r.url} alt={r.tipo} style={{ width: '100%', borderRadius: 10 }} />)}
              </div>}
          </div>
        )}

        {estado !== 'cargando' && paso === 4 && (
          <div>
            <h1 style={h1}>Inversión</h1>
            <div style={{ fontSize: 44, fontWeight: 800 }}>{dinero(payload.inversion.propuesta)}</div>
            {payload.inversion.presupuesto != null && (
              <p style={{ fontSize: 17, opacity: 0.85 }}>
                Presupuesto {dinero(payload.inversion.presupuesto)} · Diferencia {payload.inversion.delta == null ? '—' : dinero(payload.inversion.delta)}
              </p>
            )}
          </div>
        )}

        <Nav />
      </div>
    </div>
  );
}
