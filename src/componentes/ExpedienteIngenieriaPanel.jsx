// ============================================================================
//  PANEL: Expediente de Ingenieria DESDE el despiece vivo de VONI (P1, ultima milla).
//
//  Toma el despiece RICO del Asistente (b.componentes: nombre, insumoId, cantidad,
//  largoMM, anchoMM) + el catalogo ERP + el catalogo de lamina (catalogo_vigente) y
//  construye el EXPEDIENTE INDUSTRIAL con el puente (reusa costearProductoIndustrial).
//  Asi las piezas FABRICADAS se costean por desarrollo/anidado en vez de quedar todas
//  pendientes. Lo que no tiene geometria/lamina queda pendiente de CAD (no inventa).
//  Montaje aislado y colapsado: no toca el flujo de costeo existente.
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import PantallaIngenieria from './PantallaIngenieria.jsx';
import { expedienteIndustrialDesdeDespiece } from '../datos/expedienteIndustrialDesdeDespiece.js';
import { cargarLaminaDesdeSupabase } from '../datos/catalogoLaminaVigente.js';
import { nube } from '../nube.js';

export default function ExpedienteIngenieriaPanel({ componentes = [], insumos = {}, clave = null, nombre = null, svc = nube }) {
  const [lamina, setLamina] = useState([]);
  const [abierto, setAbierto] = useState(false);

  // Catalogo de lamina (catalogo_vigente) para costear las piezas fabricadas. Si no carga,
  // las fabricadas quedan pendientes (fail-closed, no inventa un precio de lamina).
  useEffect(() => {
    if (!abierto) return undefined;
    let vivo = true;
    cargarLaminaDesdeSupabase(svc).then((r) => { if (vivo) setLamina(r?.lamina || []); }).catch(() => { if (vivo) setLamina([]); });
    return () => { vivo = false; };
  }, [abierto, svc]);

  const expediente = useMemo(() => {
    const despiece = (Array.isArray(componentes) ? componentes : []).map((c) => {
      const sec = insumos?.[c.insumoId]?.seccion;
      return {
        clave: c.nombre || c.insumoId, insumoId: c.insumoId, desc: c.nombre || c.insumoId,
        cantidad: Number(c.cantidad ?? c.piezas ?? 1),
        seccion: sec, largoMM: c.largoMM, anchoMM: c.anchoMM,
        esCompraVenta: sec === 'graficos' || sec === 'iluminacion',
      };
    });
    return expedienteIndustrialDesdeDespiece(despiece, { clave: clave || 'EN-COSTEO', nombre, insumosERP: insumos, catalogoLamina: lamina });
  }, [componentes, insumos, lamina, clave, nombre]);

  const nFab = (expediente.inputs?.piezasBOM || []).filter((p) => p.fabricada).length;

  return (
    <details className="tarjeta" style={{ marginTop: 16 }} onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Expediente de Ingeniería (industrial) — {nFab} pieza(s) fabricada(s)
      </summary>
      <div style={{ marginTop: 12 }}>
        {/* Solo mostrar: sin acciones fabricadas. Las confirmaciones reales (CAD/precio/estandares)
            se hacen en la pantalla de Ingeniería de Dirección, gobernadas por el servidor. */}
        <PantallaIngenieria expediente={expediente} persistencia={{ getItem: () => null, setItem: () => {} }} />
      </div>
    </details>
  );
}
