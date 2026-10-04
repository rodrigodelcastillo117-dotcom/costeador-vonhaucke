// ============================================================================
//  LO QUE VONI SABE  ·  las reglas de oficio de Von Haucke, a la vista.
//
//  Rodrigo: "crea un sistema para que VONI APRENDA con cada uno de los planos o
//  cosas que subamos... que recuerde, guarde en backend, y en caso de
//  necesitarlo lo recuerde y use. Esto es para todo."
//
//  Aquí se ve TODO lo que Voni da por sabido, se corrige y se agrega. Las que
//  traen clave y valor las aplica el motor solo (los 90 cm de circulación son
//  los mismos 90 cm que usa el acomodo); las demás viajan en los prompts.
//  Las que dicen "propuesta" las escribí yo y esperan tu visto bueno: mientras
//  tanto ya se usan, pero se ven distintas para que puedas revisarlas.
// ============================================================================
import { useEffect, useState } from 'react';
import { todasLasReglas, cargarReglas, guardarRegla, borrarRegla, REGLAS_DEFAULT } from '../datos/reglas.js';
import { cargarAprendizajes, aprendizajes as leerAprendizajes, olvidar, marcarComoRegla } from '../datos/aprendizaje.js';

const AMBITOS = {
  acomodo: 'Acomodo en el espacio',
  cotizacion: 'Qué se cotiza',
  precio: 'Precios y márgenes',
  plano: 'Lectura de planos',
  render: 'Imágenes y renders',
  general: 'General',
};

const vacia = () => ({ ambito: 'acomodo', texto: '', clave: '', valor: '', unidad: '', origen: 'rodrigo' });

export default function Reglas({ puedeEditar = false }) {
  const [reglas, setReglas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [nueva, setNueva] = useState(null);
  const [editando, setEditando] = useState(null);
  const [aprendido, setAprendido] = useState([]);

  async function refrescar() {
    setCargando(true);
    await cargarReglas();
    setReglas(todasLasReglas());
    await cargarAprendizajes();
    setAprendido(leerAprendizajes());
    setCargando(false);
  }
  useEffect(() => { refrescar(); }, []);

  async function guardar(r) {
    setError('');
    if (!r.texto?.trim()) { setError('Escribe la regla con tus palabras.'); return; }
    try {
      await guardarRegla(r);
      if (r._deAprendizaje) await marcarComoRegla(r._deAprendizaje, r.clave || r.texto.slice(0, 40));
      setNueva(null); setEditando(null); await refrescar();
    }
    catch (e) { setError('No se pudo guardar: ' + (e?.message || e)); }
  }
  async function borrar(id) {
    setError('');
    try { await borrarRegla(id); await refrescar(); }
    catch (e) { setError('No se pudo borrar: ' + (e?.message || e)); }
  }

  const porAmbito = Object.keys(AMBITOS)
    .map((a) => [a, reglas.filter((r) => r.ambito === a)])
    .filter(([, rs]) => rs.length);

  return (
    <div className="contenido">
      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Lo que Voni sabe</h2>
        <p className="ayuda columna-texto">
          Las reglas de oficio de Vonhaucke. Voni y el motor las aplican solos: las que tienen un
          número lo usan al acomodar y al costear, y las demás se le explican con palabras.
          Lo que dictes aquí queda guardado y se usa en todos los proyectos, no sólo en éste.
        </p>
        {!puedeEditar && <p className="ayuda">Las puedes leer; agregarlas o cambiarlas es de Diseño y Dirección.</p>}
        {error && <div className="alerta roja"><span className="texto">{error}</span></div>}
        {cargando && <p className="gris">Cargando…</p>}
        {!cargando && !reglas.length && (
          <p className="ayuda">Todavía no hay reglas guardadas. El motor está usando sus valores por omisión
            ({Object.keys(REGLAS_DEFAULT).length} números).</p>
        )}

        {puedeEditar && !nueva && (
          <button className="boton primario" style={{ minHeight: 44 }} onClick={() => setNueva(vacia())}>
            + Enseñarle una regla
          </button>
        )}
        {/* LO QUE VONI APRENDIÓ SOLA. Distinto de una regla: una regla la dicta la
            Dirección y no caduca; una lección la produce un vendedor al corregir a
            Voni en un proyecto y se puede quitar de un clic si salió mala. Se
            muestran aquí para que nada de lo que Voni "sabe" sea invisible. */}
        {!cargando && aprendido.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <h3 style={{ marginBottom: 4 }}>Lo que ha aprendido sola</h3>
            <p className="ayuda columna-texto">
              Cada vez que alguien le aclara algo, Voni lo guarda y lo toma en cuenta en el siguiente
              pedido, sin que nadie tenga que aprobarlo. Si una lección salió mal, quítasela.
              Si es de las que valen para siempre, conviértela en regla.
            </p>
            <ul className="lista-reglas" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
              {aprendido.map((a) => (
                <li key={a.id} className="tarjeta" style={{ padding: 12, display: 'grid', gap: 6 }}>
                  <div>{a.texto}</div>
                  <div className="ayuda">
                    {new Date(a.creado).toLocaleDateString('es-MX')}
                    {(a.veces || 1) > 1 && <> · <strong>corregida {a.veces} veces</strong></>}
                    {a.regla_clave && <> · ya es regla</>}
                  </div>
                  {puedeEditar && (
                    <div className="fila-botones" style={{ gap: 8 }}>
                      <button className="boton fantasma" style={{ minHeight: 40 }}
                        onClick={() => setNueva({ ...vacia(), texto: a.texto, ambito: 'cotizacion', _deAprendizaje: a.id })}>
                        Convertirla en regla
                      </button>
                      <button className="boton fantasma" style={{ minHeight: 40 }}
                        onClick={async () => { if (confirm('¿Que Voni olvide esta lección?')) { await olvidar(a.id); setAprendido(leerAprendizajes()); } }}>
                        Que la olvide
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {nueva && <Editor r={nueva} setR={setNueva} onGuardar={() => guardar(nueva)} onCancelar={() => setNueva(null)} />}
      </div>

      {porAmbito.map(([a, rs]) => (
        <div className="tarjeta" key={a}>
          <h3 style={{ marginTop: 0 }}>{AMBITOS[a]}</h3>
          {rs.map((r) => (
            editando === r.id
              ? <Editor key={r.id} r={r} setR={(x) => setReglas((all) => all.map((y) => (y.id === r.id ? x : y)))}
                  onGuardar={() => guardar(reglas.find((y) => y.id === r.id))} onCancelar={() => { setEditando(null); refrescar(); }} />
              : (
                <div key={r.id} className="fila-regla" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid #efece6' }}>
                  <div style={{ flex: 1 }}>
                    <div>{r.texto}</div>
                    <div className="ayuda gris">
                      {r.clave && <>el motor lo aplica como <strong className="mono">{r.clave} = {r.valor}{r.unidad ? ' ' + r.unidad : ''}</strong> · </>}
                      {r.origen === 'propuesta'
                        ? <em>propuesta mía, falta tu visto bueno</em>
                        : r.origen === 'aprendida' ? <em>aprendida de un proyecto</em> : 'la dictaste tú'}
                      {r.fuente ? ` · ${r.fuente}` : ''}
                    </div>
                  </div>
                  {puedeEditar && (
                    <div className="fila-botones" style={{ gap: 6 }}>
                      <button className="boton fantasma" style={{ minHeight: 38, padding: '0 12px' }} onClick={() => setEditando(r.id)}>Cambiar</button>
                      <button className="boton fantasma" style={{ minHeight: 38, padding: '0 12px' }} onClick={() => borrar(r.id)}>Quitar</button>
                    </div>
                  )}
                </div>
              )
          ))}
        </div>
      ))}
    </div>
  );
}

function Editor({ r, setR, onGuardar, onCancelar }) {
  const set = (k, v) => setR({ ...r, [k]: v });
  return (
    <div className="tarjeta nota-clara" style={{ background: '#fbf9f5', marginTop: 10 }}>
      <label className="etiqueta">La regla, con tus palabras</label>
      <textarea className="campo" rows={2} value={r.texto} onChange={(e) => set('texto', e.target.value)}
        placeholder="Ej.: en los privados siempre van 2 sillas de visita de 4 patas." />
      <div className="fila-campos" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div>
          <label className="etiqueta">¿De qué es?</label>
          <select className="campo" value={r.ambito} onChange={(e) => set('ambito', e.target.value)}>
            {Object.entries(AMBITOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta">Nombre del número (opcional)</label>
          <input className="campo" value={r.clave || ''} onChange={(e) => set('clave', e.target.value)} placeholder="circulacion_min" />
        </div>
        <div>
          <label className="etiqueta">Valor</label>
          <input className="campo" type="number" value={r.valor ?? ''} onChange={(e) => set('valor', e.target.value)} placeholder="900" />
        </div>
        <div>
          <label className="etiqueta">Unidad</label>
          <input className="campo" value={r.unidad || ''} onChange={(e) => set('unidad', e.target.value)} placeholder="mm" />
        </div>
      </div>
      <p className="ayuda">Si le pones nombre y valor, el motor lo aplica solo. Si no, se le explica a Voni con palabras.</p>
      <div className="fila-botones" style={{ gap: 8 }}>
        <button className="boton primario" style={{ minHeight: 42 }} onClick={onGuardar}>Guardar</button>
        <button className="boton fantasma" style={{ minHeight: 42 }} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
