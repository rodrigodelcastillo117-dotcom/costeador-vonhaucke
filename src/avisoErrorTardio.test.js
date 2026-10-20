import { describe, it, expect, vi } from 'vitest';
import {
  crearAvisoErrorTardio, ameritaAviso, requestIdDe, idCortoError, appMontada,
  TEXTO_AVISO_TARDIO, ID_AVISO_TARDIO,
} from './avisoErrorTardio.js';

// DOM mínimo (vitest corre en node, sin jsdom): sólo lo que usa el módulo.
function nodo(tag) {
  const n = {
    tagName: tag.toUpperCase(), id: '', textContent: '', style: {}, attrs: {}, hijos: [], padre: null, dataset: {}, oyentes: {},
    setAttribute(k, v) { n.attrs[k] = String(v); },
    getAttribute(k) { return n.attrs[k] ?? null; },
    appendChild(h) { h.padre = n; n.hijos.push(h); return h; },
    remove() { if (n.padre) { n.padre.hijos = n.padre.hijos.filter((x) => x !== n); n.padre = null; } },
    addEventListener(t, fn) { (n.oyentes[t] ||= []).push(fn); },
    click() { for (const fn of n.oyentes.click || []) fn(); },
    get childElementCount() { return n.hijos.length; },
    todos() { return n.hijos.flatMap((h) => [h, ...h.todos()]); },
    querySelector(sel) {
      const m = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(sel);
      return n.todos().find((x) => m && (m[2] === undefined ? m[1] in x.attrs : x.attrs[m[1]] === m[2])) || null;
    },
  };
  return n;
}
function documento({ montada = true, fallo = false } = {}) {
  const body = nodo('body');
  const raiz = nodo('div'); raiz.id = 'raiz';
  if (fallo) raiz.dataset.fallo = '1';
  if (montada || fallo) raiz.appendChild(nodo('main'));
  body.appendChild(raiz);
  return {
    body, raiz,
    createElement: (t) => nodo(t),
    getElementById: (id) => [body, ...body.todos()].find((x) => x.id === id) || null,
    querySelector: (s) => body.querySelector(s),
  };
}
// Reloj y temporizadores manuales: `correr()` ejecuta lo programado.
function reloj() {
  let t = 1_000_000; const cola = [];
  return {
    ahora: () => t,
    avanzar: (ms) => { t += ms; },
    programar: (fn, ms) => { const x = { fn, ms, vivo: true }; cola.push(x); return x; },
    cancelar: (x) => { if (x) x.vivo = false; },
    correr: (filtro = () => true) => { for (const x of cola.splice(0)) if (x.vivo && filtro(x)) x.fn(); else if (x.vivo) cola.push(x); },
    cola,
  };
}
const armar = (opts = {}) => {
  const doc = documento(opts); const r = reloj();
  const aviso = crearAvisoErrorTardio({ doc, ahora: r.ahora, programar: r.programar, cancelar: r.cancelar, azar: () => 0.5 });
  return { doc, r, aviso, caja: () => doc.getElementById(ID_AVISO_TARDIO) };
};
const correrEspera = (r) => r.correr((x) => x.ms < 1000);

describe('aviso de error tardío: sólo después del montaje y sin tocar la app', () => {
  it('app montada + error de un botón → aviso role=alert con el texto, la referencia y botón Cerrar, FUERA de #raiz', () => {
    const { doc, r, aviso, caja } = armar();
    const appAntes = doc.raiz.hijos.slice();
    const ref = aviso.notificar(new Error("Cannot read properties of undefined (reading 'map')"));
    expect(ref).toMatch(/^E-[0-9A-Z]{6}$/);
    expect(caja()).toBeNull();                       // se decide un instante después (deja pintar a un error boundary)
    correrEspera(r);
    const c = caja();
    expect(c).not.toBeNull();
    expect(c.attrs.role).toBe('alert');
    expect(c.padre).toBe(doc.body);                  // en <body>, no dentro de #raiz
    expect(doc.raiz.hijos).toEqual(appAntes);        // el DOM de React intacto
    const textos = c.todos().map((x) => x.textContent);
    expect(textos).toContain(TEXTO_AVISO_TARDIO);
    expect(textos).toContain(`Ref. ${ref}`);
    const cerrar = c.todos().find((x) => x.tagName === 'BUTTON');
    expect(cerrar.attrs['aria-label']).toBe('Cerrar aviso');
    cerrar.click();
    expect(caja()).toBeNull();
  });

  it('antes del montaje NO avisa (eso lo pinta la malla de arranque de main.jsx)', () => {
    const { r, aviso, caja } = armar({ montada: false });
    expect(aviso.notificar(new Error('x'))).toBeNull();
    correrEspera(r);
    expect(caja()).toBeNull();
  });

  it('con la pantalla "La app no pudo abrir" (data-fallo=1) NO se encima', () => {
    const { r, aviso, caja } = armar({ fallo: true });
    expect(aviso.notificar(new Error('x'))).toBeNull();
    correrEspera(r);
    expect(caja()).toBeNull();
  });

  it('si un error boundary ya enseña su pantalla (data-red-seguridad), no se duplica el mensaje', () => {
    const { doc, r, aviso, caja } = armar();
    aviso.notificar(new Error('render'));
    const tarjeta = doc.createElement('div'); tarjeta.setAttribute('data-red-seguridad', 'atoro');
    doc.raiz.hijos[0].appendChild(tarjeta);
    correrEspera(r);
    expect(caja()).toBeNull();
  });

  it('usa el request id del error cuando lo trae', () => {
    const { r, aviso, caja } = armar();
    const e = Object.assign(new Error('edge falló'), { context: { request_id: 'req-plano-9f2' } });
    expect(aviso.notificar(e)).toBe('req-plano-9f2');
    correrEspera(r);
    expect(caja().todos().map((x) => x.textContent)).toContain('Ref. req-plano-9f2');
  });

  it('ráfaga de errores = UN aviso que cuenta las veces; tras la ventana, uno nuevo', () => {
    const { doc, r, aviso, caja } = armar();
    const ref = aviso.notificar(new Error('a'));
    expect(aviso.notificar(new Error('b'))).toBe(ref);   // aún sin pintar: se agrupa
    correrEspera(r);
    r.avanzar(1000);
    expect(aviso.notificar(new Error('c'))).toBe(ref);
    expect(doc.body.todos().filter((x) => x.id === ID_AVISO_TARDIO)).toHaveLength(1);
    expect(caja().todos().map((x) => x.textContent)).toContain(`Ref. ${ref} (3 veces)`);
    r.avanzar(6000);
    const otra = aviso.notificar(new Error('d'));
    expect(otra).not.toBeNull();
    correrEspera(r);
    expect(doc.body.todos().filter((x) => x.id === ID_AVISO_TARDIO)).toHaveLength(1);
  });

  it('cerrado por la persona, no se reabre en la misma ráfaga', () => {
    const { r, aviso, caja } = armar();
    aviso.notificar(new Error('a'));
    correrEspera(r);
    caja().todos().find((x) => x.tagName === 'BUTTON').click();
    r.avanzar(500);
    expect(aviso.notificar(new Error('b'))).toBeNull();
    correrEspera(r);
    expect(caja()).toBeNull();
  });

  it('se cierra solo pasado un rato', () => {
    const { r, aviso, caja } = armar();
    aviso.notificar(new Error('a'));
    correrEspera(r);
    expect(caja()).not.toBeNull();
    r.correr();   // autocierre
    expect(caja()).toBeNull();
  });

  it('nunca lanza aunque el documento falle', () => {
    const roto = { getElementById: () => { throw new Error('dom'); } };
    const aviso = crearAvisoErrorTardio({ doc: roto, programar: vi.fn() });
    expect(() => aviso.notificar(new Error('x'))).not.toThrow();
  });
});

describe('qué amerita aviso', () => {
  it('errores reales sí', () => {
    expect(ameritaAviso(new TypeError("Cannot read properties of null (reading 'id')"))).toBe(true);
    expect(ameritaAviso('Uncaught boom')).toBe(true);
    expect(ameritaAviso(undefined)).toBe(true);   // promesa rechazada sin motivo: igual no se completó la acción
  });
  it('ruido del navegador, cancelaciones y archivo de otra versión no (tienen su propio camino)', () => {
    expect(ameritaAviso('ResizeObserver loop completed with undelivered notifications.')).toBe(false);
    expect(ameritaAviso(new Error('ResizeObserver loop limit exceeded'))).toBe(false);
    expect(ameritaAviso(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }))).toBe(false);
    expect(ameritaAviso(new Error('Failed to fetch dynamically imported module: https://x/assets/Voni-a.js'))).toBe(false);
  });
});

describe('referencias', () => {
  it('request id: campos conocidos y, si no, el que viene en el mensaje', () => {
    expect(requestIdDe({ request_id: 'req-1abc' })).toBe('req-1abc');
    expect(requestIdDe({ requestId: 'abc-123' })).toBe('abc-123');
    expect(requestIdDe(new Error('leer-plano 504 (request req_77xyz)'))).toBe('req_77xyz');
    expect(requestIdDe(new Error('sin id'))).toBeNull();
    expect(requestIdDe(null)).toBeNull();
  });
  it('id corto: E- + 6 caracteres, determinista con reloj y azar fijos', () => {
    expect(idCortoError({ ahora: 1_792_000_000_000, azar: () => 0 })).toMatch(/^E-[0-9A-Z]{6}$/);
    expect(idCortoError({ ahora: 5, azar: () => 0 })).toBe('E-000500');
  });
  it('appMontada', () => {
    expect(appMontada(documento())).toBe(true);
    expect(appMontada(documento({ montada: false }))).toBe(false);
    expect(appMontada(documento({ fallo: true }))).toBe(false);
    expect(appMontada(null)).toBe(false);
  });
});
