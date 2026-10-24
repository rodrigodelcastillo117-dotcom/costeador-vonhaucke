// ============================================================================
//  RED DE SEGURIDAD  ·  ninguna pantalla vuelve a quedarse en blanco.
//
//  Antes, un error de render en cualquier pantalla tumbaba TODA la app y dejaba
//  la ventana vacía: el vendedor no sabía si era su internet, su sesión o un
//  bug, y a mí no me llegaba ni una pista de qué falló.
//  Ahora el error se atrapa aquí: la app sigue viva, se ve qué pasó, se puede
//  volver al inicio, y el detalle técnico se copia de un toque para mandarlo.
//
//  `resetKey` = la pestaña actual. Al cambiar de pantalla el error se limpia
//  solo, así que un tropiezo en una pantalla no deja la app inservible.
// ============================================================================
import { Component } from 'react';
import { registrarError } from '../datos/telemetria.js';
import { esErrorDeVersion, recargarUnaVez, sinRed } from '../datos/versionNueva.js';

export default class SinPantallaBlanca extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Queda en la consola del navegador con nombre propio, para poder pedirlo.
    console.error('[Von Haucke] Error de pantalla:', error, info?.componentStack);
    // Y se CAPTURA en telemetría (anillo exportable) con la pantalla como contexto.
    registrarError(error, { pantalla: this.props.resetKey || null, origen: 'error-boundary' });
    // Archivo de pantalla de otra versión (deploy con la app abierta): una recarga lo arregla; "Reintentar" no.
    // Sin internet no se recarga (sería la página de error del navegador): se espera a que vuelva la red.
    if (esErrorDeVersion(error) && !recargarUnaVez() && sinRed()) this.esperarRed();
  }

  esperarRed() {
    if (this.alVolverRed || typeof window === 'undefined') return;
    this.alVolverRed = () => { this.alVolverRed = null; if (!recargarUnaVez()) this.forceUpdate(); };
    window.addEventListener('online', this.alVolverRed, { once: true });
  }

  dejarDeEsperarRed() {
    if (this.alVolverRed) window.removeEventListener('online', this.alVolverRed);
    this.alVolverRed = null;
  }

  componentWillUnmount() {
    this.dejarDeEsperarRed();
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.dejarDeEsperarRed();   // la persona se fue a otra pantalla: al volver la red no se le recarga encima
      this.setState({ error: null, info: null });
    }
  }

  detalle() {
    const { error, info } = this.state;
    return [
      `Pantalla: ${this.props.resetKey || '—'}`,
      `Error: ${error?.message || error}`,
      error?.stack ? `\n${error.stack}` : '',
      info?.componentStack ? `\nComponentes:${info.componentStack}` : '',
    ].join('\n');
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (esErrorDeVersion(error) && sinRed()) {
      return (
        <div className="contenido">
          <div className="tarjeta" data-testid="pantalla-sin-red" data-red-seguridad="sin-red">
            <h2 style={{ marginTop: 0 }}>Sin internet no se puede abrir esta pantalla</h2>
            <p className="ayuda columna-texto">
              Es la primera vez que la abres en esta sesión y hay que descargarla. Tu trabajo sigue guardado en esta computadora.
              En cuanto vuelva la conexión, la app se recarga sola y la abre.
            </p>
            <div className="fila-botones" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="boton primario" onClick={() => this.props.onInicio?.()}>Volver al inicio</button>
            </div>
          </div>
        </div>
      );
    }
    if (esErrorDeVersion(error)) {
      return (
        <div className="contenido">
          <div className="tarjeta" data-testid="version-nueva" data-red-seguridad="version">
            <h2 style={{ marginTop: 0 }}>Hay una versión nueva de la app</h2>
            <p className="ayuda columna-texto">
              Se publicó una actualización mientras tenías la app abierta. Recarga para usarla: lo que ya está guardado no se pierde.
            </p>
            <div className="fila-botones" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="boton primario" onClick={() => window.location.reload()}>Recargar ahora</button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="contenido">
        {/* data-red-seguridad: el aviso de errores tardíos (avisoErrorTardio.js) no se encima a esta pantalla. */}
        <div className="tarjeta" data-red-seguridad="atoro">
          <h2 style={{ marginTop: 0 }}>Esta pantalla se atoró</h2>
          <p className="ayuda columna-texto">
            Tu cotización sigue guardada, pero lo que estabas haciendo en esta pantalla no se guardó. Puedes volver al inicio y entrar por otro
            lado. Si te vuelve a pasar, cópiame el detalle de abajo y lo arreglo con eso.
          </p>
          <div className="fila-botones" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="boton primario" onClick={() => this.props.onInicio?.()}>Volver al inicio</button>
            <button className="boton" onClick={() => this.setState({ error: null, info: null })}>Reintentar</button>
            <button className="boton fantasma" onClick={() => { navigator.clipboard?.writeText(this.detalle()); }}>
              Copiar el detalle
            </button>
          </div>
          <details style={{ marginTop: 14 }}>
            <summary className="ayuda" style={{ cursor: 'pointer' }}>Ver el detalle técnico</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8, maxHeight: 260, overflow: 'auto' }}>
              {this.detalle()}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
