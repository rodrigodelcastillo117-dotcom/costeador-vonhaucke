// ============================================================================
//  N9 — PRODUCTO MAESTRO (UX) — IMPLEMENTED_PENDING_VISUAL_SMOKE.
//  Catálogo comercial client-safe: busca/filtra los 1931 productos y muestra su
//  PRECIO AUTORIZADO (precio de lista vigente). `productos` no tiene columnas de
//  costo; `lista_precio_items.precio_lista` es precio de VENTA (lo puede ver el
//  vendedor). Estados loading/empty/error. No deriva precio de costos.
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import { nube } from '../../nube.js';
import { pesos } from '../../util.js';

const dinero = (n) => (n == null || isNaN(n) || !isFinite(n) ? '—' : pesos(n));
const TIPOS = [{ id: '', n: 'Todos' }, { id: 'linea', n: 'Línea' }, { id: 'banco', n: 'Banco' }, { id: 'expediente', n: 'Expediente' }];

export default function ProductoMaestro({ soloVentas = false, veCostos = false }) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('cargando');
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    try {
      let query = nube.from('productos').select('id,nombre,codigo,source_type,familia,estado,activo').limit(60);
      if (tipo) query = query.eq('source_type', tipo);
      const term = q.trim();
      if (term) query = query.or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%`);
      const { data: prods, error } = await query;
      if (error) { setEstado('error'); return; }
      const ids = (prods || []).map((p) => p.id);
      const precios = {};
      if (ids.length) {
        const { data: lpis } = await nube.from('lista_precio_items')
          .select('producto_id,precio_lista,moneda,vigencia_desde,vigencia_hasta,lista_precio_id')
          .in('producto_id', ids).is('vigencia_hasta', null);
        for (const it of (lpis || [])) precios[it.producto_id] = it;
      }
      setItems((prods || []).map((p) => ({ ...p, precioItem: precios[p.id] || null })));
      setEstado('ok');
    } catch (_e) { setEstado('error'); }
  }, [q, tipo]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Catálogo — Producto Maestro</h3>
      <input className="campo" type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Busca por nombre o código…" style={{ minHeight: 44, marginBottom: 8 }} />
      <div className="chips" style={{ marginBottom: 12 }}>
        {TIPOS.map((t) => <button key={t.id} className={`chip ${tipo === t.id ? 'on' : ''}`} onClick={() => setTipo(t.id)}>{t.n}</button>)}
      </div>

      {estado === 'cargando' && <div className="tarjeta"><span className="ayuda">Buscando…</span></div>}
      {estado === 'error' && <div className="alerta roja"><span className="texto">No se pudo cargar el catálogo.</span> <button className="boton" onClick={cargar}>Reintentar</button></div>}
      {estado === 'ok' && items.length === 0 && <div className="tarjeta"><strong>Sin resultados</strong><p className="ayuda">Prueba con otra palabra o cambia el filtro.</p></div>}

      {estado === 'ok' && items.map((p) => (
        <div className="tarjeta" key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <strong>{p.nombre || p.codigo || `#${p.id}`}</strong>
            <div className="ayuda">{p.source_type} · {p.codigo || 's/código'} · {p.familia || '—'} {p.activo === false ? '· INACTIVO' : ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="dinero">{p.precioItem ? dinero(p.precioItem.precio_lista) : 'sin precio'}</div>
            {!p.precioItem && <div className="ayuda" style={{ fontSize: 11, color: '#9a6a00' }}>no cotizable</div>}
          </div>
          <button className="boton" onClick={() => setSel(p)}>Ver ›</button>
        </div>
      ))}

      {sel && (
        <div className="tarjeta" style={{ position: 'sticky', bottom: 0, borderTop: '2px solid var(--acento,#333)' }}>
          <div className="fila" style={{ justifyContent: 'space-between' }}>
            <strong>{sel.nombre || sel.codigo}</strong>
            <button className="boton fantasma" onClick={() => setSel(null)}>Cerrar ✕</button>
          </div>
          <div className="ayuda">Código: {sel.codigo || '—'} · Fuente: {sel.source_type} · Estado: {sel.estado || '—'} · {sel.activo === false ? 'INACTIVO' : 'activo'}</div>
          <div className="ayuda">Precio autorizado: <strong>{sel.precioItem ? dinero(sel.precioItem.precio_lista) : '—'}</strong>
            {sel.precioItem && <> · vigente desde {sel.precioItem.vigencia_desde || '—'} · {sel.precioItem.moneda || 'MXN'}</>}</div>
          {!sel.precioItem && <div className="alerta ambar" style={{ marginTop: 6 }}><span className="texto">Este producto no tiene precio de lista vigente: no es cotizable hasta publicarlo.</span></div>}
          {veCostos && sel.source_type === 'expediente' && (
            <p className="ayuda gris" style={{ fontSize: 11, marginTop: 6 }}>Publicar desde expediente: disponible para Diseño/Dirección cuando el expediente esté aprobado y completo.</p>
          )}
        </div>
      )}
    </div>
  );
}
