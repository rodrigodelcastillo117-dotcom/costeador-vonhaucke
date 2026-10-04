// ============================================================================
//  Contrato de RENDER CANÓNICO por ProductRevision exacta.
//  Reglas duras (tanda render-partida): resolver SÓLO por producto_id +
//  producto_version_id; nunca por nombre; nunca una revisión vieja en silencio;
//  stale sólo como histórico; estado explícito cuando falta; congelado por versión.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  resolverRenderDeFilas, estadoRenderPartida, claveRenderPartida, partidaEsCanonica, ESTADO_RENDER,
} from './renderCanonico.js';

// Filas de ejemplo tal como las devuelve resolver_renders_canonicos (metadata).
const fila = (over = {}) => ({
  producto_id: 1933, producto_version_id: 1933, estado: 'GENERATED', stale: false,
  storage_url: 'https://x/renders/1933.png', creado: '2026-10-04T10:00:00Z',
  prompt_version: 'cocrear_render_v1', geometry_hash: 'h1', modo: 'render', ...over,
});

describe('render canónico · resolución por revisión exacta', () => {
  it('1. render exacto de Rev1 ⇒ VIGENTE con su URL', () => {
    const r = resolverRenderDeFilas([fila()], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.url).toBe('https://x/renders/1933.png');
  });

  it('2. existe Rev2 pero la partida sigue en Rev1 ⇒ resuelve Rev1, NUNCA Rev2', () => {
    const filas = [
      fila({ producto_version_id: 1933, storage_url: 'URL_REV1' }),
      fila({ producto_version_id: 1934, storage_url: 'URL_REV2', creado: '2026-10-05T10:00:00Z' }),
    ];
    const r = resolverRenderDeFilas(filas, { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.url).toBe('URL_REV1'); // aunque Rev2 sea más nuevo, no se usa
  });

  it('3. Rev1 sólo tiene render STALE ⇒ STALE (histórico), nunca vigente', () => {
    const r = resolverRenderDeFilas([fila({ stale: true })], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.STALE);
    expect(r.url).toBeTruthy(); // disponible sólo como histórico marcado
  });

  it('4. no hay render para esa versión ⇒ SIN_RENDER_VALIDO (estado explícito)', () => {
    const r = resolverRenderDeFilas([], { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.SIN_RENDER_VALIDO);
    expect(r.url).toBeNull();
  });

  it('5. especial Cocrear (producto_id ≠ version_id) ⇒ resuelve por su versión exacta', () => {
    const r = resolverRenderDeFilas([fila({ producto_id: 1933, producto_version_id: 1934, storage_url: 'URL_V1934' })],
      { productoId: 1933, productoVersionId: 1934 });
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.url).toBe('URL_V1934');
  });

  it('6. línea estándar CON ProductVersion ⇒ mismo contrato (resuelve por versión)', () => {
    const partida = { nombre: 'Escritorio App LT', productoId: 500, producto_version_id: 777 };
    const mapa = { 777: [fila({ producto_id: 500, producto_version_id: 777, storage_url: 'URL_LINEA' })] };
    const r = estadoRenderPartida(partida, mapa);
    expect(r.estado).toBe(ESTADO_RENDER.VIGENTE);
    expect(r.url).toBe('URL_LINEA');
  });

  it('7. NUNCA fallback por nombre: filas de otra versión/otro nombre no se usan', () => {
    const filas = [
      fila({ producto_version_id: 2000, storage_url: 'URL_OTRA_VERSION', producto_nombre: 'Escritorio 1.80 nogal' }),
    ];
    const r = resolverRenderDeFilas(filas, { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.SIN_RENDER_VALIDO); // aunque "se parezca", no se usa
    expect(r.url).toBeNull();
  });

  it('8. actualización explícita Rev1→Rev2 ⇒ la partida en Rev2 resuelve el render de Rev2', () => {
    const mapa = {
      1933: [fila({ producto_version_id: 1933, storage_url: 'URL_REV1' })],
      1934: [fila({ producto_version_id: 1934, storage_url: 'URL_REV2' })],
    };
    expect(estadoRenderPartida({ productoId: 1933, producto_version_id: 1933 }, mapa).url).toBe('URL_REV1');
    expect(estadoRenderPartida({ productoId: 1933, producto_version_id: 1934 }, mapa).url).toBe('URL_REV2');
  });

  it('guardias: partida sin versión ⇒ SIN_VERSION (no es canónica)', () => {
    expect(claveRenderPartida({ nombre: 'Silla banco' })).toBeNull();
    expect(partidaEsCanonica({ nombre: 'Silla banco' })).toBe(false);
    expect(estadoRenderPartida({ nombre: 'Silla banco' }, {}).estado).toBe(ESTADO_RENDER.SIN_VERSION);
  });

  it('guardias: el producto_id es un guardia — versión correcta pero producto que no coincide se ignora', () => {
    const r = resolverRenderDeFilas([fila({ producto_id: 9999, producto_version_id: 1933 })],
      { productoId: 1933, productoVersionId: 1933 });
    expect(r.estado).toBe(ESTADO_RENDER.SIN_RENDER_VALIDO);
  });

  it('elige el render VIGENTE más reciente si hay varios para la misma versión', () => {
    const filas = [
      fila({ storage_url: 'VIEJO', creado: '2026-10-01T00:00:00Z' }),
      fila({ storage_url: 'NUEVO', creado: '2026-10-04T00:00:00Z' }),
    ];
    expect(resolverRenderDeFilas(filas, { productoId: 1933, productoVersionId: 1933 }).url).toBe('NUEVO');
  });
});
