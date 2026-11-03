import { useEffect, useState, useCallback } from 'react';
import {
  referenciasDeProducto, subirReferenciaProducto, borrarReferenciaProducto,
  acabadosReferencia, guardarAcabadoReferencia,
} from '../nube.js';

// Biblioteca de referencia para renders fieles (sólo Dirección/Diseño; App.jsx la monta tras esDireccion).
// Dos secciones: (1) fotos reales de muebles por producto → generar-render.imagenes[]; (2) acabados/cubiertas
// reales (swatch + hex + insumo) → finishes del render. La escritura la bloquea la RLS si el rol no corresponde.
const VISTAS = ['frente', 'tres_cuartos', 'lateral', 'superior', 'detalle', 'otro'];
const CATS = ['madera', 'laminado', 'melamina', 'cuarzo', 'solido', 'metal', 'vidrio', 'tela', 'piedra', 'otro'];

export default function BibliotecaReferencias() {
  // ── Fotos de producto ──
  const [productoId, setProductoId] = useState('');
  const [fotos, setFotos] = useState(null);
  const [vista, setVista] = useState('tres_cuartos');
  const [subiendo, setSubiendo] = useState(false);
  const [errF, setErrF] = useState('');

  const cargarFotos = useCallback(async (pid) => {
    setErrF(''); setFotos(null);
    const r = await referenciasDeProducto(Number(pid));
    if (!r.ok) { setErrF(r.error); setFotos([]); return; }
    setFotos(r.filas);
  }, []);

  const onBuscar = (e) => { e.preventDefault(); if (Number(productoId) > 0) cargarFotos(productoId); };

  const onSubirFoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !(Number(productoId) > 0)) return;
    setSubiendo(true); setErrF('');
    const r = await subirReferenciaProducto(Number(productoId), file, { vista });
    setSubiendo(false);
    if (!r.ok) { setErrF(r.error); return; }
    cargarFotos(productoId);
  };

  const onBorrarFoto = async (id) => {
    const r = await borrarReferenciaProducto(id);
    if (!r.ok) { setErrF(r.error); return; }
    setFotos((fs) => (fs || []).filter((f) => f.id !== id));
  };

  // ── Acabados ──
  const [acabados, setAcabados] = useState(null);
  const [errA, setErrA] = useState('');
  const [nuevo, setNuevo] = useState({ clave: '', nombre: '', categoria: 'madera', hex: '', insumoClave: '' });
  const [guardando, setGuardando] = useState(false);
  const [swatch, setSwatch] = useState(null);

  const cargarAcabados = useCallback(async () => {
    setErrA(''); setAcabados(null);
    const r = await acabadosReferencia();
    if (!r.ok) { setErrA(r.error); setAcabados([]); return; }
    setAcabados(r.filas);
  }, []);

  useEffect(() => { cargarAcabados(); }, [cargarAcabados]);

  const onGuardarAcabado = async (e) => {
    e.preventDefault();
    if (!nuevo.clave.trim() || !nuevo.nombre.trim()) { setErrA('clave y nombre requeridos'); return; }
    setGuardando(true); setErrA('');
    const r = await guardarAcabadoReferencia({ ...nuevo, file: swatch });
    setGuardando(false);
    if (!r.ok) { setErrA(r.error); return; }
    setNuevo({ clave: '', nombre: '', categoria: 'madera', hex: '', insumoClave: '' }); setSwatch(null);
    cargarAcabados();
  };

  return (
    <div className="contenido">
      <h2>Biblioteca de referencia para renders</h2>
      <p style={{ color: '#555', maxWidth: 720 }}>
        Fotos reales de tus muebles y acabados para que el render reproduzca el producto y el material REALES
        (en vez de inventarlos desde texto). Lo que subas aquí lo usa <b>generar-render</b> como referencia.
        Sólo Dirección/Diseño puede editar; el vendedor sólo lo ve.
      </p>

      <h3 style={{ marginTop: 18 }}>1 · Fotos de muebles por producto</h3>
      <form onSubmit={onBuscar} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>Producto ID:&nbsp;
          <input type="number" min="1" value={productoId} onChange={(e) => setProductoId(e.target.value)} style={{ width: 120 }} />
        </label>
        <button type="submit">Ver fotos</button>
        {Number(productoId) > 0 && (
          <>
            <label>Vista:&nbsp;
              <select value={vista} onChange={(e) => setVista(e.target.value)}>
                {VISTAS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="boton-archivo" style={{ cursor: 'pointer' }}>
              {subiendo ? 'Subiendo…' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={onSubirFoto} disabled={subiendo} style={{ display: 'none' }} />
            </label>
          </>
        )}
      </form>
      {errF && <p role="alert" style={{ color: '#b00020' }}>{errF}</p>}
      {fotos !== null && (
        fotos.length === 0
          ? <p>Sin fotos para este producto. Sube la primera.</p>
          : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {fotos.map((f) => (
                <figure key={f.id} style={{ margin: 0, width: 160 }}>
                  {f.url ? <img src={f.url} alt={f.vista} style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
                        : <div style={{ width: 160, height: 120, background: '#f3f3f3', borderRadius: 6 }} />}
                  <figcaption style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span>{f.vista}</span>
                    <button type="button" onClick={() => onBorrarFoto(f.id)} style={{ color: '#b00020' }}>quitar</button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )
      )}

      <h3 style={{ marginTop: 24 }}>2 · Acabados y cubiertas</h3>
      <form onSubmit={onGuardarAcabado} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="clave (ej. nogal)" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} style={{ width: 130 }} />
        <input placeholder="nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} style={{ width: 160 }} />
        <select value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="#hex" value={nuevo.hex} onChange={(e) => setNuevo({ ...nuevo, hex: e.target.value })} style={{ width: 90 }} />
        <input placeholder="insumo (opcional)" value={nuevo.insumoClave} onChange={(e) => setNuevo({ ...nuevo, insumoClave: e.target.value })} style={{ width: 140 }} />
        <label className="boton-archivo" style={{ cursor: 'pointer' }} title="swatch opcional">
          {swatch ? '✓ swatch' : 'swatch…'}
          <input type="file" accept="image/*" onChange={(e) => setSwatch(e.target.files?.[0] || null)} style={{ display: 'none' }} />
        </label>
        <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Agregar / actualizar'}</button>
      </form>
      {errA && <p role="alert" style={{ color: '#b00020' }}>{errA}</p>}
      {acabados === null ? <p>Cargando acabados…</p> : (
        acabados.length === 0 ? <p>Sin acabados aún.</p> : (
          <table className="tabla" style={{ marginTop: 8 }}>
            <thead><tr><th>Swatch</th><th>Clave</th><th>Nombre</th><th>Categoría</th><th>Hex</th><th>Insumo</th></tr></thead>
            <tbody>
              {acabados.map((a) => (
                <tr key={a.id}>
                  <td>{a.url ? <img src={a.url} alt={a.clave} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                        : <span style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 4, background: a.hex || '#eee', border: '1px solid #ccc' }} />}</td>
                  <td>{a.clave}</td><td>{a.nombre}</td><td>{a.categoria}</td><td>{a.hex || '—'}</td><td>{a.insumo_clave || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
