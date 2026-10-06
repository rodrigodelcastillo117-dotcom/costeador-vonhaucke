// ============================================================================
//  VONI 2.0 — PANEL GLOBAL (IMPLEMENTED_PENDING_VISUAL_SMOKE).
//  Un solo cerebro accesible desde cualquier ruta. Determinista: usa el núcleo
//  (responder) con el proveedor real de tools. Respeta rol y modo cliente. NO
//  llama a ningún LLM; responde con análisis determinista (readiness, gaps,
//  atención, budget, riesgo). La UI simplifica el contrato de respuesta.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { responder, sugerencias, guiaRuta } from '../voni/nucleo.js';
import { proveedorReal } from '../voni/proveedorReal.js';
import { voniCouncil } from '../nube.js';

const COLOR_URGENCIA = {
  BLOQUEANTE: { bg: '#fbe6e4', fg: '#9a2820' },
  ALTA: { bg: '#fdf7e6', fg: '#8a5a00' },
  MEDIA: { bg: '#e8eef7', fg: '#274b7a' },
  BAJA: { bg: '#e6f4ea', fg: '#1e6b33' },
};
const COLOR_EVIDENCIA = {
  HECHO: { bg:'#e6f4ea', fg:'#1e6b33', t:'Hecho' },
  INFERENCIA: { bg:'#e8eef7', fg:'#274b7a', t:'Inferencia' },
  SUPUESTO: { bg:'#f7efe2', fg:'#8a5a00', t:'Supuesto' },
  RECOMENDACION: { bg:'#eee8f7', fg:'#5b3c8a', t:'Recomendación' },
};

function taskCouncilDe(ctx = {}) {
  const r = String(ctx.route || ctx.ruta || '').toLowerCase();
  if (/cost/.test(r)) return 'cost_review';
  if (/acomodo|layout|espacio/.test(r)) return 'layout_review';
  if (/cocrear|producto|especial/.test(r)) return 'review_product';
  if (/cotizacion|quote/.test(r)) return 'quote_review';
  if (/plano|plan/.test(r)) return 'plan_review';
  return 'general';
}

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
  const [councilEstado, setCouncilEstado] = useState('idle');
  const [councilResp, setCouncilResp] = useState(null);
  const sugs = useMemo(() => sugerencias(ctx), [ctx]);
  const guia = useMemo(() => guiaRuta(ctx), [ctx]);

  async function preguntar(texto) {
    const query = (texto ?? q).trim();
    if (!query) return;
    setEstado('cargando'); setResp(null); setCouncilEstado('idle'); setCouncilResp(null);
    try {
      const { respuesta } = await responder({ query, ctx, prov: proveedorReal });
      setResp(respuesta); setEstado('ok');
    } catch (_e) {
      setEstado('error');
    }
  }

  async function profundizar() {
    const query = q.trim() || resp?.que_paso || '';
    if (!query || councilEstado === 'cargando') return;
    setCouncilEstado('cargando'); setCouncilResp(null);
    try {
      const r = await voniCouncil({
        task: taskCouncilDe(ctx),
        mode: 'deep',
        request: query,
        context: ctx,
        constraints: ['No modificar el costo oficial con heurísticas de IA.', 'Separar hechos, inferencias y recomendaciones.', 'Cualquier cambio técnico/económico requiere validación determinista.'],
      });
      if (!r?.ok) throw new Error(r?.error || 'Council no disponible');
      setCouncilResp(r); setCouncilEstado('ok');
    } catch (_e) {
      setCouncilEstado('error');
    }
  }

  useEffect(() => { const onEsc = (e) => { if (e.key === 'Escape') onCerrar?.(); }; window.addEventListener('keydown', onEsc); return () => window.removeEventListener('keydown', onEsc); }, [onCerrar]);

  const est = resp ? (COLOR_ESTADO[resp.estado] || COLOR_ESTADO.DESCONOCIDO) : null;
  const councilOut = councilResp?.opinions?.find((o) => o?.ok && o?.output)?.output || null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,42,.45)', zIndex: 9998, display: 'flex', justifyContent: 'flex-end' }} onClick={onCerrar}>
      <div style={{ width: 'min(440px, 100%)', background: 'var(--panel)', color: 'var(--carbon)', height: '100%', overflow: 'auto', padding: 20, borderLeft: '1px solid var(--linea-fuerte)', boxShadow: '-8px 0 34px rgba(0,0,0,.5)' }} onClick={(e) => e.stopPropagation()}>
        <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 18 }}>Voni{ctx.clientSafe ? ' · modo cliente' : ''}</strong>
          <button className="boton" onClick={onCerrar} aria-label="Cerrar" style={{ minHeight: 40, padding: '0 14px' }}>Cerrar ✕</button>
        </div>
        <p className="ayuda" style={{ marginTop: 2 }}>Pregúntame sobre este {ctx.project_id ? 'proyecto' : 'espacio'}. Reviso lo que tu rol puede ver.</p>
        <div style={{marginTop:10,padding:'10px 12px',border:'1px solid var(--linea)',borderRadius:10,background:'rgba(49,94,82,.08)'}}>
          <strong style={{fontSize:13}}>{guia.titulo}</strong>
          <div className="ayuda" style={{marginTop:3,lineHeight:1.45}}>{guia.detalle}</div>
        </div>

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

            {(resp.impacto || typeof resp.confianza === 'number') && (
              <div style={{display:'grid',gridTemplateColumns:resp.impacto?'1fr auto':'auto',gap:10,alignItems:'start',marginTop:10,padding:10,border:'1px solid var(--linea)',borderRadius:8}}>
                {resp.impacto && <div><strong style={{fontSize:12}}>Impacto</strong><div className="ayuda" style={{marginTop:2}}>{resp.impacto}</div></div>}
                {typeof resp.confianza === 'number' && <div style={{textAlign:'right'}}>
                  <strong style={{fontSize:12}}>Confianza</strong>
                  <div style={{fontSize:18,fontWeight:800,color:resp.confianza>=.8?'#1e6b33':resp.confianza>=.55?'#8a5a00':'#9a2820'}}>{Math.round(resp.confianza*100)}%</div>
                </div>}
              </div>
            )}

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

            <div className="voni2-deep" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--linea)' }}>
              <button className="boton" style={{ width: '100%' }} onClick={profundizar} disabled={councilEstado === 'cargando'}>
                {councilEstado === 'cargando' ? 'Council revisando a fondo…' : councilEstado === 'ok' ? 'Revisar otra vez a fondo' : 'Analizar a fondo con VONI Council'}
              </button>
              <div className="ayuda gris" style={{ marginTop: 5 }}>Diseño + ingeniería + materiales + manufactura + costeo/comercial cuando aplique. La decisión final sigue en los validadores.</div>
              {councilEstado === 'error' && <div className="alerta ambar" style={{ marginTop: 8 }}><span className="texto">El Council no respondió; la respuesta determinista de arriba sigue vigente.</span></div>}
              {councilEstado === 'ok' && councilOut && (
                <div style={{ marginTop: 9, border: '1px solid var(--linea)', borderRadius: 10, padding: 10 }}>
                  <div className="fila" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 12 }}>Council · {councilResp?.council?.status || 'revisión'}</strong>
                    <span className="chip">{councilResp?.mode === 'deep' ? 'PROFUNDO' : 'RÁPIDO'}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 750 }}>{councilOut.summary}</div>
                  {(councilOut.blockers || []).slice(0, 3).map((x, i) => <div key={'cb'+i} className="ayuda" style={{ marginTop: 5, color: '#9a2820' }}>✕ {x}</div>)}
                  {(councilOut.recommendations || []).slice(0, 3).map((x, i) => (
                    <div key={'cr'+i} style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--linea)' }}>
                      <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: '.04em' }}>{x.category}</div>
                      <div className="ayuda"><strong>{x.what}</strong>{x.why ? ` · ${x.why}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {resp.evidencia.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="ayuda">Evidencia ({resp.evidencia.length})</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {resp.evidencia.map((a, i) => {
                    const ev = COLOR_EVIDENCIA[a.tipo] || COLOR_EVIDENCIA.INFERENCIA;
                    const cf = typeof a.fuente?.confidence === 'number' ? Math.round(a.fuente.confidence * 100) : null;
                    return (
                      <li key={i} className="ayuda" style={{ marginBottom: 7, lineHeight: 1.45 }}>
                        <span style={{background:ev.bg,color:ev.fg,borderRadius:999,padding:'1px 7px',fontSize:10,fontWeight:700,marginRight:5}}>{ev.t}</span>
                        {a.texto}
                        {a.fuente?.source_type && <span style={{ opacity: .72 }}> · fuente: {a.fuente.source_type}</span>}
                        {cf != null && <span style={{ opacity: .72 }}> · {cf}%</span>}
                      </li>
                    );
                  })}
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
