// ============================================================================
//  PANEL: Expediente de Ingenieria DESDE el despiece vivo de VONI (P1, circuito).
//
//  Toma el despiece RICO del Asistente (b.componentes) + ERP + catalogo de lamina real
//  y arma el EXPEDIENTE INDUSTRIAL con el puente (reusa costearProductoIndustrial).
//  Circuito completo (P1-C auditoria e48c0c2), SIN valores predeterminados como hechos:
//    · CONFIRMACIONES: Ingenieria captura el desarrollo CAD REAL (largo×ancho) de cada
//      pieza pendiente. Los campos nacen VACIOS; nada se confirma solo.
//    · RECALCULO: al confirmar, recostearExpediente recalcula y versiona.
//    · GUARDADO/REAPERTURA: guarda el expediente por clave (RPC guardar_expediente_costeo,
//      RLS por propietario); se reabre por clave en la pantalla de Ingenieria.
//  Montaje colapsado en el flujo de costeo (Diseno/veCostos). No toca el motor.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PantallaIngenieria from './PantallaIngenieria.jsx';
import { expedienteIndustrialDesdeDespiece } from '../datos/expedienteIndustrialDesdeDespiece.js';
import { recostearExpediente } from '../datos/pantallaIngenieria.js';
import { cargarLaminaDesdeSupabase } from '../datos/catalogoLaminaVigente.js';
import { guardarExpediente } from '../datos/persistenciaExpediente.js';
import { nube } from '../nube.js';

const NOOP = { getItem: () => null, setItem: () => {} };

export default function ExpedienteIngenieriaPanel({ componentes = [], insumos = {}, clave = null, nombre = null, svc = nube }) {
  const [lamina, setLamina] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [confirmado, setConfirmado] = useState(null);  // expediente recalculado tras confirmaciones
  const [dims, setDims] = useState({});                // input CAD de Ingenieria (NACE VACIO)
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const dbVersion = useRef(null);   // version de la FILA (concurrencia optimista); null = aun no guardado

  useEffect(() => {
    if (!abierto) return undefined;
    let vivo = true;
    cargarLaminaDesdeSupabase(svc).then((r) => { if (vivo) setLamina(r?.lamina || []); }).catch(() => { if (vivo) setLamina([]); });
    return () => { vivo = false; };
  }, [abierto, svc]);

  const base = useMemo(() => {
    const despiece = (Array.isArray(componentes) ? componentes : []).map((c) => {
      const sec = insumos?.[c.insumoId]?.seccion;
      return { clave: c.nombre || c.insumoId, insumoId: c.insumoId, desc: c.nombre || c.insumoId,
        cantidad: Number(c.cantidad ?? c.piezas ?? 1), seccion: sec, largoMM: c.largoMM, anchoMM: c.anchoMM,
        esCompraVenta: sec === 'graficos' || sec === 'iluminacion' };
    });
    return expedienteIndustrialDesdeDespiece(despiece, { clave: clave || 'EN-COSTEO', nombre, insumosERP: insumos, catalogoLamina: lamina });
  }, [componentes, insumos, lamina, clave, nombre]);

  // Si cambia el despiece base, se descartan confirmaciones y la version guardada (es otro expediente).
  useEffect(() => { setConfirmado(null); setMsg(''); dbVersion.current = null; }, [base]);

  const expediente = confirmado || base;
  const pendientes = expediente.costo_industrial?.cobertura?.desarrollos_pendientes || [];

  function confirmarCAD(clavePieza) {
    const d = dims[clavePieza] || {};
    const L = Number(d.L), W = Number(d.W);
    if (!(L > 0) || !(W > 0)) { setMsg(`Captura largo y ancho reales (mm) de CAD para ${clavePieza}.`); return; }
    try {
      const next = recostearExpediente(expediente, { tipo: 'desarrollo', clave: clavePieza, desarrollo_mm: [L, W], fuente: 'CAD' });
      setConfirmado(next); setMsg(`✓ ${clavePieza} recalculado (v${next.version}).`);
    } catch (e) { setMsg(String(e?.message || e)); }
  }

  async function guardar() {
    setGuardando(true); setMsg('');
    try {
      // Concurrencia optimista: se manda la version que creemos vigente. Si otra sesion ya guardo,
      // la RPC rechaza (version distinta) y NO se sobrescribe en silencio.
      const r = await guardarExpediente(svc, { clave: expediente.clave, expediente, versionAnterior: dbVersion.current });
      if (r && r.ok === false) {
        setMsg(`No se guardó (otra sesión cambió el expediente): ${r.error || 'conflicto de versión'}. Reabre y reintenta.`);
      } else {
        dbVersion.current = (r && r.version != null) ? r.version : dbVersion.current;
        setMsg(`✓ Guardado v${dbVersion.current ?? ''} (clave ${expediente.clave}). Se reabre en Ingeniería por su clave.`);
      }
    } catch (e) {
      const m = String(e?.message || e);
      setMsg(/versi[oó]n|conflicto|concurren|40001|stale/i.test(m)
        ? 'No se guardó: otra sesión cambió el expediente. Reabre y reintenta (no se sobrescribió).'
        : `No se pudo guardar: ${m}`);
    } finally { setGuardando(false); }
  }

  const setDim = (c, campo, val) => setDims((s) => ({ ...s, [c]: { ...s[c], [campo]: val } }));

  return (
    <details className="tarjeta" style={{ marginTop: 16 }} onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Expediente de Ingeniería (industrial){pendientes.length ? ` — ${pendientes.length} pieza(s) por confirmar (CAD)` : ''}
      </summary>
      <div style={{ marginTop: 12 }}>
        {pendientes.length > 0 && (
          <div style={{ border: '1px solid var(--ambar,#b06f12)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Ingeniería confirma el desarrollo (CAD) — campos vacíos, nada se asume:</div>
            {pendientes.map((p) => (
              <div key={p.clave} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0' }}>
                <span style={{ minWidth: 160 }}>{p.clave}</span>
                <input type="number" min="0" placeholder="largo mm" aria-label={`largo ${p.clave}`}
                  value={dims[p.clave]?.L || ''} onChange={(e) => setDim(p.clave, 'L', e.target.value)} style={{ width: 92 }} />
                <span>×</span>
                <input type="number" min="0" placeholder="ancho mm" aria-label={`ancho ${p.clave}`}
                  value={dims[p.clave]?.W || ''} onChange={(e) => setDim(p.clave, 'W', e.target.value)} style={{ width: 92 }} />
                <button type="button" onClick={() => confirmarCAD(p.clave)}>Confirmar CAD</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button type="button" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar expediente'}</button>
          {msg && <span style={{ fontSize: 13, color: /No se pudo|Captura/.test(msg) ? 'var(--alerta,#c0453b)' : 'var(--ok,#2e7d52)' }}>{msg}</span>}
        </div>
        <PantallaIngenieria expediente={expediente} persistencia={NOOP} />
      </div>
    </details>
  );
}
