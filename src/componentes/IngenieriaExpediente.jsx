// ============================================================================
//  CONTENEDOR: Pantalla de Ingenieria conectada a PERSISTENCIA SUPABASE (p5).
//  Carga el expediente del usuario (reabrir_expediente_costeo) y lo GUARDA como
//  BORRADOR con concurrencia optimista (guardar_expediente_costeo). Sustituye
//  localStorage por Supabase.
//
//  SEGURIDAD (auditoria 36432bb, 2o bloqueo): este contenedor NO ofrece acciones
//  de confirmacion con datos FABRICADOS (p.ej. un "CAD" con medidas inventadas).
//  Una confirmacion industrial debe proceder de datos capturados/validados por
//  Ingenieria o de un CAD real con evidencia. Hasta que exista esa fuente, la
//  pantalla solo MUESTRA el expediente y permite guardar el borrador tal cual.
//  La aprobacion economica (MO/precio) es del backend, nunca de la UI.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import PantallaIngenieria from './PantallaIngenieria.jsx';
import { guardarExpediente, reabrirExpediente } from '../datos/persistenciaExpediente.js';
import { nube } from '../nube.js';
import expedientePiloto from '../../expedientes/EXPEDIENTE_TELSVH120.json';

const NOOP_STORAGE = { getItem: () => null, setItem: () => {} };   // no localStorage: la verdad vive en Supabase
const CLAVE_PILOTO = 'TELSVH120';

export default function IngenieriaExpediente({ svc = nube, clave = CLAVE_PILOTO, expedienteInicial = expedientePiloto }) {
  const [exp, setExp] = useState(null);
  const [estado, setEstado] = useState('cargando');   // cargando | listo | error
  const [msg, setMsg] = useState('');
  const dbVersion = useRef(null);                      // version de la FILA (concurrencia optimista), distinta de exp.version

  useEffect(() => {
    let vivo = true;
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

  if (estado === 'cargando') return <div className="contenido" style={{ padding: 24, color: '#6b645c' }}>Cargando expediente…</div>;
  if (estado === 'error') return <div className="contenido" style={{ padding: 24, color: '#c0453b' }}>No se pudo cargar el expediente: {msg}</div>;
  if (!exp) return <div className="contenido" style={{ padding: 24, color: '#6b645c' }}>Sin expediente guardado para <b>{clave}</b>. Genera uno desde el flujo de costeo.</div>;

  return (
    <div className="contenido">
      {/* Sin acciones fabricadas: solo mostrar el expediente y guardar borrador. */}
      <PantallaIngenieria expediente={exp} onGuardar={onGuardar} persistencia={NOOP_STORAGE} />
    </div>
  );
}
