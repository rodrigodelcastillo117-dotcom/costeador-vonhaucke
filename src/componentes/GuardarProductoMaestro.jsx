// LOOP DE APRENDIZAJE (A): botón "Confirmar despiece → guardar como Producto Maestro".
// Toma el despiece YA confirmado por la persona (detalleInsumos del motor) y lo guarda con la RPC
// gobernada guardar_producto_maestro (sólo Dirección; la puerta la hace el backend).
//
// CONTRATO DE INTEGRIDAD (P0 2026-11-09): guarda por omisión como BORRADOR. VERIFICADO (certificable)
// es un acto EXPLÍCITO y sólo cuando la integridad lo permite (sin pendientes, todo trazable). Las
// piezas pendientes se CONSERVAN y se muestran. Sustituir una clave existente exige confirmación
// (control optimista por versión); nunca se pisa en silencio. Seller-safe: lo usa Dirección.
import React, { useMemo, useState } from 'react';
import { nube } from '../nube.js';
import { bomDesdeDespiece, listoParaGuardar, puedeVerificarse } from '../datos/productoMaestroDesdeDespiece.js';

const pesos = (x) => (x == null || !Number.isFinite(Number(x))) ? '—' : '$' + Number(x).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GuardarProductoMaestro({ detalleInsumos = [], insumos = {}, factorMo, factorGif, familia = null, nombreSugerido = '', dims_mm = null, rpc = (n, p) => nube.rpc(n, p), leerVersion, onGuardado }) {
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState(nombreSugerido || '');
  const [verificar, setVerificar] = useState(false);
  const [sustituir, setSustituir] = useState(false);
  const [estado, setEstado] = useState({ cargando: false, ok: null, error: '' });

  const bom = useMemo(
    () => bomDesdeDespiece(detalleInsumos, insumos, { clave, nombre, factorMo, factorGif, familia, dims_mm, fuente: 'Confirmado en COSTEAR', verificar }),
    [detalleInsumos, insumos, clave, nombre, factorMo, factorGif, familia, dims_mm, verificar]
  );
  const v = listoParaGuardar(bom);
  const elegibleVerificado = puedeVerificarse(bom);

  async function guardar(e) {
    e && e.preventDefault && e.preventDefault();
    if (!v.ok) return;
    setEstado({ cargando: true, ok: null, error: '' });
    try {
      // Control optimista: para sustituir una clave existente, manda la versión que viste (no se pisa a ciegas).
      let p_version_anterior = null;
      if (sustituir && typeof leerVersion === 'function') {
        try { p_version_anterior = await leerVersion(bom.clave); } catch { p_version_anterior = null; }
      }
      const { data, error } = await rpc('guardar_producto_maestro', {
        p_clave: bom.clave, p_nombre: bom.nombre, p_lineas: bom.lineas,
        p_factor_mo: bom.factor_mo, p_factor_gif: bom.factor_gif,
        p_material_real: bom.material_real,
        p_cos_fab_calculado: bom.cos_fab_calculado,
        p_cos_fab_real: bom.cos_fab_real,       // null salvo referencia de fábrica medida
        p_dims_mm: bom.dims_mm, p_tipo_bom: bom.tipo_bom, p_fuente: bom.fuente,
        p_version_anterior,
        p_sustituir: sustituir,
        p_sustituir_verificado: sustituir,      // Dirección confirma también sobre un VERIFICADO
      });
      if (error) { setEstado({ cargando: false, ok: false, error: error.message || 'No se pudo guardar.' }); return; }
      setEstado({ cargando: false, ok: true, error: '' });
      onGuardado && onGuardado(bom.clave, data);
    } catch (err) {
      setEstado({ cargando: false, ok: false, error: (err && err.message) || 'Error de red al guardar.' });
    }
  }

  const nPend = bom.pendientes ? bom.pendientes.length : 0;

  return (
    <form className="tarjeta" data-testid="guardar-producto-maestro" onSubmit={guardar} style={{ marginTop: 12, borderLeft: '4px solid #2e6f4e' }}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>Confirmar despiece → guardar como Producto Maestro</div>
      <div className="ayuda" style={{ marginBottom: 8 }}>
        Guarda este despiece como clave de catálogo. Por omisión se guarda como <b>BORRADOR</b>;
        marcar “verificado” (certificable) sólo se permite si no quedan pendientes. Sólo Dirección.
        {bom.integridad ? ` ${bom.integridad.costeables} línea(s) costeable(s)` : ''} ·
        material {pesos(bom.material_real)}{bom.cos_fab_calculado != null ? ` · fabricación calculada ${pesos(bom.cos_fab_calculado)}` : ''}.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave (p.ej. VITRINA-NUEVA-01)"
          data-testid="gpm-clave" style={{ flex: '1 1 220px', textTransform: 'uppercase' }} />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del mueble"
          data-testid="gpm-nombre" style={{ flex: '1 1 220px' }} />
        <button type="submit" disabled={!v.ok || estado.cargando} data-testid="gpm-guardar">
          {estado.cargando ? 'Guardando…' : (verificar ? 'Guardar verificado' : 'Guardar borrador')}
        </button>
      </div>

      <label className="ayuda" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, opacity: elegibleVerificado ? 1 : 0.55 }} data-testid="gpm-verificar">
        <input type="checkbox" checked={verificar} disabled={!elegibleVerificado}
          onChange={(e) => setVerificar(e.target.checked)} />
        Marcar como <b>VERIFICADO</b> (certificable){!elegibleVerificado && bom.no_verificable_por ? ` — no se puede: ${bom.no_verificable_por.join('; ')}` : ''}
      </label>
      <label className="ayuda" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }} data-testid="gpm-sustituir">
        <input type="checkbox" checked={sustituir} onChange={(e) => setSustituir(e.target.checked)} />
        Sustituir si la clave ya existe (confirmación explícita; no se pisa en silencio)
      </label>

      {nPend > 0 && (
        <details style={{ marginTop: 8 }} data-testid="gpm-pendientes">
          <summary className="ayuda" style={{ cursor: 'pointer', color: '#b45309' }}>
            ⚠ {nPend} pieza(s) pendiente(s) — se guardan como PENDIENTE y NO certifican
          </summary>
          <ul className="ayuda" style={{ margin: '6px 0 0 16px' }}>
            {bom.pendientes.slice(0, 40).map((p, i) => <li key={i}>{p.desc} — {p.motivo}</li>)}
          </ul>
        </details>
      )}
      {!v.ok && v.errores.length > 0 && (
        <div className="ayuda" style={{ marginTop: 6 }} data-testid="gpm-faltan">Falta: {v.errores.join(' ')}</div>
      )}
      {estado.ok === true && (
        <div className="ayuda" style={{ marginTop: 8 }} data-testid="gpm-ok">
          <strong>✓ Guardado{verificar ? ' (verificado)' : ' (borrador)'}.</strong> La clave <b>{bom.clave}</b> ya se puede costear por material en “Costear por clave”.
        </div>
      )}
      {estado.ok === false && (
        <div className="alerta roja" style={{ marginTop: 8 }} data-testid="gpm-error"><span className="texto">✕ {estado.error}</span></div>
      )}
    </form>
  );
}
