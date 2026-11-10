// ============================================================================
//  CONTENEDOR: Pantalla de Ingenieria conectada a PERSISTENCIA SUPABASE (p5).
//  Carga el expediente del usuario (reabrir_expediente_costeo) y lo GUARDA como
//  BORRADOR con concurrencia optimista (guardar_expediente_costeo).
//
//  BLOQUEO 3 (auditoria cd972a1): ya NO se clava al piloto TELSVH120. Abre el
//  expediente de ingenieria de CUALQUIER proyecto por su CLAVE real (Direccion la
//  escribe, o llega por prop desde el flujo de costeo). Sin clave, PIDE la clave;
//  nunca presenta un fixture como si fuera un costeo real.
//
//  SEGURIDAD (auditoria 36432bb): este contenedor NO ofrece acciones de confirmacion
//  con datos FABRICADOS (un "CAD" con medidas inventadas). Una confirmacion industrial
//  debe proceder de datos capturados/validados por Ingenieria o de un CAD real con
//  evidencia. Hasta que exista esa fuente, la pantalla solo MUESTRA el expediente y
//  permite guardar el borrador tal cual. La aprobacion economica (MO/precio) es del
//  backend, nunca de la UI.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import PantallaIngenieria from './PantallaIngenieria.jsx';
import { guardarExpediente, reabrirExpediente } from '../datos/persistenciaExpediente.js';
import { nube } from '../nube.js';

const NOOP_STORAGE = { getItem: () => null, setItem: () => {} };   // no localStorage: la verdad vive en Supabase

export default function IngenieriaExpediente({ svc = nube, clave: claveProp = null, expedienteInicial = null }) {
  const [clave, setClave] = useState(claveProp ? String(claveProp).trim().toUpperCase() : null);
  const [claveInput, setClaveInput] = useState('');
  const [exp, setExp] = useState(null);
  const [estado, setEstado] = useState(claveProp ? 'cargando' : 'sin_clave');   // sin_clave | cargando | listo | error
  const [msg, setMsg] = useState('');
  const dbVersion = useRef(null);                      // version de la FILA (concurrencia optimista)

  useEffect(() => {
    if (!clave) { setEstado('sin_clave'); return undefined; }
    let vivo = true;
    setEstado('cargando');
    (async () => {
      try {
        const row = await reabrirExpediente(svc, clave);
        if (!vivo) return;
        if (row && row.expediente) { setExp(row.expediente); dbVersion.current = row.version; }
        else if (expedienteInicial) { setExp(expedienteInicial); dbVersion.current = null; }
        else { setExp(null); dbVersion.current = null; }
        setEstado('listo');
      } catch (e) { if (vivo) { setEstado('error'); setMsg(String(e?.message || e)); } }
    })();
    return () => { vivo = false; };
  }, [svc, clave, expedienteInicial]);

  // onGuardar: persiste el expediente ACTUAL tal cual (borrador) en Supabase, con
  // concurrencia optimista. No fabrica geometria ni aprobaciones.
  async function onGuardar(actual) {
    const r = await guardarExpediente(svc, { clave: actual.clave || clave, expediente: actual, versionAnterior: dbVersion.current });
    dbVersion.current = r.version;
    return r;
  }

  function abrir(e) {
    if (e && e.preventDefault) e.preventDefault();
    const c = String(claveInput || '').trim().toUpperCase();
    if (c) { setExp(null); setClave(c); }
  }
  function otraClave() { setExp(null); setClave(null); setClaveInput(''); setEstado('sin_clave'); }

  if (estado === 'sin_clave') return (
    <div className="contenido" style={{ padding: 24 }}>
      <p style={{ color: '#6b645c', marginBottom: 12 }}>Abre el expediente de ingeniería de un proyecto por su <b>clave</b>.</p>
      <form onSubmit={abrir} style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
        <input value={claveInput} onChange={(e) => setClaveInput(e.target.value)}
          placeholder="Clave del proyecto" aria-label="Clave del proyecto"
          style={{ padding: '8px 10px', flex: 1, border: '1px solid #e5e2dc', borderRadius: 6 }} />
        <button type="submit" disabled={!claveInput.trim()}>Abrir expediente</button>
      </form>
    </div>
  );
  if (estado === 'cargando') return <div className="contenido" style={{ padding: 24, color: '#6b645c' }}>Cargando expediente de <b>{clave}</b>…</div>;
  if (estado === 'error') return <div className="contenido" style={{ padding: 24, color: '#c0453b' }}>No se pudo cargar el expediente de <b>{clave}</b>: {msg} <button onClick={otraClave} style={{ marginLeft: 8 }}>Otra clave</button></div>;
  if (!exp) return <div className="contenido" style={{ padding: 24, color: '#6b645c' }}>Sin expediente guardado para <b>{clave}</b>. Genera uno desde el flujo de costeo. <button onClick={otraClave} style={{ marginLeft: 8 }}>Otra clave</button></div>;

  return (
    <div className="contenido">
      {/* Sin acciones fabricadas: solo mostrar el expediente y guardar borrador. */}
      <PantallaIngenieria expediente={exp} onGuardar={onGuardar} persistencia={NOOP_STORAGE} />
    </div>
  );
}
