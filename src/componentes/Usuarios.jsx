// ============================================================================
//  USUARIOS - solo Direccion. Da de alta y de baja a quien puede entrar.
// ============================================================================
import { useEffect, useState } from 'react';
import { listaPermitidos, adminUsuarios, credencialesTemporales } from '../nube.js';

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
    const r = await adminUsuarios('crear', { email: email.trim().toLowerCase(), password: pass, nombre, rol });
    setTrabajando(false);
    if (r.ok) {
      onAviso && onAviso('Persona agregada. Ya puede entrar.');
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
    await adminUsuarios('eliminar', { email: correo });
    onAviso && onAviso('Persona dada de baja. Ya no puede entrar.');
    recargar();
  }

  // ⚠️ "SOLO REQUIERO UN EXCEL CON SUS CONTRASEÑAS" (Rodrigo, 2026-08-19, el
  // mismo día que le iba a enseñar el costeador a su equipo). El guardado ya
  // pasa solo —la función `usuarios` escribe en `credenciales_temporales` cada
  // vez que se da de alta o se reemite una contraseña—; esto sólo lo baja como
  // archivo. CSV, no .xlsx real: Excel lo abre directo con doble clic (es lo
  // que la gente de aquí entiende por "un excel"), y así no hay que sumarle una
  // librería nueva al bundle de un solo archivo. `﻿` al frente es el BOM
  // que hace que Excel lea los acentos bien en vez de mostrar basura.
  const [descargando, setDescargando] = useState(false);
  async function descargarCredenciales() {
    setDescargando(true);
    try {
      const filas = await credencialesTemporales();
      if (!filas.length) { onAviso && onAviso('Todavía no hay contraseñas temporales guardadas.'); return; }
      const csv = ['Nombre,Correo,Entra como,Contraseña temporal,Actualizado']
        .concat(filas.map((f) => {
          const et = ROLES.find((r) => r.id === f.rol)?.et || f.rol || '';
          const cuando = f.actualizado ? new Date(f.actualizado).toLocaleString('es-MX') : '';
          const csv1 = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          return [f.nombre, f.email, et, f.password_temporal, cuando].map(csv1).join(',');
        }))
        .join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `credenciales-costeador-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setDescargando(false); }
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

      {/* Lista */}
      <div className="tarjeta">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Lista de acceso ({lista.length})</h3>
          <button className="boton fantasma no-imprimir" disabled={descargando} onClick={descargarCredenciales}>
            {descargando ? 'Preparando…' : 'Descargar credenciales (Excel)'}
          </button>
        </div>
        <p className="ayuda gris no-imprimir" style={{ marginTop: 4 }}>
          Contraseñas temporales de cada alta o reemisión — se guardan solas, esto solo las baja.
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
