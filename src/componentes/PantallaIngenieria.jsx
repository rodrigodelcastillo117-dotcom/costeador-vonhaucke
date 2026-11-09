// ============================================================================
//  PANTALLA DE INGENIERIA (dentro de COSTEAR) — directiva Direccion 2caa5ee, punto 5.
//  5 secciones sobre el expediente (ESTO ENTENDI / ASI LO FABRICARIA / ESTO NECESITO
//  CONFIRMAR / ESTE ES EL COSTO / ASI PODRIA MEJORARSE). Una confirmacion RECALCULA
//  con el motor existente (recostearExpediente), PERSISTE (localStorage) y permite
//  REABRIR sin perder ninguna decision. No construye otro motor; usa el view-model.
// ============================================================================
import React, { useMemo, useState, useCallback } from 'react';
import { vistaIngenieria, recostearExpediente } from '../datos/pantallaIngenieria.js';

const money = (n) => (n == null || !Number.isFinite(Number(n))) ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KEY = (clave) => `costear.expediente.${clave}`;

function leerPersistido(clave, inicial) {
  try { const s = localStorage.getItem(KEY(clave)); if (s) return JSON.parse(s); } catch (_e) { /* storage bloqueado */ }
  return inicial;
}
function persistir(exp) {
  try { localStorage.setItem(KEY(exp.clave), JSON.stringify(exp)); } catch (_e) { /* no-op */ }
}

export default function PantallaIngenieria({ expediente: inicial }) {
  // REABRIR: al montar, si hay una version persistida (con confirmaciones), se recupera.
  const [exp, setExp] = useState(() => leerPersistido(inicial?.clave, inicial));
  const v = useMemo(() => vistaIngenieria(exp), [exp]);

  const confirmar = useCallback((confirmacion) => {
    setExp((prev) => {
      let next; try { next = recostearExpediente(prev, confirmacion); } catch (e) { return prev; }
      persistir(next);          // PERSISTE la decision + el recalculo
      return next;
    });
  }, []);

  const c = v.este_es_el_costo;
  const confs = exp.confirmaciones || [];

  return (
    <div className="pant-ing" style={{ maxWidth: 920, margin: '0 auto', padding: '16px', font: '14px/1.5 system-ui, sans-serif', color: '#1E1B1A' }} data-testid="pantalla-ingenieria">
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', borderBottom: '1px solid #e5e2dc', paddingBottom: 12 }}>
        <div style={{ fontFamily: 'monospace', color: '#2f6f8f', fontWeight: 600 }}>{exp.clave}</div>
        <div style={{ flex: 1, minWidth: 180 }}>{v.esto_entendi.producto}</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 20 }} data-testid="total-parcial">{money(c.total_parcial)}</div>
          <div data-testid="estado-economico" style={{ fontSize: 12, color: c.emitible_comercial ? '#2e7d52' : '#b06f12', fontWeight: 600 }}>
            {c.emitible_comercial ? 'OFICIAL' : 'PARCIAL — no emitible'} · v{exp.version || 1}
          </div>
        </div>
      </header>

      <section style={{ marginTop: 16 }}>
        <h3>Esto entendí</h3>
        <p style={{ color: '#6b645c' }}>{v.esto_entendi.funcion}</p>
        <p style={{ fontFamily: 'monospace' }}>{v.esto_entendi.dimensiones_mm && `${v.esto_entendi.dimensiones_mm.ancho} × ${v.esto_entendi.dimensiones_mm.alto} × ${v.esto_entendi.dimensiones_mm.fondo} mm`}</p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Así lo fabricaría</h3>
        <ul>
          {v.asi_lo_fabricaria.piezas_fabricadas.map((p) => (
            <li key={p.clave}><code>{p.clave}</code> · {p.lamina} (pid:{p.precio_id}) · {money(p.costo_mp)} · <b>{p.estado}</b></li>
          ))}
        </ul>
        <p style={{ color: '#b06f12' }} data-testid="pendientes-3d">Desarrollos 3D pendientes: {(v.asi_lo_fabricaria.desarrollos_pendientes || []).map((d) => d.clave).join(', ') || 'ninguno'}</p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Esto necesito confirmar</h3>
        {v.esto_necesito_confirmar.map((d) => (
          <div key={d.decision} style={{ border: '1px solid #e5e2dc', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <b>{d.decision}</b> <span style={{ color: '#6b645c', fontFamily: 'monospace', fontSize: 12 }}>({d.n})</span>
            <div style={{ color: '#6b645c', fontSize: 12 }}>{d.afecta.join(', ')}</div>
          </div>
        ))}
        {/* Confirmaciones que RECALCULAN (demo de Ingenieria). */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" data-testid="confirmar-cad-cue"
            onClick={() => confirmar({ tipo: 'desarrollo', clave: 'TELSVH120-CUE', desarrollo_mm: [2770, 865], fuente: 'CAD', version: 'cad-cue-1' })}>
            Confirmar desarrollo CAD del cuerpo
          </button>
          <button type="button" data-testid="confirmar-estandares"
            onClick={() => confirmar({ tipo: 'estandares', estandares: (exp.inputs?.routing?.operaciones || []).map((o) => ({ centro: o.centro, op: o.op, tiempo_proceso_min: 2, tarifa_mxn_min: 8, lote_piezas: 1, version: 'ref-1', vigente_desde: '2026-01-01', autorizado: true })) })}>
            Cargar estándares de MO
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Éste es el costo</h3>
        <ul>
          <li>Material incluido: <b data-testid="material-incluido">{money(c.material_incluido)}</b></li>
          <li>MO (POLÍTICA_VH): {money(c.mano_obra_politica_vh)} · GIF: {money(c.gif)}</li>
          <li>MO por tiempos (routing): <span data-testid="mo-routing">{c.mano_obra_routing_tiempos == null ? 'PENDIENTE' : money(c.mano_obra_routing_tiempos)}</span></li>
          <li>Total PARCIAL: <b>{money(c.total_parcial)}</b> · Total OFICIAL: <span data-testid="total-oficial">{c.total_oficial == null ? 'NO PROCEDE' : money(c.total_oficial)}</span></li>
        </ul>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Así podría mejorarse</h3>
        <ul>{v.asi_podria_mejorarse.map((m, i) => <li key={i}>{m.propuesta}</li>)}</ul>
      </section>

      <footer style={{ marginTop: 16, color: '#6b645c', fontSize: 12, borderTop: '1px solid #e5e2dc', paddingTop: 8 }}>
        <span data-testid="n-confirmaciones">Confirmaciones aplicadas: {confs.length}</span>
        {confs.length > 0 && <span> — {confs.map((x) => x.tipo).join(', ')}</span>}
      </footer>
    </div>
  );
}
