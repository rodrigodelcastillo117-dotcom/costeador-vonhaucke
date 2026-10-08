import { describe, it, expect } from 'vitest';
import { modalidadDe, mapProviderError, telemetriaExtra, MODALIDADES, CLAVES_PROHIBIDAS } from './telemetria.js';

// ============================================================================
//  P0.COSTEO · Commit 2 · telemetría (observabilidad, sin secretos).
//  Offline: NO toca Anthropic, Deno ni DB.
// ============================================================================

describe('modalidadDe', () => {
  it('texto / revision / pdf / imagen según la entrada', () => {
    expect(modalidadDe({ soloTexto: true })).toBe('texto');
    expect(modalidadDe({ esRevision: true })).toBe('revision');
    expect(modalidadDe({ esPdf: true })).toBe('pdf');
    expect(modalidadDe({})).toBe('imagen');
  });
  it('precedencia v28: texto > revision; revision > pdf/imagen', () => {
    expect(modalidadDe({ soloTexto: true, esRevision: true })).toBe('texto');
    expect(modalidadDe({ esRevision: true, esPdf: true })).toBe('revision');
  });
  it('todas las modalidades están en el enum', () => {
    for (const m of ['texto', 'imagen', 'pdf', 'revision']) expect(MODALIDADES.has(m)).toBe(true);
  });
});

describe('mapProviderError', () => {
  it('timeout: AbortError → PROVIDER_TIMEOUT', () => {
    const e = new Error('abort'); e.name = 'AbortError';
    const r = mapProviderError(e);
    expect(r.code).toBe('PROVIDER_TIMEOUT');
    expect(r.modelStatus).toBe('AbortError');
  });
  it('provider 4xx: usa el code y http del proveedor', () => {
    const e = new Error('bad'); e.code = 'invalid_request_error'; e.http = 400;
    const r = mapProviderError(e);
    expect(r.code).toBe('invalid_request_error');
    expect(r.http).toBe(400);
    expect(r.modelStatus).toBe('invalid_request_error');
  });
  it('provider 5xx: overloaded 529', () => {
    const e = new Error('overloaded'); e.code = 'overloaded_error'; e.http = 529;
    const r = mapProviderError(e);
    expect(r.code).toBe('overloaded_error');
    expect(r.http).toBe(529);
  });
  it('Error genérico (con name) → CLAUDE_API_ERROR, http 502, modelStatus=name (igual que v28)', () => {
    const r = mapProviderError(new Error('x'));
    expect(r.code).toBe('CLAUDE_API_ERROR');
    expect(r.http).toBe(502);
    expect(r.modelStatus).toBe('Error');   // String(e.name) — comportamiento preservado de v28
  });
  it('objeto sin code ni name → fallback provider_error', () => {
    const r = mapProviderError({});
    expect(r.code).toBe('CLAUDE_API_ERROR');
    expect(r.modelStatus).toBe('provider_error');
    expect(r.http).toBe(502);
  });
});

describe('telemetriaExtra · campos de éxito', () => {
  it('registra model_id/effort/max_tokens/input_chars/catalog_count/fallback_used', () => {
    const ex = telemetriaExtra({ model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000, input_chars: 123, catalog_count: 92, fallback_used: false });
    expect(ex).toEqual({ model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000, input_chars: 123, catalog_count: 92, fallback_used: false });
  });
  it('max_tokens y effort quedan correctos (coincide con el plan de v28)', () => {
    const ex = telemetriaExtra({ effort: 'medium', max_tokens: 10000 });
    expect(ex.effort).toBe('medium');
    expect(ex.max_tokens).toBe(10000);
  });
  it('catalog_count e input_chars se coercionan a entero', () => {
    const ex = telemetriaExtra({ input_chars: 12.7, catalog_count: '92' });
    expect(ex.input_chars).toBe(13);
    expect(ex.catalog_count).toBe(92);
  });
  it('fallback_used=true se registra tal cual (listo para cuando exista fallback)', () => {
    expect(telemetriaExtra({ fallback_used: true }).fallback_used).toBe(true);
  });
  it('descarta campos ausentes/null (no inventa ceros)', () => {
    expect(telemetriaExtra({ model_id: 'claude-opus-5' })).toEqual({ model_id: 'claude-opus-5' });
    expect(telemetriaExtra({})).toEqual({});
  });
});

describe('telemetriaExtra · NO persiste secretos/prompts/BOM (whitelist estricta)', () => {
  it('descarta prompt, descripción, BOM, JWT, cookies, API keys aunque el caller los pase', () => {
    const sucio = {
      model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000,
      // ruido que NUNCA debe persistirse:
      prompt: 'system completo...', descripcion: 'escritorio PTR 1200x600 del cliente',
      piezas: [{ nombre: 'Cubierta' }], informe: '## auditoría', bom: {},
      authorization: 'Bearer xxx', jwt: 'eyJ...', cookie: 'sb=...', api_key: 'sk-ant-...',
      apikey: 'x', password: 'hunter2', email: 'rodrigo@x.mx',
    };
    const ex = telemetriaExtra(sucio);
    expect(ex).toEqual({ model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000 });
    // Ninguna clave prohibida sobrevive.
    for (const k of Object.keys(ex)) expect(CLAVES_PROHIBIDAS.has(k)).toBe(false);
    for (const k of ['prompt', 'descripcion', 'piezas', 'informe', 'bom', 'authorization', 'jwt', 'cookie', 'api_key', 'password', 'email']) {
      expect(k in ex).toBe(false);
    }
  });
});

describe('no regresión del BOM / contrato', () => {
  it('telemetriaExtra jamás contiene el schema ni el contenido del análisis', () => {
    const ex = telemetriaExtra({ model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000, input_chars: 10, catalog_count: 5, fallback_used: false, schema: { huge: true }, propuesta: { piezas: [] } });
    expect('schema' in ex).toBe(false);
    expect('propuesta' in ex).toBe(false);
  });
});
