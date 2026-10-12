// VH-072: la respuesta de generar-render se lee por `url` (Storage) o `dataUrl` (respaldo), nunca sólo por dataUrl.
import { describe, it, expect } from 'vitest';
import { leerRespuestaRender, comoDataUrl } from './renderRespuesta.js';

const URL_OK = 'https://x.supabase.co/storage/v1/object/public/renders/generated/a/2026-10-11/r1.png';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('leerRespuestaRender', () => {
  it('edge v30: url de Storage ⇒ imagen = url, enStorage', () => {
    const r = leerRespuestaRender({ ok: true, url: URL_OK, storagePath: 'generated/a.png', request_id: 'req-1', audit: { pass: true } });
    expect(r).toMatchObject({ ok: true, imagen: URL_OK, enStorage: true, url: URL_OK, dataUrl: null, requestId: 'req-1' });
    expect(r.audit).toEqual({ pass: true });
  });
  it('respaldo: dataUrl ⇒ imagen = dataUrl, no está en Storage', () => {
    const r = leerRespuestaRender({ ok: true, dataUrl: PNG, storageFallback: true });
    expect(r).toMatchObject({ ok: true, imagen: PNG, enStorage: false, url: null, dataUrl: PNG });
  });
  it('ok:true sin imagen NO es éxito', () => {
    expect(leerRespuestaRender({ ok: true }).ok).toBe(false);
    expect(leerRespuestaRender({ ok: true, url: 'javascript:alert(1)' }).ok).toBe(false);
    expect(leerRespuestaRender({ ok: true, dataUrl: 'data:text/html;base64,AAAA' }).ok).toBe(false);
  });
  it('errores se propagan con código y referencia', () => {
    expect(leerRespuestaRender({ ok: false, error: 'QA', code: 'RENDER_QA_FAILED', request_id: 'r9' })).toMatchObject({ ok: false, error: 'QA', code: 'RENDER_QA_FAILED', requestId: 'r9' });
    expect(leerRespuestaRender(null).ok).toBe(false);
  });
});

describe('comoDataUrl', () => {
  it('dataUrl pasa igual; URL se trae; lo que no es imagen es null', async () => {
    expect(await comoDataUrl(PNG)).toBe(PNG);
    expect(await comoDataUrl(URL_OK, async () => PNG)).toBe(PNG);
    expect(await comoDataUrl(URL_OK, async () => 'data:text/plain;base64,AA')).toBe(null);
    expect(await comoDataUrl(URL_OK, async () => { throw new Error('red'); })).toBe(null);
    expect(await comoDataUrl(URL_OK)).toBe(null);
    expect(await comoDataUrl(undefined, async () => PNG)).toBe(null);
  });
});
