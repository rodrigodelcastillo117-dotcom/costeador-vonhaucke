// ============================================================================
//  LOGIN - la puerta. Solo entra quien Direccion autorizo.
//
//  Es la primera impresion de la empresa, asi que va a pantalla partida: foto
//  del producto a un lado, formulario al otro. Las portadas se alternan con un
//  acercamiento lento -- se siente como video y pesa 140 KB, en vez de los
//  megas de un video que ademas muchos celulares no reproducen solos.
// ============================================================================
import { useEffect, useState } from 'react';
import { pedirRecuperacion } from '../nube.js';
import MarcaLogo from './MarcaLogo.jsx';

const MARCA = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/marca';
const PORTADAS = [`${MARCA}/portada-1.jpg`, `${MARCA}/portada-2.jpg`, `${MARCA}/portada-3.jpg`];

export default function Login({ onEntrar, aviso = '' }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [olvide, setOlvide] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verPass, setVerPass] = useState(false);

  async function recuperar(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Escribe tu correo para mandarte el enlace.'); return; }
    setError(''); setEnviando(true);
    const r = await pedirRecuperacion(email.trim());
    setEnviando(false);
    if (!r.ok) { setError(r.error); return; }
    setEnviado(true);
  }
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    if (e) e.preventDefault();
    if (!email || !pass) { setError('Escribe tu correo y tu contraseña.'); return; }
    setCargando(true); setError('');
    try {
      await onEntrar(email.trim().toLowerCase(), pass);
    } catch (err) {
      setError('Correo o contraseña incorrectos. Revisa e intenta otra vez.');
      setCargando(false);
    }
  }

  const SHOWROOM = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/marca/showroom.jpg';
  // Las portadas se alternan solas con un acercamiento lento: da sensación de
  // video sin el peso de un video (140 KB cada una) y sin depender de que el
  // navegador permita reproducir solo.
  const [portada, setPortada] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPortada((n) => (n + 1) % PORTADAS.length), 7000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="entrada">
      <div className="entrada-foto" aria-hidden="true">
        {PORTADAS.map((u, i) => (
          <div key={u} className={`entrada-img ${i === portada ? 'on' : ''}`} style={{ backgroundImage: `url(${u})` }} />
        ))}
        <div className="entrada-velo" />
        <div className="entrada-marca">
          <div className="entrada-marca-t">Mobiliario de oficina hecho en México</div>
          <div className="entrada-marca-s">Vonhaucke · más de 68 años de oficio</div>
        </div>
      </div>

      <div className="entrada-panel">
        <div className="entrada-caja">
          <MarcaLogo alto={44} />
          <div className="entrada-sub">Costeador de producción</div>

          <h2 className="entrada-h">Entrar</h2>
          <p className="ayuda" style={{ marginBottom: 18 }}>Usa el correo y la contraseña que te dio Dirección.</p>

          {aviso && <div className="alerta" style={{ background: '#fdf3df', borderColor: 'var(--ambar)', color: '#7a5600', marginBottom: 14 }}><span className="texto">{aviso}</span></div>}

          <form onSubmit={entrar}>
            <label className="etiqueta" htmlFor="email-login">Correo</label>
            <input id="email-login" type="email" inputMode="email" autoComplete="username" autoFocus value={email}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => { setEmail(e.target.value); setError(''); }} />
            <div className="espacio" />
            <label className="etiqueta" htmlFor="pass-login">Contraseña</label>
            <input id="pass-login" type={verPass ? 'text' : 'password'} autoComplete="current-password" value={pass}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => { setPass(e.target.value); setError(''); }} />
            <label className="check" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={verPass} onChange={(e) => setVerPass(e.target.checked)} /> Ver contraseña
            </label>

            {error && <div className="alerta roja" style={{ marginTop: 14 }}><span className="texto">{error}</span></div>}

            <div className="espacio" />
            <button type="submit" className="boton primario grande" disabled={cargando}>
              {cargando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {enviado ? (
            <div className="alerta" style={{ background: '#e9f5f1', borderColor: 'var(--verde)', color: '#0b5c54', marginTop: 14 }}>
              <span className="texto">Te mandamos un correo a <strong>{email}</strong> con un enlace para poner una contraseña nueva. Revisa también la carpeta de no deseados.</span>
            </div>
          ) : olvide ? (
            <div className="olvide">
              <p className="ayuda" style={{ marginTop: 0 }}>Escribe tu correo arriba y te mandamos un enlace para poner una contraseña nueva.</p>
              <div className="fila-botones" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button className="boton" style={{ minHeight: 46 }} onClick={recuperar} disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Mandarme el enlace'}
                </button>
                <button className="boton fantasma" style={{ minHeight: 46 }} onClick={() => setOlvide(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className="enlace-olvide" onClick={() => { setOlvide(true); setError(''); }}>¿Olvidaste tu contraseña?</button>
          )}

          <p className="ayuda entrada-pie">¿No puedes entrar? Pídele a Dirección que te dé de alta.</p>
        </div>
      </div>
    </div>
  );
}
