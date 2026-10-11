import { describe, it, expect } from 'vitest';
import { renderParaPartida, rutaRenderPartida } from './renderPartida.js';
import { crearPartida, validarPartida } from './partida.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const pt = { id: 'p_abc/1', nombre: 'Escritorio', ruta: 'ejecutiva' };

describe('renderParaPartida: la partida sólo recibe URL', () => {
  it('sube el base64 y devuelve la URL pública; nunca el dataUrl', async () => {
    const llamadas = [];
    const r = await renderParaPartida(pt, {
      ahora: 1700000000000,
      generar: async (desc, extra) => { llamadas.push(['gen', desc, extra]); return { ok: true, dataUrl: PNG }; },
      subir: async (dataUrl, path) => { llamadas.push(['sub', path]); return { ok: true, path, url: `https://x.supabase.co/storage/v1/object/public/renders/${path}` }; },
    });
    expect(r).toEqual({ ok: true, url: 'https://x.supabase.co/storage/v1/object/public/renders/partidas/p_abc_1/1700000000000.png' });
    expect(llamadas[0]).toEqual(['gen', 'Escritorio', { tipo: 'ejecutiva' }]);
    expect(JSON.stringify(r)).not.toContain('data:');
    // Lo que entra al contrato queda como URL válida y la validación no lo rechaza.
    const p = crearPartida({ ...pt, cantidad: 1, precioUnitario: 100, render: r.url }, { veCostos: false });
    expect(p.render).toBe(r.url);
    expect(validarPartida(p).some((i) => i.campo === 'render')).toBe(false);
  });

  it('si Storage falla, NO devuelve base64 ni finge éxito', async () => {
    const r = await renderParaPartida(pt, {
      generar: async () => ({ ok: true, dataUrl: PNG }),
      subir: async () => ({ ok: false, error: 'bucket lleno' }),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('bucket lleno');
    expect(r.url).toBeUndefined();
  });

  it('propaga el error de generación y no intenta subir', async () => {
    let subio = false;
    const r = await renderParaPartida(pt, {
      generar: async () => ({ ok: false, error: 'cuota agotada' }),
      subir: async () => { subio = true; return { ok: true, url: 'https://x' }; },
    });
    expect(r).toEqual({ ok: false, error: 'cuota agotada' });
    expect(subio).toBe(false);
  });

  it('red caída en cualquiera de los dos pasos → error, sin excepción', async () => {
    const a = await renderParaPartida(pt, { generar: async () => { throw new Error('net'); }, subir: async () => ({ ok: true, url: 'https://x' }) });
    expect(a).toEqual({ ok: false, error: 'No se pudo conectar.' });
    const b = await renderParaPartida(pt, { generar: async () => ({ ok: true, dataUrl: PNG }), subir: async () => { throw new Error('net'); } });
    expect(b).toEqual({ ok: false, error: 'No se pudo guardar la imagen.' });
  });

  it('rechaza formatos que el bucket no acepta y rutas se derivan del mime', () => {
    expect(rutaRenderPartida(pt, 'data:image/jpeg;base64,AA', 5)).toBe('partidas/p_abc_1/5.jpg');
    expect(rutaRenderPartida({ id: null }, PNG, 7)).toBe('partidas/sin-id/7.png');
  });

  it('gif/svg no entran al bucket', async () => {
    const r = await renderParaPartida(pt, { generar: async () => ({ ok: true, dataUrl: 'data:image/svg+xml;base64,AA' }), subir: async () => ({ ok: true, url: 'https://x' }) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no permitido/);
  });
});
