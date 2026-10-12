// ============================================================================
//  BUSCADOR DE INSUMO (VH-088) · busca en TODO el catálogo activo (curado + ERP Intelisis,
//  ~11k registros) y deja ELEGIR a mano un material para una pieza. La elección humana viaja
//  como confirmación (USER_CONFIRMED) igual que el selector. Nunca inventa precio: si el insumo
//  no tiene precio vigente, el motor lo deja pendiente.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { buscarInsumosMotor } from '../nube.js';
import { pesos2 } from '../util.js';

export default function BuscadorInsumo({ onElegir, placeholder = 'Buscar en todo el catálogo (ERP)…' }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [estado, setEstado] = useState('');   // '' | 'buscando' | 'error' | 'vacio'
  const [abierto, setAbierto] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const txt = q.trim();
    if (timer.current) clearTimeout(timer.current);
    if (txt.length < 2) { setRes([]); setEstado(''); return undefined; }
    setEstado('buscando');
    timer.current = setTimeout(() => {
      buscarInsumosMotor(txt, 30)
        .then((lista) => { setRes(lista); setEstado(lista.length ? '' : 'vacio'); })
        .catch(() => { setRes([]); setEstado('error'); });
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  if (!abierto) {
    return <button type="button" className="chip" data-testid="buscar-insumo-abrir" onClick={() => setAbierto(true)}>🔎 Buscar en todo el catálogo</button>;
  }
  return (
    <div className="buscador-insumo" data-testid="buscador-insumo" style={{ margin: '6px 0' }}>
      <input type="search" value={q} autoFocus placeholder={placeholder} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
      {estado === 'buscando' && <div className="ayuda">Buscando…</div>}
      {estado === 'error' && <div className="ayuda ambar">No se pudo consultar el catálogo central. Intenta de nuevo.</div>}
      {estado === 'vacio' && <div className="ayuda">Sin coincidencias para «{q.trim()}».</div>}
      {res.length > 0 && (
        <ul className="buscador-insumo-lista" style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--borde,#ddd)', borderRadius: 8 }}>
          {res.map((ins) => {
            const sinPrecio = ins.precio == null;
            const ev = ins.evidencia || {};
            return (
              <li key={ins.id} style={{ padding: '6px 10px', borderBottom: '1px solid var(--borde,#eee)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>
                  <strong>{ins.nombre}</strong>
                  <span className="gris"> · {ins.unidad}{ins.clasificacion === 'erp' ? ' · ERP' : ''}</span>
                  <div className="ayuda" style={{ margin: 0 }}>
                    {sinPrecio ? 'Sin precio vigente (quedará pendiente)' : `${pesos2(ins.precio)} / ${ins.unidad}`}
                    {ev.estado ? ` · ${ev.certificable ? 'certificado' : ev.estado}` : ''}
                    {ins.actualizado ? ` · ${ins.actualizado}` : ''}
                  </div>
                </span>
                <button type="button" className="chip" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => { onElegir(ins); setAbierto(false); setQ(''); setRes([]); }}>Usar</button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="chip" style={{ marginTop: 4 }} onClick={() => { setAbierto(false); setQ(''); setRes([]); }}>Cerrar</button>
    </div>
  );
}
