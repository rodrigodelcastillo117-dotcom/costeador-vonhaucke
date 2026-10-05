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
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
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
    return (
      <div className="contenido">
        <div className="tarjeta">
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
