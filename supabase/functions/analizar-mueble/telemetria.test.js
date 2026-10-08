import { describe, it, expect } from 'vitest';
import { modalidadDe, mapProviderError, telemetriaExtra, crearAcumuladorProveedor, MODALIDADES, CLAVES_PROHIBIDAS } from './telemetria.js';

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
  it('timeout: AbortError → PROVIDER_TIMEOUT y http=null (no hubo respuesta del proveedor)', () => {
    const e = new Error('abort'); e.name = 'AbortError';
    const r = mapProviderError(e);
    expect(r.code).toBe('PROVIDER_TIMEOUT');
    expect(r.modelStatus).toBe('AbortError');
    expect(r.http).toBe(null);
  });
  it('provider 4xx: conserva el code y el http REAL del proveedor', () => {
    const e = new Error('bad'); e.code = 'invalid_request_error'; e.http = 400;
    const r = mapProviderError(e);
    expect(r.code).toBe('invalid_request_error');
    expect(r.http).toBe(400);
    expect(r.modelStatus).toBe('invalid_request_error');
  });
  it('provider 5xx: overloaded 529 conserva http=529', () => {
    const e = new Error('overloaded'); e.code = 'overloaded_error'; e.http = 529;
    const r = mapProviderError(e);
    expect(r.code).toBe('overloaded_error');
    expect(r.http).toBe(529);
  });
  it('Error genérico (con name, sin http) → CLAUDE_API_ERROR, http=null, modelStatus=name', () => {
    const r = mapProviderError(new Error('x'));
    expect(r.code).toBe('CLAUDE_API_ERROR');
    expect(r.http).toBe(null);               // sin e.http → null (NO 502; 502 lo decide nuestra fn)
    expect(r.modelStatus).toBe('Error');     // String(e.name) — comportamiento preservado de v28
  });
  it('objeto sin code ni name ni http → fallback provider_error, http=null', () => {
    const r = mapProviderError({});
    expect(r.code).toBe('CLAUDE_API_ERROR');
    expect(r.modelStatus).toBe('provider_error');
    expect(r.http).toBe(null);
  });
});

describe('provider_http_status ≠ http_status nuestro (auditoría 2b)', () => {
  it('provider 529 se almacena como provider_http_status=529, NO como el 502 que devuelve nuestra fn', () => {
    // El proveedor devolvió 529. mapProviderError conserva e.http=529.
    const e = { http: 529, code: 'overloaded_error' };
    const { http: providerHttp } = mapProviderError(e);
    expect(providerHttp).toBe(529);
    // Lo que persiste la telemetría EXTRA como provider_http_status es el REAL del proveedor.
    const extra = telemetriaExtra({ provider_http_status: providerHttp });
    expect(extra.provider_http_status).toBe(529);
    // El status que devuelve NUESTRA Edge Function para ese caso es 502 (columna http_status,
    // ajena a la whitelist EXTRA). Son dos valores distintos; no se confunden.
    const nuestroHttp = 502;
    expect(nuestroHttp).toBe(502);
    expect(extra.provider_http_status).not.toBe(nuestroHttp);
    expect('http_status' in extra).toBe(false);   // http_status no vive en la whitelist EXTRA
  });
  it('abort/timeout: provider_http_status=null → la columna queda NULL (no se escribe)', () => {
    const { http: providerHttp } = mapProviderError(Object.assign(new Error('a'), { name: 'AbortError' }));
    expect(providerHttp).toBe(null);
    expect('provider_http_status' in telemetriaExtra({ provider_http_status: providerHttp })).toBe(false);
  });
  it('éxito: provider_http_status=200 se registra', () => {
    expect(telemetriaExtra({ provider_http_status: 200 }).provider_http_status).toBe(200);
  });
});

describe('crearAcumuladorProveedor · multi-intento (auditoría 2c)', () => {
  const A1_200_MAXTOK = { httpStatus: 200, elapsedMs: 40000, headersMs: 900, bodyMs: 100, usage: { input_tokens: 4000, output_tokens: 1500 } };

  it('intento1 200/max_tokens + intento2 200/end_turn → status FINAL 200, sumas correctas', () => {
    const m = crearAcumuladorProveedor();
    m.registrarIntento(A1_200_MAXTOK);
    m.registrarIntento({ httpStatus: 200, elapsedMs: 15000, headersMs: 850, bodyMs: 120, usage: { input_tokens: 4200, output_tokens: 300 } });
    const r = m.resultado();
    expect(r.attempts).toBe(2);
    expect(r.provider_http_status).toBe(200);
    expect(r.provider_duration_ms).toBe(55000);          // 40000 + 15000
    expect(r.provider_headers_ms).toBe(1750);            // 900 + 850
    expect(r.provider_body_ms).toBe(220);                // 100 + 120
    expect(r.input_tokens).toBe(8200);                   // 4000 + 4200
    expect(r.output_tokens).toBe(1800);                  // 1500 + 300
  });

  it('intento1 200/max_tokens + intento2 AbortError → status FINAL null, duration suma el abort, headers/tokens sólo del intento1', () => {
    const m = crearAcumuladorProveedor();
    m.registrarIntento(A1_200_MAXTOK);
    m.registrarIntento({ httpStatus: null, elapsedMs: 75000, headersMs: null, bodyMs: null, usage: null });  // abort antes de headers
    const r = m.resultado();
    expect(r.attempts).toBe(2);
    expect(r.provider_http_status).toBe(null);           // el ÚLTIMO intento no recibió respuesta → NULL (no 200 stale)
    expect(r.provider_duration_ms).toBe(115000);         // 40000 + 75000
    expect(r.provider_headers_ms).toBe(900);             // sólo el intento1 tuvo headers
    expect(r.provider_body_ms).toBe(100);
    expect(r.input_tokens).toBe(4000);                   // sólo usage del intento1
    expect(r.output_tokens).toBe(1500);
  });

  it('intento1 200/max_tokens + intento2 529 → status FINAL 529, duration suma', () => {
    const m = crearAcumuladorProveedor();
    m.registrarIntento(A1_200_MAXTOK);
    m.registrarIntento({ httpStatus: 529, elapsedMs: 3000, headersMs: 800, bodyMs: 50, usage: null });
    const r = m.resultado();
    expect(r.attempts).toBe(2);
    expect(r.provider_http_status).toBe(529);            // status del ÚLTIMO intento
    expect(r.provider_duration_ms).toBe(43000);          // 40000 + 3000
    expect(r.provider_headers_ms).toBe(1700);            // 900 + 800
  });

  it('un solo AbortError (~75 s) → attempts=1, status NULL, duration≈75000, headers NULL', () => {
    const m = crearAcumuladorProveedor();
    m.registrarIntento({ httpStatus: null, elapsedMs: 75000, headersMs: null, bodyMs: null, usage: null });
    const r = m.resultado();
    expect(r.attempts).toBe(1);
    expect(r.provider_http_status).toBe(null);
    expect(r.provider_duration_ms).toBe(75000);          // el timeout SÍ cuenta su duración (no NULL)
    expect(r.provider_headers_ms).toBe(null);            // nunca hubo headers
    expect(r.provider_body_ms).toBe(null);
    expect(r.input_tokens).toBe(null);
  });

  it('usage null-safe: input_tokens=null del proveedor NO se convierte en 0', () => {
    const m = crearAcumuladorProveedor();
    m.registrarIntento({ httpStatus: 200, elapsedMs: 10, usage: { input_tokens: null, output_tokens: 7 } });
    const r = m.resultado();
    expect(r.input_tokens).toBe(null);                   // ausente → NULL, no 0
    expect(r.output_tokens).toBe(7);
  });

  it('sin intentos → duration/tokens/status NULL, attempts 0 (config-fail antes de llamar)', () => {
    const r = crearAcumuladorProveedor().resultado();
    expect(r.attempts).toBe(0);
    expect(r.provider_duration_ms).toBe(null);
    expect(r.provider_http_status).toBe(null);
    expect(r.input_tokens).toBe(null);
  });
});

describe('telemetriaExtra · campos de éxito', () => {
  it('registra todas las métricas para explicar los ~43 s (input vs generación)', () => {
    const ex = telemetriaExtra({
      model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000,
      user_input_chars: 123, catalog_count: 92, catalog_chars: 5400,
      input_tokens: 4200, output_tokens: 1800,
      provider_http_status: 200, provider_duration_ms: 41000, provider_headers_ms: 900, provider_body_ms: 120,
      fallback_used: false,
    });
    expect(ex).toEqual({
      model_id: 'claude-opus-5', effort: 'low', max_tokens: 8000,
      user_input_chars: 123, catalog_count: 92, catalog_chars: 5400,
      input_tokens: 4200, output_tokens: 1800,
      provider_http_status: 200, provider_duration_ms: 41000, provider_headers_ms: 900, provider_body_ms: 120,
      fallback_used: false,
    });
  });
  it('input_tokens/output_tokens (usage del proveedor) se registran como enteros', () => {
    const ex = telemetriaExtra({ input_tokens: 4200, output_tokens: 1800 });
    expect(ex.input_tokens).toBe(4200);
    expect(ex.output_tokens).toBe(1800);
  });
  it('provider_duration_ms separa el tiempo del proveedor del total nuestro', () => {
    expect(telemetriaExtra({ provider_duration_ms: 41000 }).provider_duration_ms).toBe(41000);
  });
  it('max_tokens y effort quedan correctos (coincide con el plan de v28)', () => {
    const ex = telemetriaExtra({ effort: 'medium', max_tokens: 10000 });
    expect(ex.effort).toBe('medium');
    expect(ex.max_tokens).toBe(10000);
  });
  it('user_input_chars, catalog_count y catalog_chars se coercionan a entero', () => {
    const ex = telemetriaExtra({ user_input_chars: 12.7, catalog_count: '92', catalog_chars: 5400.4 });
    expect(ex.user_input_chars).toBe(13);
    expect(ex.catalog_count).toBe(92);
    expect(ex.catalog_chars).toBe(5400);
  });
  it('NO existe input_chars (renombrado a user_input_chars); input_chars se descarta', () => {
    const ex = telemetriaExtra({ input_chars: 999, user_input_chars: 10 });
    expect('input_chars' in ex).toBe(false);
    expect(ex.user_input_chars).toBe(10);
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
