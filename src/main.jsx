import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SinPantallaBlanca from './componentes/SinPantallaBlanca.jsx';
import { registrarError } from './datos/telemetria.js';
import './fuentes.css';
import './estilos.css';
import './runtimeGuardrails.js';

// ============================================================================
//  MALLA DE ÚLTIMO RECURSO — la app NUNCA debe quedarse en blanco.
//
//  Había una red de seguridad dentro de App, pero sólo atrapa errores de sus
//  HIJOS: si el que truena es App mismo (o algo antes de que React monte), la
//  pantalla se quedaba vacía y no había forma de saber qué pasó.
//  Aquí hay dos capas más:
//   1) un error boundary que envuelve TODO, incluido App;
//   2) enganches a `error` y `unhandledrejection` que escriben el fallo dentro
//      de la página aunque React ni siquiera haya arrancado.
//  El objetivo no es esconder el bug: es que SIEMPRE se pueda leer y copiar.
// ============================================================================

function pintarFallo(titulo, detalle) {
  const raiz = document.getElementById('raiz');
  if (!raiz || raiz.dataset.fallo === '1') return;   // no encimar dos errores
  if (raiz.childElementCount > 0) return;            // React ya pintó algo: no estorbar
  raiz.dataset.fallo = '1';
  const caja = document.createElement('div');
  caja.style.cssText = 'max-width:720px;margin:40px auto;padding:24px;font:15px/1.5 system-ui,sans-serif;color:#1E1B1A';
  const txt = `${titulo}\n\n${detalle}`;
  caja.innerHTML =
    '<h2 style="margin:0 0 8px">La app no pudo abrir</h2>' +
    '<p style="color:#6b645c;margin:0 0 16px">Esto es un error de la app, no de tu internet ni de tu sesión. ' +
    'Copia el detalle de abajo y mándamelo: con eso se arregla de una.</p>' +
    '<button id="vh-copiar" style="padding:10px 16px;border:1px solid #B22A22;background:#B22A22;color:#fff;border-radius:8px;cursor:pointer">Copiar el detalle</button> ' +
    '<button id="vh-recargar" style="padding:10px 16px;border:1px solid #ddd;background:#fff;border-radius:8px;cursor:pointer">Recargar</button>' +
    '<pre style="white-space:pre-wrap;font-size:12px;background:#f3f1ed;padding:14px;border-radius:8px;margin-top:16px;max-height:320px;overflow:auto"></pre>';
  caja.querySelector('pre').textContent = txt;
  raiz.appendChild(caja);
  caja.querySelector('#vh-copiar').onclick = () => { navigator.clipboard?.writeText(txt); };
  caja.querySelector('#vh-recargar').onclick = () => { window.location.reload(); };
}

window.addEventListener('error', (e) => {
  registrarError(e?.error || e?.message, { origen: 'window.onerror', archivo: e?.filename, linea: e?.lineno });
  pintarFallo('Error al cargar', `${e.message}\n${e.filename}:${e.lineno}:${e.colno}\n\n${e.error?.stack || ''}`);
});
window.addEventListener('unhandledrejection', (e) => {
  registrarError(e?.reason, { origen: 'unhandledrejection' });
  pintarFallo('Error al cargar (promesa)', String(e.reason?.stack || e.reason));
});

try {
  createRoot(document.getElementById('raiz')).render(
    <React.StrictMode>
      <SinPantallaBlanca resetKey="app" onInicio={() => window.location.reload()}>
        <App />
      </SinPantallaBlanca>
    </React.StrictMode>
  );
} catch (e) {
  pintarFallo('Error al arrancar', String(e?.stack || e));
}
