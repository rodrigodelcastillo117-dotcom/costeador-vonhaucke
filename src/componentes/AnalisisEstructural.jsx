// ============================================================================
//  N3 — ANÁLISIS ESTRUCTURAL (panel read-only del Costeador). Gated costing_ai_v2
//  (en el llamador). Muestra el checklist de componentes que un mueble de este
//  tipo suele llevar, con su estado de evidencia, y un PROPUESTA_DIFF contra el
//  BOM actual. NUNCA modifica el BOM certificado: sólo propone. ALBA/BOM intactos.
// ============================================================================
import { useMemo, useState } from 'react';
import { analizarEstructura, diffContraBOM } from '../datos/estructura.js';

// Deriva un tipo de mueble aproximado del nombre (para elegir el checklist).
function tipoDe(costeo) {
  const n = String(costeo?.nombre || costeo?.linea || '').toLowerCase();
  if (/caj[oó]n|cajoner/.test(n)) return 'cajonera';
  if (/archiv/.test(n)) return 'archivero';
  if (/credenz|libre|gabinet/.test(n)) return 'credenza';
  if (/mesa|junta/.test(n)) return 'mesa';
  if (/mampara|biombo|panel/.test(n)) return 'mampara';
  if (/escritorio|estaci|bench|puesto/.test(n)) return 'escritorio';
  return 'generico';
}

const ESTADO_COLOR = {
  VISIBLE_EN_PLANO: { bg: '#e6f4ea', fg: '#1e6b33' },
  CONFIRMADO_USUARIO: { bg: '#e6f4ea', fg: '#1e6b33' },
  INFERIDO_ESTRUCTURAL: { bg: '#e8eef7', fg: '#274b7a' },
  SUPUESTO: { bg: '#fdf7e6', fg: '#8a5a00' },
};

export default function AnalisisEstructural({ costeo }) {
  const [abierto, setAbierto] = useState(false);
  const tipo = tipoDe(costeo);
  const analisis = useMemo(() => analizarEstructura({ tipo }), [tipo]);
  const bom = useMemo(() => (costeo?.componentes || []).map((c) => ({ componente: c.nombre, cantidad: c.cantidad })), [costeo]);
  const diff = useMemo(() => diffContraBOM(analisis, bom), [analisis, bom]);

  return (
    <div className="tarjeta" style={{ borderLeft: '3px solid #b22a22' }}>
      <button type="button" className="boton fantasma" style={{ width: '100%', textAlign: 'left', padding: 0 }} onClick={() => setAbierto((v) => !v)}>
        <strong>Análisis estructural (IA)</strong> <span className="ayuda">· {abierto ? 'ocultar' : 'ver'} checklist de {tipo}</span>
      </button>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <p className="ayuda">Checklist de referencia para un mueble tipo <strong>{tipo}</strong>. No modifica el BOM: cuando haya plano interpretado marcaré lo visible y propondré un diff.</p>
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {analisis.componentes.map((c) => {
              const col = ESTADO_COLOR[c.evidencia.fuente] || ESTADO_COLOR.SUPUESTO;
              return (
                <div key={c.componente} className="fila" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize' }}>{c.componente}</span>
                  <span style={{ background: col.bg, color: col.fg, borderRadius: 999, padding: '1px 8px', fontSize: 11 }}>{c.evidencia.fuente.replace(/_/g, ' ').toLowerCase()}</span>
                </div>
              );
            })}
          </div>
          {!diff.sinCambios && (
            <div className="alerta ambar" style={{ marginTop: 8 }}>
              <span className="texto">
                Propuesta (no aplicada): {diff.agregados.length} por agregar, {diff.eliminados.length} no vistos en el checklist.
                Revísalo manualmente; el BOM certificado no cambia solo.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
