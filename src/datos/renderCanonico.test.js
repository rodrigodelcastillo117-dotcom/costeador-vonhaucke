// ============================================================================
//  Contrato de RENDER CANÓNICO por ProductRevision exacta.
//  Reglas duras: revisión exacta, stale nunca vigente y GENERATED != VALIDATED.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  resolverRenderDeFilas, estadoRenderPartida, claveRenderPartida, partidaEsCanonica,
  renderEstaValidado, ESTADO_RENDER,
} from './renderCanonico.js';

const fila = (over = {}) => ({
  producto_id: 1933, producto_version_id: 1933, estado: 'VALIDATED', stale: false,
  geometry_validation: 'PASS', feature_validation: 'PASS', finish_validation: 'PASS',
  storage_url: 'https://x/renders/1933.png', creado: '2026-10-04T10:00:00Z',
  prompt_version: 'cocrear_render_v1', spec_hash: 's1', geometry_hash: 'h1', modo: 'render', ...over,
});

describe('render canónico · resolución por revisión exacta', () => {
  it('1. render exacto VALIDATED + PASS/PASS/PASS ⇒ VIGENTE', () => {
    const r = resolverRenderDeFilas([fila()], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.validado).toBe(true);
    expect(r.url).toBe('https://x/renders/1933.png');
  });

  it('2. GENERATED + NOT_VERIFIED ⇒ PENDIENTE_VALIDACION, nunca VIGENTE', () => {
    const r = resolverRenderDeFilas([fila({ estado: 'GENERATED', geometry_validation: 'NOT_VERIFIED', feature_validation: 'NOT_VERIFIED', finish_validation: 'NOT_VERIFIED' })],
      { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.PENDIENTE_VALIDACION);
    expect(r.validado).toBe(false);
    expect(r.url).toBeTruthy();
  });

  it('3. falta cualquiera de las tres validaciones ⇒ no es vigente', () => {
    for (const campo of ['geometry_validation', 'feature_validation', 'finish_validation']) {
      const r = resolverRenderDeFilas([fila({ [campo]: 'NOT_VERIFIED' })], { productoId: 1933, productoVersionId: 1933 });
      expect(r.estado).toBe(ESTADO_RENDER.PENDIENTE_VALIDACION);
      expect(renderEstaValidado(r.render)).toBe(false);
    }
  });

  it('4. existe Rev2 pero la partida sigue en Rev1 ⇒ resuelve Rev1, nunca Rev2', () => {
    const filas = [
      fila({ producto_version_id: 1933, storage_url: 'URL_REV1' }),
      fila({ producto_version_id: 1934, storage_url: 'URL_REV2', creado: '2026-10-05T10:00:00Z' }),
    ];
    const r = resolverRenderDeFilas(filas, { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.url).toBe('URL_REV1');
  });

  it('5. Rev1 sólo tiene render STALE ⇒ STALE, nunca vigente', () => {
    const r = resolverRenderDeFilas([fila({ stale: true })], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.STALE);
    expect(r.validado).toBe(false);
  });

  it('6. no hay render para esa versión ⇒ SIN_RENDER_VALIDO', () => {
    const r = resolverRenderDeFilas([], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.SIN_RENDER_VALIDO);
    expect(r.url).toBeNull();
  });

  it('7. especial Cocrear (producto_id ≠ version_id) ⇒ versión exacta', () => {
    const r = resolverRenderDeFilas([fila({ producto_id: 1933, producto_version_id: 1934, storage_url: 'URL_V1934' })],
      { productoId: 1933, productoVersionId: 1934 });
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.url).toBe('URL_V1934');
  });

  it('8. línea estándar CON ProductVersion ⇒ mismo contrato', () => {
    const partida = { nombre: 'Escritorio App LT', productoId: 500, producto_version_id: 777 };
    const mapa = { 777: [fila({ producto_id: 500, producto_version_id: 777, storage_url: 'URL_LINEA' })] };
    const r = estadoRenderPartida(partida, mapa);
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
  });

  it('9. NUNCA fallback por nombre', () => {
    const filas = [fila({ producto_version_id: 2000, storage_url: 'URL_OTRA_VERSION', producto_nombre: 'Escritorio 1.80 nogal' })];
    const r = resolverRenderDeFilas(filas, { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.SIN_RENDER_VALIDO);
  });

  it('10. actualización explícita Rev1→Rev2 resuelve Rev2', () => {
    const mapa = {
      1933: [fila({ producto_version_id: 1933, storage_url: 'URL_REV1' })],
      1934: [fila({ producto_version_id: 1934, storage_url: 'URL_REV2' })],
    };
    expect(estadoRenderPartida({ productoId: 1933, producto_version_id: 1934 }, mapa).url).toBe('URL_REV2');
  });

  it('guardias: partida sin versión ⇒ SIN_VERSION', () => {
    expect(claveRenderPartida({ nombre: 'Silla banco' })).toBeNull();
    expect(partidaEsCanonica({ nombre: 'Silla banco' })).toBe(false);
    expect(estadoRenderPartida({ nombre: 'Silla banco' }, {}).estado).toBe(ESTADO_RENDER.SIN_VERSION);
  });

  it('guardias: producto_id no coincidente se ignora', () => {
    const r = resolverRenderDeFilas([fila({ producto_id: 9999, producto_version_id: 1933 })],
      { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.SIN_RENDER_VALIDO);
  });

  it('elige el VALIDATED más reciente de la misma versión', () => {
    const filas = [
      fila({ storage_url: 'VIEJO', creado: '2026-10-01T00:00:00Z' }),
      fila({ storage_url: 'NUEVO', creado: '2026-10-04T00:00:00Z' }),
    ];
    expect(resolverRenderDeFilas(filas, { productoId: 1933, productoVersionId: 1933 }).url).toBe('NUEVO');
  });
});


  it('VALIDATED sin geometry_hash nunca es VIGENTE', () => {
    const r = resolverRenderDeFilas([fila({ geometry_hash: null })], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.PENDIENTE_VALIDACION);
    expect(r.validado).toBe(false);
  });

  it('VALIDATED sin spec_hash nunca es VIGENTE', () => {
    const r = resolverRenderDeFilas([fila({ spec_hash: null })], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.PENDIENTE_VALIDACION);
    expect(r.validado).toBe(false);
  });

  it('hash actual distinto al del render impide VIGENTE aunque PASS/PASS/PASS', () => {
    const r = resolverRenderDeFilas(
      [fila({ geometry_hash: 'g-old', bom_hash: 'b-old', material_hash: 'm-old', layout_hash: 'l-old' })],
      {
        productoId: 1933,
        productoVersionId: 1933,
        hashesActuales: { geometry_hash: 'g-new', bom_hash: 'b-old', material_hash: 'm-old', layout_hash: 'l-old' },
      },
    );
    expect(r.estado).toBe(ESTADO_RENDER.PENDIENTE_VALIDACION);
    expect(r.validado).toBe(false);
  });
