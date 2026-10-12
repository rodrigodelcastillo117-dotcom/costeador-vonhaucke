import { describe, it, expect } from 'vitest';
import { imagenAStorage, resolverImagenesAcomodo, rutaImagen, mimeDe } from './imagenStorage.js';

const JPG = 'data:image/jpeg;base64,/9j/4AAQ';
const URL1 = 'https://x.supabase.co/storage/v1/object/public/renders/acomodo/c1/oficina-1.jpg';

describe('imagenAStorage', () => {
  it('sube y devuelve sólo la URL', async () => {
    const r = await imagenAStorage(JPG, 'acomodo/c1/oficina-1.jpg', { subir: async (d, p) => ({ ok: true, path: p, url: `https://x/${p}` }) });
    expect(r).toEqual({ ok: true, url: 'https://x/acomodo/c1/oficina-1.jpg' });
  });
  it('Storage falla → error, sin base64 de vuelta', async () => {
    const r = await imagenAStorage(JPG, 'p', { subir: async () => ({ ok: false, error: 'RLS' }) });
    expect(r).toEqual({ ok: false, error: 'RLS' });
  });
  it('una URL pública ya está en Storage: se conserva tal cual, sin volver a subir (VH-072)', async () => {
    let subidas = 0;
    const r = await imagenAStorage('https://x.supabase.co/storage/v1/object/public/renders/generated/a.png', 'p', { subir: async () => { subidas++; return { ok: true, url: 'https://otra' }; } });
    expect(r).toEqual({ ok: true, url: 'https://x.supabase.co/storage/v1/object/public/renders/generated/a.png' });
    expect(subidas).toBe(0);
  });
  it('rechaza lo que no es imagen o no acepta el bucket', async () => {
    expect((await imagenAStorage('texto suelto', 'p', { subir: async () => ({ ok: true, url: 'https://x' }) })).ok).toBe(false);
    expect((await imagenAStorage('data:image/svg+xml;base64,AA', 'p', { subir: async () => ({ ok: true, url: 'https://x' }) })).error).toMatch(/no permitido/);
    expect(mimeDe('data:image/svg+xml;base64,AA')).toBe('image/svg+xml');
  });
  it('ruta determinista: carpeta/id/nombre-ts.ext, id nulo → sin-id', () => {
    expect(rutaImagen('acomodo', 'c/1', 'oficina', JPG, 9)).toBe('acomodo/c_1/oficina-9.jpg');
    expect(rutaImagen('partidas', null, '', 'data:image/png;base64,AA', 9)).toBe('partidas/sin-id/9.png');
  });
});

describe('resolverImagenesAcomodo (para el PDF)', () => {
  it('URL → dataUrl; dataUrl legacy pasa igual; lo que no se puede traer queda null; el resto intacto', async () => {
    const aco = { areas: [1], plan: { x: 1 }, render3d: URL1, escenas: [{ nombre: 'Juntas', img: 'https://x/e1.jpg' }, { nombre: 'Legacy', img: JPG }, { nombre: 'Rota', img: 'https://x/rota.jpg' }, { nombre: 'Sin', img: null }] };
    const traer = async (u) => (u.endsWith('rota.jpg') ? null : `data:image/jpeg;base64,DE_${u.split('/').pop()}`);
    const r = await resolverImagenesAcomodo(aco, { traer });
    expect(r.render3d).toBe('data:image/jpeg;base64,DE_oficina-1.jpg');
    expect(r.escenas.map((e) => e.img)).toEqual(['data:image/jpeg;base64,DE_e1.jpg', JPG, null, null]);
    expect(r.areas).toEqual([1]); expect(r.plan).toEqual({ x: 1 });
    // No muta el original: el estado sigue con URLs.
    expect(aco.render3d).toBe(URL1);
  });
  it('acomodo null/sin imágenes se devuelve tal cual', async () => {
    expect(await resolverImagenesAcomodo(null)).toBeNull();
    expect(await resolverImagenesAcomodo({ areas: [] }, { traer: async () => 'x' })).toEqual({ areas: [] });
  });
  it('traer que lanza no tumba el documento', async () => {
    const r = await resolverImagenesAcomodo({ render3d: URL1 }, { traer: async () => { throw new Error('net'); } });
    expect(r.render3d).toBeNull();
  });
});
