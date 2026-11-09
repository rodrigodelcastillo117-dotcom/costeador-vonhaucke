// ============================================================================
//  CONTENEDOR: Pantalla de Ingenieria conectada a PERSISTENCIA SUPABASE (p5).
//  Carga el expediente del usuario (reabrir_expediente_costeo), aplica confirmaciones
//  recalculando con el motor, y GUARDA con concurrencia optimista (guardar_expediente_costeo).
//  Sustituye localStorage por Supabase. La UI NO autoriza estandares de MO (fail-closed):
//  las confirmaciones de geometria (CAD) si recalculan; la aprobacion economica es del backend.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import PantallaIngenieria from './PantallaIngenieria.jsx';
import { recostearExpediente } from '../datos/pantallaIngenieria.js';
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

  // onConfirmar: recalcula con el motor y PERSISTE en Supabase (optimista). La UI no autoriza MO.
  async function onConfirmar(confirmacion, actual) {
    const next = recostearExpediente(actual, confirmacion, { autoridadEstandares: undefined });
    const r = await guardarExpediente(svc, { clave: next.clave || clave, expediente: next, versionAnterior: dbVersion.current });
    dbVersion.current = r.version;
    return next;
  }

  if (estado === 'cargando') return <div className="contenido" style={{ padding: 24, color: '#6b645c' }}>Cargando expediente…</div>;
  if (estado === 'error') return <div className="contenido" style={{ padding: 24, color: '#c0453b' }}>No se pudo cargar el expediente: {msg}</div>;
  if (!exp) return <div className="contenido" style={{ padding: 24, color: '#6b645c' }}>Sin expediente guardado para <b>{clave}</b>. Genera uno desde el flujo de costeo.</div>;

  return (
    <div className="contenido">
      <PantallaIngenieria expediente={exp} onConfirmar={onConfirmar} persistencia={NOOP_STORAGE} acciones={[
        // Confirmacion de geometria CAD (no es aprobacion economica): recalcula y persiste.
        { id: 'ing-confirmar-cad-cue', label: 'Confirmar desarrollo CAD del cuerpo', confirmacion: { tipo: 'desarrollo', clave: 'TELSVH120-CUE', desarrollo_mm: [2770, 865], fuente: 'CAD', version: 'cad-cue-1' } },
      ]} />
    </div>
  );
}
