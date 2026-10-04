// ============================================================================
//  USUARIOS - solo Direccion. Da de alta y de baja a quien puede entrar.
// ============================================================================
import { useEffect, useState } from 'react';
import { listaPermitidos, adminUsuarios } from '../nube.js';

// Qué ve cada rol. Se enseña en pantalla porque mover a alguien de rol le ABRE
// o le CIERRA datos de verdad (nómina, financieros, costos), no es una etiqueta.
const ROLES = [
  { id: 'vendedor',  et: 'Ventas',    ve: 'Cotiza y propone. NO ve costos, ni margen, ni el Tablero.' },
  { id: 'diseno',    et: 'Diseño',    ve: 'Todo lo de Ventas + costos y despiece. NO ve nómina ni financieros.' },
  { id: 'direccion', et: 'Dirección', ve: 'Todo, incluida nómina, financieros y el Tablero del negocio.' },
];

export default function Usuarios({ onAviso, miCorreo = '' }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [rol, setRol] = useState('vendedor');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const [porBorrar, setPorBorrar] = useState(null);
  // Contraseña recién fijada, mostrada UNA sola vez para compartirla (no se guarda).
  const [recienCreado, setRecienCreado] = useState(null);

  async function recargar() {
    setCargando(true);
    setLista(await listaPermitidos());
    setCargando(false);
  }
  useEffect(() => { recargar(); }, []);

  async function agregar() {
    setError('');
    if (!email || !pass || pass.length < 6) { setError('Escribe el correo y una contraseña de al menos 6 letras.'); return; }
    setTrabajando(true);
    const correoAlta = email.trim().toLowerCase();
    const r = await adminUsuarios('crear', { email: correoAlta, password: pass, nombre, rol });
    setTrabajando(false);
    if (r.ok) {
      if (r.ya_existia) {
        // C3 (P0): el correo ya tenía cuenta. NO se cambió su contraseña. Se reactivó
        // su acceso; si no la recuerda, usa recuperación en el login.
        onAviso && onAviso('Esa persona ya tenía cuenta: reactivamos su acceso con el rol elegido. NO se cambió su contraseña — si no la recuerda, que use "¿Olvidaste tu contraseña?" en el login.');
      } else {
        onAviso && onAviso('Persona agregada. Ya puede entrar.');
        // La contraseña se muestra UNA vez aquí para compartirla ahora; NO se guarda
        // en ningún lado (P0-09). `password_una_vez` viene del edge; si no, usamos la
        // que se tecleó en este formulario (es la misma que se acaba de fijar).
        setRecienCreado({ nombre: nombre || correoAlta, email: correoAlta, pass: r.password_una_vez || pass });
      }
      setNombre(''); setEmail(''); setPass(''); setRol('vendedor');
      recargar();
    } else {
      setError('No se pudo agregar. ' + (r.error || ''));
    }
  }

  // CAMBIAR EL ROL sin dar de baja. Antes la única forma era borrar a la persona
  // y volverla a crear, lo que le tiraba su contraseña.
  const [cambiando, setCambiando] = useState('');
  async function cambiarRol(correo, nuevo) {
    setError(''); setCambiando(correo);
    const r = await adminUsuarios('rol', { email: correo, rol: nuevo });
    setCambiando('');
    if (r.ok) {
      onAviso && onAviso(`Listo. ${correo} entra ahora como ${ROLES.find((x) => x.id === nuevo)?.et}.`);
      recargar();
    } else {
      const porQue = {
        'no-puedes-cambiarte-tu-rol': 'No puedes cambiarte el rol a ti mismo. Pídeselo a otra persona de Dirección.',
        'es-el-unico-direccion': 'Es la única persona de Dirección. Nombra a otra antes de moverla, o la app se queda sin quien dé de alta.',
        'no-esta-en-la-lista': 'Esa persona ya no está en la lista.',
      }[r.error];
      setError(porQue || ('No se pudo cambiar el rol. ' + (r.error || '')));
    }
  }

  async function eliminar(correo) {
    setPorBorrar(null);
    const r = await adminUsuarios('eliminar', { email: correo });
    if (r.ok) {
      onAviso && onAviso('Persona dada de baja. Ya no puede entrar.');
      recargar();
    } else {
      setError('No se pudo quitar a la persona. ' + (r.error || ''));
    }
  }

  return (
    <div className="contenido">
      <h2>Quién puede entrar</h2>
      <p className="ayuda columna-texto">Solo la gente de esta lista puede usar la app. Puedes moverle el rol a cualquiera desde la
        tabla: el cambio le abre o le cierra datos de verdad, no es una etiqueta.</p>
      <div className="tarjeta" style={{ padding: '14px 18px' }}>
        {ROLES.map((r) => (
          <div key={r.id} className="ayuda" style={{ padding: '3px 0' }}>
            <strong>{r.et}:</strong> {r.ve}
          </div>
        ))}
        <p className="ayuda gris" style={{ marginBottom: 0 }}>
          El cambio se aplica cuando la persona vuelva a entrar (o recargue la app).
        </p>
      </div>

      {/* Agregar */}
      <div className="tarjeta">
        <h3>Dar de alta a alguien</h3>
        <label className="etiqueta">Nombre</label>
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" />
        <div className="espacio" />
        <label className="etiqueta">Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@vonhaucke.mx" />
        <div className="espacio" />
        <label className="etiqueta">Contraseña temporal (se la das tú)</label>
        <input type="text" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="mínimo 6 letras" />
        <div className="espacio" />
        <label className="etiqueta">Qué puede ver</label>
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${rol === 'vendedor' ? 'on' : ''}`} onClick={() => setRol('vendedor')}>Vendedor / planta</button>
          <button className={`chip ${rol === 'diseno' ? 'on' : ''}`} onClick={() => setRol('diseno')}>Diseño (ve costos, no nómina)</button>
          <button className={`chip ${rol === 'direccion' ? 'on' : ''}`} onClick={() => setRol('direccion')}>Dirección (ve nómina)</button>
        </div>
        {error && <div className="alerta roja"><span className="texto">{error}</span></div>}
        <button className="boton primario grande" disabled={trabajando} onClick={agregar}>{trabajando ? 'Agregando...' : 'Agregar persona'}</button>
      </div>

      {/* Contraseña de una sola vez — se muestra aquí tras el alta y NO se guarda. */}
      {recienCreado && (
        <div className="tarjeta" style={{ borderColor: 'var(--ambar, #e0a93b)' }}>
          <h3 style={{ marginTop: 0 }}>Comparte esta contraseña ahora</h3>
          <p className="ayuda">
            Para <strong>{recienCreado.nombre}</strong> ({recienCreado.email}). No se guarda
            en ningún lado: si la cierras, tendrás que reemitirla dando de alta otra vez.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 18, padding: '6px 12px', background: 'var(--panel, #111)', borderRadius: 6, userSelect: 'all' }}>
              {recienCreado.pass}
            </code>
            <button className="boton fantasma" onClick={() => {
              try { navigator.clipboard?.writeText(recienCreado.pass); onAviso && onAviso('Contraseña copiada.'); } catch { /* sin clipboard: se puede seleccionar a mano */ }
            }}>Copiar</button>
            <button className="boton fantasma" onClick={() => setRecienCreado(null)}>Listo, ya la compartí</button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="tarjeta">
        <h3 style={{ margin: 0 }}>Lista de acceso ({lista.length})</h3>
        <p className="ayuda gris no-imprimir" style={{ marginTop: 4 }}>
          Las contraseñas no se guardan: cuando das de alta a alguien, su contraseña se
          muestra una sola vez arriba para que la compartas en ese momento.
        </p>
        {cargando ? <p className="ayuda">Cargando...</p> : (
          <div className="tablewrap"><table className="datos">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Entra como</th><th className="no-imprimir"></th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.email}>
                  <td>{p.nombre || '—'}</td>
                  <td>{p.email}</td>
                  <td>
                    {/* Mover el rol AQUÍ da o quita permisos de verdad. */}
                    <select className="campo" style={{ minWidth: 130 }} value={p.rol || 'vendedor'}
                      disabled={cambiando === p.email || p.email === miCorreo}
                      onChange={(e) => cambiarRol(p.email, e.target.value)}>
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.et}</option>)}
                    </select>
                    {p.email === miCorreo && <div className="ayuda gris">eres tú</div>}
                    {cambiando === p.email && <div className="ayuda">cambiando…</div>}
                  </td>
                  <td className="no-imprimir">
                    <button className="boton fantasma" style={{ minHeight: 40, padding: '0 12px' }} onClick={() => setPorBorrar(p)}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {porBorrar && (
        <div className="velo" onClick={() => setPorBorrar(null)}>
          <div className="dialogo" onClick={(e) => e.stopPropagation()}>
            <h3>¿Quitar a {porBorrar.nombre || porBorrar.email}?</h3>
            <p className="ayuda">Dejará de poder entrar de inmediato. Esto no se puede deshacer.</p>
            <div className="acciones">
              <button className="boton primario" onClick={() => eliminar(porBorrar.email)}>Sí, quitar</button>
              <button className="boton fantasma" onClick={() => setPorBorrar(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
