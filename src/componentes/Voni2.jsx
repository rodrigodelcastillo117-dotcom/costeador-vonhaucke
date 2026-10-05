// ============================================================================
//  VONI 2.0 — PANEL GLOBAL (IMPLEMENTED_PENDING_VISUAL_SMOKE).
//  Un solo cerebro accesible desde cualquier ruta. Determinista: usa el núcleo
//  (responder) con el proveedor real de tools. Respeta rol y modo cliente. NO
//  llama a ningún LLM; responde con análisis determinista (readiness, gaps,
//  atención, budget, riesgo). La UI simplifica el contrato de respuesta.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { responder, sugerencias } from '../voni/nucleo.js';
import { proveedorReal } from '../voni/proveedorReal.js';

const COLOR_URGENCIA = {
  BLOQUEANTE: { bg: '#fbe6e4', fg: '#9a2820' },
  ALTA: { bg: '#fdf7e6', fg: '#8a5a00' },
  MEDIA: { bg: '#e8eef7', fg: '#274b7a' },
  BAJA: { bg: '#e6f4ea', fg: '#1e6b33' },
};
const COLOR_ESTADO = {
  OK: { bg: '#e6f4ea', fg: '#1e6b33', t: 'Todo en orden' },
  ATENCION: { bg: '#fdf7e6', fg: '#8a5a00', t: 'Requiere atención' },
  BLOQUEADO: { bg: '#fbe6e4', fg: '#9a2820', t: 'Bloqueado' },
  DESCONOCIDO: { bg: '#eee', fg: '#555', t: '—' },
};

export default function Voni2({ ctx = {}, onCerrar }) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('idle'); // idle|cargando|ok|error
  const [resp, setResp] = useState(null);
  const sugs = useMemo(() => sugerencias(ctx), [ctx]);

  async function preguntar(texto) {
    const query = (texto ?? q).trim();
    if (!query) return;
    setEstado('cargando'); setResp(null);
    try {
      const { respuesta } = await responder({ query, ctx, prov: proveedorReal });
      setResp(respuesta); setEstado('ok');
    } catch (_e) {
      setEstado('error');
    }
  }

  useEffect(() => { const onEsc = (e) => { if (e.key === 'Escape') onCerrar?.(); }; window.addEventListener('keydown', onEsc); return () => window.removeEventListener('keydown', onEsc); }, [onCerrar]);

  const est = resp ? (COLOR_ESTADO[resp.estado] || COLOR_ESTADO.DESCONOCIDO) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,42,.45)', zIndex: 9998, display: 'flex', justifyContent: 'flex-end' }} onClick={onCerrar}>
      <div style={{ width: 'min(440px, 100%)', background: 'var(--panel)', color: 'var(--carbon)', height: '100%', overflow: 'auto', padding: 20, borderLeft: '1px solid var(--linea-fuerte)', boxShadow: '-8px 0 34px rgba(0,0,0,.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 18 }}>Voni{ctx.clientSafe ? ' · modo cliente' : ''}</strong>
          <button className="boton" onClick={onCerrar} aria-label="Cerrar" style={{ minHeight: 40, padding: '0 14px' }}>Cerrar ✕</button>
        </div>
        <p className="ayuda" style={{ marginTop: 2 }}>Pregúntame sobre este {ctx.project_id ? 'proyecto' : 'espacio'}. Reviso lo que tu rol puede ver.</p>

        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input className="campo" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') preguntar(); }}
            placeholder="¿Está lista? ¿Qué falta?…" style={{ flex: 1, minHeight: 42 }} />
          <button className="boton primario" onClick={() => preguntar()} disabled={estado === 'cargando'}>Preguntar</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {sugs.map((s, i) => <button key={i} className="chip" onClick={() => { setQ(s); preguntar(s); }}>{s}</button>)}
        </div>

        {estado === 'cargando' && <p className="ayuda" style={{ marginTop: 16 }}>Revisando…</p>}
        {estado === 'error' && <div className="alerta roja" style={{ marginTop: 16 }}><span className="texto">No pude revisar ahora. Intenta de nuevo.</span></div>}

        {estado === 'ok' && resp && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'inline-block', background: est.bg, color: est.fg, borderRadius: 999, padding: '4px 12px', fontWeight: 700, fontSize: 13 }}>{est.t}</div>
            <h3 style={{ margin: '10px 0 4px' }}>{resp.que_paso || '—'}</h3>
            {resp.por_que && <p className="ayuda">{resp.por_que}</p>}
            {resp.nota_permiso && <div className="alerta ambar" style={{ marginTop: 8 }}><span className="texto">{resp.nota_permiso}</span></div>}

            {resp.bloqueos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong style={{ fontSize: 13 }}>Pendientes</strong>
                {resp.bloqueos.map((b, i) => {
                  const c = COLOR_URGENCIA[b.urgencia] || COLOR_URGENCIA.MEDIA;
                  return (
                    <div key={i} style={{ border: '1px solid var(--linea)', borderLeft: `4px solid ${c.fg}`, borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
                      <div style={{ fontWeight: 700 }}>{b.titulo} <span style={{ background: c.bg, color: c.fg, borderRadius: 999, padding: '1px 8px', fontSize: 11, marginLeft: 6 }}>{b.urgencia}</span></div>
                      {b.detalle && <div className="ayuda">{b.detalle}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {resp.accion && <div style={{ marginTop: 12 }}><strong style={{ fontSize: 13 }}>Siguiente paso</strong><p className="ayuda">{resp.accion}</p></div>}

            {resp.evidencia.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="ayuda">Evidencia ({resp.evidencia.length})</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {resp.evidencia.map((a, i) => (
                    <li key={i} className="ayuda" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>[{a.tipo}]</span> {a.texto}
                      {a.fuente?.source_type && <span style={{ opacity: .7 }}> · {a.fuente.source_type}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {resp.lentes?.length > 0 && <p className="ayuda" style={{ marginTop: 10, fontSize: 11, opacity: .7 }}>Revisado desde: {resp.lentes.join(' · ')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
