// ============================================================================
//  CAMBIAR CONTRASEÑA — el usuario cambia su propia clave (ya autenticado).
//  Util porque Dirección da una contraseña temporal al dar de alta.
//
//  Pide la contraseña ACTUAL a proposito: esta app se usa en computadoras
//  compartidas del taller y la oficina. Sin ese paso, quien se encuentre una
//  sesion abierta puede cambiar la clave y quedarse con la cuenta ajena.
// ============================================================================
import { useState } from 'react';
import { cambiarContrasena, verificarContrasena, cerrarOtrasSesiones } from '../nube.js';

// Contraseñas que no protegen nada, por comunes o por obvias en esta empresa.
const OBVIAS = ['12345678', '123456789', 'password', 'contrasena', 'contraseña', 'vonhaucke',
  'vonhaucke1', 'qwertyui', 'admin123', 'costeador', '11111111', 'abcd1234'];

// Fuerza de 0 a 4. No es criptografía: es para que nadie deje "12345678".
function fuerza(p) {
  if (!p) return { n: 0, txt: '', clase: '' };
  const plana = p.toLowerCase().replace(/\s+/g, '');
  if (OBVIAS.includes(plana)) return { n: 0, txt: 'Demasiado fácil de adivinar', clase: 'mala' };
  if (/^(.)\1+$/.test(p)) return { n: 0, txt: 'Es el mismo carácter repetido', clase: 'mala' };
  let n = 0;
  if (p.length >= 8) n++;
  if (p.length >= 12) n++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++;
  if (/\d/.test(p)) n++;
  if (/[^\w\s]/.test(p)) n++;
  n = Math.min(4, n);
  const txt = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy buena'][n];
  const clase = ['mala', 'mala', 'regular', 'buena', 'buena'][n];
  return { n, txt, clase };
}

export default function CambiarContrasena({ email, onListo, recuperacion = false }) {
  const [actual, setActual] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [ver, setVer] = useState(false);
  const [cerrarOtras, setCerrarOtras] = useState(true);
  const [estado, setEstado] = useState(''); // '' | 'guardando' | 'ok'
  const [error, setError] = useState('');
  const [otrasCerradas, setOtrasCerradas] = useState(false);

  const f = fuerza(p1);
  const corta = p1.length > 0 && p1.length < 8;
  const debil = p1.length >= 8 && f.n === 0;
  const noCoincide = p2.length > 0 && p1 !== p2;
  const igualALaActual = !recuperacion && p1.length > 0 && actual.length > 0 && p1 === actual;
  const puede = (recuperacion || actual.length > 0) && p1.length >= 8 && !debil && p1 === p2 && !igualALaActual && estado !== 'guardando';

  async function guardar(e) {
    e?.preventDefault();
    if (!puede) return;
    setError(''); setEstado('guardando');
    // 1) Comprobar que quien está frente a la pantalla es el dueño de la cuenta.
    //    Se salta cuando viene del enlace de recuperación: ese enlace, que sólo
    //    llegó a su correo, ya es la prueba de identidad.
    if (!recuperacion) {
      const ok = await verificarContrasena(email, actual);
      if (!ok) { setError('Tu contraseña actual no es correcta.'); setEstado(''); return; }
    }
    // 2) Cambiarla.
    const r = await cambiarContrasena(p1);
    if (!r.ok) { setError(r.error); setEstado(''); return; }
    // 3) Si lo pidió, sacar la sesión de sus otros dispositivos.
    if (cerrarOtras) setOtrasCerradas(await cerrarOtrasSesiones());
    setEstado('ok'); setActual(''); setP1(''); setP2('');
  }

  if (estado === 'ok') {
    return (
      <div className="contenido" style={{ maxWidth: 460 }}>
        <div className="tarjeta">
          <h2>Contraseña actualizada</h2>
          <div className="alerta" style={{ background: '#e9f5f1', borderColor: 'var(--verde)', color: '#0b5c54', marginTop: 12 }}>
            <span className="texto">
              Listo. En esta computadora sigues dentro, no tienes que volver a entrar.
              {otrasCerradas
                ? ' Cerramos tu sesión en los demás dispositivos: en tu celular o en otra computadora tendrás que entrar con la nueva.'
                : ' Si la tenías abierta en otro lado, esa sesión sigue activa.'}
            </span>
          </div>
          <div className="fila-botones" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
            {onListo && <button className="boton primario grande" onClick={onListo}>Volver al inicio</button>}
            <button className="boton" style={{ minHeight: 46 }} onClick={() => { setEstado(''); setOtrasCerradas(false); }}>Cambiarla otra vez</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contenido" style={{ maxWidth: 460 }}>
      <form className="tarjeta" onSubmit={guardar}>
        <h2>{recuperacion ? 'Pon tu nueva contraseña' : 'Cambiar contraseña'}</h2>
        <p className="ayuda columna-texto">
          {recuperacion
            ? 'Entraste por el enlace que te mandamos. Escribe la contraseña nueva y listo.'
            : 'Cambia la contraseña temporal que te dio Dirección por una tuya.'}
          {email && <> Tu cuenta: <strong>{email}</strong>.</>}
        </p>

        {!recuperacion && (<>
          <label className="etiqueta" htmlFor="pw-actual" style={{ marginTop: 12 }}>Tu contraseña actual</label>
          <input id="pw-actual" name="current-password" type={ver ? 'text' : 'password'} value={actual}
            onChange={(e) => setActual(e.target.value)} placeholder="La que usas hoy" autoComplete="current-password" />
        </>)}

        <label className="etiqueta" htmlFor="pw-nueva" style={{ marginTop: 14 }}>Nueva contraseña</label>
        <input id="pw-nueva" name="new-password" type={ver ? 'text' : 'password'} value={p1}
          onChange={(e) => setP1(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password"
          aria-invalid={corta || debil || undefined} />
        {p1.length > 0 && (
          <div className={`pw-fuerza ${f.clase}`}>
            <span className="pw-barra"><i style={{ width: `${(f.n / 4) * 100}%` }} /></span>
            <span className="pw-txt">{corta ? 'Usa al menos 8 caracteres' : f.txt}</span>
          </div>
        )}
        {igualALaActual && <div className="ayuda rojo">Es la misma que ya tenías. Escoge una distinta.</div>}

        <label className="etiqueta" htmlFor="pw-repite" style={{ marginTop: 14 }}>Repite la nueva</label>
        <input id="pw-repite" name="new-password-2" type={ver ? 'text' : 'password'} value={p2}
          onChange={(e) => setP2(e.target.value)} placeholder="La misma otra vez" autoComplete="new-password"
          aria-invalid={noCoincide || undefined} />
        {noCoincide && <div className="ayuda rojo">No coinciden.</div>}

        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Ver lo que escribo
        </label>
        <label className="check">
          <input type="checkbox" checked={cerrarOtras} onChange={(e) => setCerrarOtras(e.target.checked)} />
          Cerrar mi sesión en los demás dispositivos
        </label>
        <div className="ayuda gris" style={{ fontSize: 12.5, marginTop: -2 }}>
          Déjalo palomeado si crees que alguien más conoce tu contraseña.
        </div>

        {error && <div className="alerta roja" style={{ marginTop: 12 }}><span className="texto">{error}</span></div>}
        <div className="espacio" />
        <button className="boton primario grande" type="submit" disabled={!puede}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  );
}
