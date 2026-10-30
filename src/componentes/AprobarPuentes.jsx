import { useEffect, useState, useCallback } from 'react';
import { puentesPropuestos, aprobarPuente } from '../nube.js';

// B2 · Pantalla de Dirección para aprobar los puentes clave-externa → insumo (insumo_mapeos_externos
// en estado 'propuesto'). La aprobación la firma el HUMANO autenticado: la RPC `aprobar_mapeo_externo`
// exige `puede_certificar_costo()` (excluye cuentas no-humanas) y graba approved_by = su correo. El bot
// NO puede aprobar. Esta pantalla sólo la ve Dirección (App.jsx la monta tras esDireccion).
export default function AprobarPuentes() {
  const [filas, setFilas] = useState(null);     // null = cargando
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');
  const [enCurso, setEnCurso] = useState(new Set());
  const [aprobados, setAprobados] = useState(0);

  const cargar = useCallback(async () => {
    setError(''); setFilas(null);
    const r = await puentesPropuestos();
    if (!r.ok) { setError(r.error); setFilas([]); return; }
    setFilas(r.filas);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aprobar = async (id) => {
    setEnCurso((s) => new Set(s).add(id));
    setError('');
    const r = await aprobarPuente(id, nota.trim() || null);
    setEnCurso((s) => { const n = new Set(s); n.delete(id); return n; });
    if (!r.ok) { setError(`No se pudo aprobar #${id}: ${r.error}`); return; }
    setFilas((fs) => (fs || []).filter((f) => f.id !== id));
    setAprobados((n) => n + 1);
  };

  if (filas === null) return <div className="contenido"><p>Cargando puentes…</p></div>;

  return (
    <div className="contenido">
      <h2>Aprobar puentes clave → insumo</h2>
      <p style={{ color: '#555', maxWidth: 680 }}>
        Cada puente conecta una <b>clave externa (Intelisis)</b> con un <b>insumo del catálogo</b>. Al aprobarlo,
        los materiales de ese documento quedan con precio real conectado para costear. La aprobación la firma
        <b> tu cuenta</b> (queda registrada con tu correo); no la puede hacer una cuenta de pruebas.
      </p>
      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
      <div style={{ margin: '8px 0' }}>
        <label>Nota (opcional, aplica a lo que apruebes): </label>
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} style={{ width: 320 }} placeholder="p. ej. revisado contra ficha HDM" />
      </div>
      <p><b>{filas.length}</b> puente(s) por aprobar{aprobados > 0 ? ` · ${aprobados} aprobado(s) en esta sesión` : ''}.</p>
      {filas.length === 0
        ? <p>No hay puentes pendientes. ✅</p>
        : (
          <table className="tabla" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Clave</th><th>Opción</th><th>Insumo</th><th>Identidad</th><th>Confianza</th><th>Documento</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid #eee' }}>
                  <td>{f.external_key}</td>
                  <td>{f.external_option || '—'}</td>
                  <td>{f.insumo_id}</td>
                  <td>{f.identity_status || '—'}</td>
                  <td>{f.confidence || '—'}</td>
                  <td title={f.source_record_id || ''}>{f.source_document || '—'}</td>
                  <td>
                    <button onClick={() => aprobar(f.id)} disabled={enCurso.has(f.id)}>
                      {enCurso.has(f.id) ? 'Aprobando…' : 'Aprobar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
