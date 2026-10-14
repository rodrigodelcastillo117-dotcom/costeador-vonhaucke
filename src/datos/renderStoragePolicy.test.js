// ============================================================================
//  Cotización · renders no inflan el JSON (comportamiento, 2026-10-14).
//  Antes: buscaba `render: r.url` y `desde Cotización no voy a inventar una oficina genérica` en el TEXTO de
//  Cotizacion.jsx. Ahora ejecuta la lógica que usa Cotización (datos/renderCotizacion.js) y el contrato de
//  partida (crearPartida/validarPartida) con renders base64 y URLs de Storage.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { rendersFaltantes, mensajeRenderOficina, cotizacionParaPdf } from './renderCotizacion.js';
import { crearPartida, validarPartida } from './partida.js';

const B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const URL_OK = 'https://x.supabase.co/storage/v1/object/public/renders/p1.png';

describe('cotización · renders no inflan el JSON', () => {
  it('renders de partida persisten URL de Storage, nunca base64', async () => {
    const renderDe = vi.fn(async (pt) => (pt.id === 'mala'
      ? { ok: false, error: 'cuota' }
      : { ok: true, url: `${URL_OK}?${pt.id}`, dataUrl: B64, path: `renders/${pt.id}.png` }));
    const entrada = [{ id: 'a', nombre: 'Mesa' }, { id: 'b', nombre: 'Silla', render: URL_OK }, { id: 'mala', nombre: 'Banca' }];
    const enCurso = vi.fn();
    const { partidas, fallas } = await rendersFaltantes(entrada, renderDe, enCurso);
    expect(partidas.map((p) => p.render)).toEqual([`${URL_OK}?a`, URL_OK, undefined]);
    expect(JSON.stringify(partidas)).not.toContain('base64');
    expect(fallas).toEqual(['Banca: cuota']);
    expect(renderDe).toHaveBeenCalledTimes(2);                   // la que ya tenía render no se regenera
    expect(enCurso.mock.calls).toEqual([['a'], ['mala']]);
    expect(entrada[0].render).toBeUndefined();                   // no muta la lista original
  });

  it('el contrato de partida descarta un render base64 y lo marca como problema', () => {
    expect(crearPartida({ nombre: 'Mesa', cantidad: 1, precioUnitario: 10, render: B64 }).render).toBeNull();
    expect(crearPartida({ nombre: 'Mesa', cantidad: 1, precioUnitario: 10, render: URL_OK }).render).toBe(URL_OK);
    expect(validarPartida({ nombre: 'Mesa', cantidad: 1, precioUnitario: 10, render: B64 }).map((i) => i.campo)).toContain('render');
  });

  it('el render final del espacio sólo puede venir del Acomodo validado', () => {
    expect(mensajeRenderOficina(null, {})).toBe('Primero crea y valida el acomodo del proyecto.');
    expect(mensajeRenderOficina({ mostrar: false, existe: true, razones: ['puerta bloqueada'] }, {}))
      .toBe('El acomodo todavía no está validado para cliente: puerta bloqueada. Revísalo en Acomodo primero.');
    expect(mensajeRenderOficina({ mostrar: true }, { acomodo: {} })).toContain('desde Cotización no voy a inventar una oficina genérica');
    expect(mensajeRenderOficina({ mostrar: true }, { acomodo: { render3d: URL_OK } })).toContain('ya viene del Acomodo validado');
  });

  it('convierte la URL sólo en memoria al crear el PDF', () => {
    const cot = { folio: 'T', acomodo: { render3d: URL_OK, piezas: 3 } };
    const pdf = cotizacionParaPdf(cot, B64);
    expect(pdf.acomodo).toEqual({ render3d: B64, piezas: 3 });
    expect(cot.acomodo.render3d).toBe(URL_OK);                   // el estado conserva la URL
    expect(cotizacionParaPdf(cot, null).acomodo.render3d).toBeNull();   // si no se pudo bajar, sin imagen (no la URL cruda)
    const sinRender = { folio: 'T', acomodo: {} };
    expect(cotizacionParaPdf(sinRender, B64)).toBe(sinRender);
  });

  // STATIC GUARD: Cotizacion.jsx no se monta en node (sin jsdom). Sólo el CABLEADO de la lógica probada.
  it('cableado: Cotización usa renderDePartida/imagenAcomodoAStorage y las funciones probadas', () => {
    const s = fs.readFileSync('src/componentes/Cotizacion.jsx', 'utf8');
    expect(s).toContain('rendersFaltantes(partidas, renderDePartida, setGenPart)');
    expect(s).toContain('if (r.ok) setPartida(i, { render: r.url })');
    expect(s).toContain('imagenAcomodoAStorage(');
    expect(s).toContain('setErrGen(mensajeRenderOficina(acomodoClienteGate, cotCliente))');
    expect(s).toContain('urlADataUrl(cotCliente.acomodo?.render3d)');
    expect(s).toContain('const cotParaPdf = cotizacionParaPdf(cotCliente, render3dPdf)');
    expect(s).toContain('cot: cotParaPdf');
    expect(s).not.toContain('render: r.dataUrl');
    expect(s).not.toContain('render3d: c.toDataURL');
  });
});
