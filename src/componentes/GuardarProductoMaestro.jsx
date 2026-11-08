// LOOP DE APRENDIZAJE (A): botón "Confirmar despiece → guardar como Producto Maestro".
// Toma el despiece YA confirmado por la persona (detalleInsumos del motor) y lo guarda con la RPC
// gobernada guardar_producto_maestro (sólo Dirección; la puerta la hace el backend). A partir de
// ahí esa clave cuesta por material y es certificable al reabrirse en "Costear por clave".
//
// Integración: montar dentro del flujo COSTEAR (Costeador.jsx) una vez que el costeo está confirmado,
// pasando: detalleInsumos = resultado.detalleInsumos, insumos, factorMo/factorGif de la clave (o la
// política por sección), nombreSugerido = costeo.nombre. Seller-safe: lo usa Dirección; el motor ya
// calculó todo. `rpc` es inyectable para pruebas (default: nube.rpc).
import React, { useMemo, useState } from 'react';
import { nube } from '../nube.js';
import { bomDesdeDespiece, listoParaGuardar } from '../datos/productoMaestroDesdeDespiece.js';

const pesos = (x) => (x == null || !Number.isFinite(Number(x))) ? '—' : '$' + Number(x).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GuardarProductoMaestro({ detalleInsumos = [], insumos = {}, factorMo, factorGif, nombreSugerido = '', dims_mm = null, rpc = (n, p) => nube.rpc(n, p), onGuardado }) {
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState(nombreSugerido || '');
  const [estado, setEstado] = useState({ cargando: false, ok: null, error: '' });

  const bom = useMemo(
    () => bomDesdeDespiece(detalleInsumos, insumos, { clave, nombre, factorMo, factorGif, dims_mm, fuente: 'Confirmado en COSTEAR' }),
    [detalleInsumos, insumos, clave, nombre, factorMo, factorGif, dims_mm]
  );
  const v = listoParaGuardar(bom);

  async function guardar(e) {
    e && e.preventDefault && e.preventDefault();
    if (!v.ok) return;
    setEstado({ cargando: true, ok: null, error: '' });
    try {
      const { data, error } = await rpc('guardar_producto_maestro', {
        p_clave: bom.clave, p_nombre: bom.nombre, p_lineas: bom.lineas,
        p_factor_mo: bom.factor_mo, p_factor_gif: bom.factor_gif,
        p_material_real: bom.material_real, p_cos_fab_real: bom.cos_fab_real,
        p_dims_mm: bom.dims_mm, p_tipo_bom: bom.tipo_bom, p_fuente: bom.fuente,
      });
      if (error) { setEstado({ cargando: false, ok: false, error: error.message || 'No se pudo guardar.' }); return; }
      setEstado({ cargando: false, ok: true, error: '' });
      onGuardado && onGuardado(bom.clave, data);
    } catch (err) {
      setEstado({ cargando: false, ok: false, error: (err && err.message) || 'Error de red al guardar.' });
    }
  }

  return (
    <form className="tarjeta" data-testid="guardar-producto-maestro" onSubmit={guardar} style={{ marginTop: 12, borderLeft: '4px solid #2e6f4e' }}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>Confirmar despiece → guardar como Producto Maestro</div>
      <div className="ayuda" style={{ marginBottom: 8 }}>
        Guarda este despiece confirmado como clave de catálogo. Desde entonces se cuesta por material con
        precios vigentes (certificable). Sólo Dirección. {bom.lineas.length} línea(s) costeable(s) ·
        material {pesos(bom.material_real)}{bom.cos_fab_real != null ? ` · fabricación ${pesos(bom.cos_fab_real)}` : ''}.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave (p.ej. VITRINA-NUEVA-01)"
          data-testid="gpm-clave" style={{ flex: '1 1 220px', textTransform: 'uppercase' }} />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del mueble"
          data-testid="gpm-nombre" style={{ flex: '1 1 220px' }} />
        <button type="submit" disabled={!v.ok || estado.cargando} data-testid="gpm-guardar">
          {estado.cargando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {v.aviso && <div className="alerta ambar" style={{ marginTop: 8 }} data-testid="gpm-aviso"><span className="texto">⚠ {v.aviso}</span></div>}
      {!v.ok && v.errores.length > 0 && (
        <div className="ayuda" style={{ marginTop: 6 }} data-testid="gpm-faltan">Falta: {v.errores.join(' ')}</div>
      )}
      {estado.ok === true && (
        <div className="ayuda" style={{ marginTop: 8 }} data-testid="gpm-ok">
          <strong>✓ Guardado.</strong> La clave <b>{bom.clave}</b> ya se puede costear por material en “Costear por clave”.
        </div>
      )}
      {estado.ok === false && (
        <div className="alerta roja" style={{ marginTop: 8 }} data-testid="gpm-error"><span className="texto">✕ {estado.error}</span></div>
      )}
    </form>
  );
}
