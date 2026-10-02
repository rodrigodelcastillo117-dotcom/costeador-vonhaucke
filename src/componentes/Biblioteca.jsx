// ============================================================================
//  BIBLIOTECA DE EXPEDIENTES — productos ya costeados, a la mano del equipo de
//  Diseño. Busca por palabra clave (nombre o etiqueta), muestra miniatura del
//  render, y abre el expediente para ver/editar/duplicar/re-costear.
// ============================================================================
import { useEffect, useState } from 'react';
import { listarExpedientes, obtenerExpediente } from '../nube.js';
import { pesos } from '../util.js';
import Cargando from './Cargando.jsx';

export default function Biblioteca({ onAbrir, onNuevo, onInicio }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  async function recargar(term) {
    setCargando(true); setError('');
    const r = await listarExpedientes(term);
    if (!r.ok) setError(r.error || 'No se pudo leer la biblioteca.');
    setItems(r.items || []);
    setCargando(false);
  }
  useEffect(() => { recargar(''); }, []);

  async function abrir(id) {
    if (abriendo) return;
    setAbriendo(true);
    const r = await obtenerExpediente(id);
    setAbriendo(false);
    if (r.ok && r.expediente) onAbrir?.(r.expediente);
    else setError(r.error || 'No se pudo abrir el expediente.');
  }

  if (abriendo) return <div className="asistente"><Cargando titulo="Abriendo expediente…" /></div>;

  return (
    <div className="asistente">
      <button className="boton fantasma" onClick={onInicio} style={{ marginBottom: 14 }}>‹ Inicio</button>
      <div className="pregunta">Biblioteca de productos</div>
      <div className="pregunta-sub">Productos ya costeados, listos para reutilizar. Busca por nombre o palabra clave.</div>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <input type="text" value={q} placeholder="Buscar: Cabecera Soriana, Alpura, exhibidor…"
          onChange={(e) => { setQ(e.target.value); recargar(e.target.value); }} style={{ flex: 1, minWidth: 220 }} />
        {onNuevo && <button className="boton primario" onClick={onNuevo}>+ Nuevo producto</button>}
      </div>

      {error && <div className="alerta roja"><span className="texto">{error}</span></div>}
      {cargando ? (
        <Cargando titulo="Cargando biblioteca…" />
      ) : items.length === 0 ? (
        <p className="ayuda">{q ? 'Nada coincide con tu búsqueda.' : 'Aún no hay productos guardados. Costea uno y toca "Guardar en biblioteca".'}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {items.map((e) => (
            <button key={e.id} onClick={() => abrir(e.id)}
              style={{ textAlign: 'left', border: '1px solid var(--borde)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel)', cursor: 'pointer', padding: 0 }}>
              <div style={{ aspectRatio: '4/3', background: '#eee', display: 'grid', placeItems: 'center' }}>
                {e.render_aislado_url
                  ? <img src={e.render_aislado_url} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span className="ayuda">sin render</span>}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2, marginBottom: 4 }}>{e.nombre}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span className="chip" style={{ fontSize: 10, background: e.estado === 'aprobado' ? 'var(--ok,#1a7f37)' : '#8a6d00', color: '#fff' }}>{(e.estado || 'borrador').toUpperCase()}</span>
                  {(e.etiquetas || []).slice(0, 3).map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
                </div>
                {e.costo?.precio != null && <div className="ayuda">Lista: {pesos(e.costo.precio)} {e.costo.estado_costo === 'certificado' ? '· certificado' : '· preliminar'}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
