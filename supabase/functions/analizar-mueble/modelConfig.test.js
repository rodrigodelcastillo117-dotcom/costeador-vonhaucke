import { describe, it, expect } from 'vitest';
import { resolverModelo, envKeyPorFn, MODELOS_PERMITIDOS, MODELO_DEFAULT } from './modelConfig.js';

// ============================================================================
//  P0.COSTEO · Commit 2 · config de modelo centralizada (fail-closed).
//  Offline: NO toca Anthropic, Deno ni DB.
// ============================================================================

describe('resolverModelo · default explícito', () => {
  it('default correcto: analizar-mueble sin override → claude-opus-5 (idéntico a v28)', () => {
    expect(resolverModelo('analizar-mueble', {})).toBe('claude-opus-5');
    // env vacío/whitespace también cae al default (no lo trata como override).
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL: '', ANTHROPIC_MODEL_ANALIZAR_MUEBLE: '   ' })).toBe('claude-opus-5');
  });

  it('el DEFAULT declarado para analizar-mueble no cambió (guard anti-regresión)', () => {
    expect(MODELO_DEFAULT['analizar-mueble']).toBe('claude-opus-5');
  });
});

describe('resolverModelo · override válido', () => {
  it('override por-función válido gana sobre el default', () => {
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL_ANALIZAR_MUEBLE: 'claude-opus-5-5' })).toBe('claude-opus-5-5');
  });
  it('recorta espacios del override', () => {
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL_ANALIZAR_MUEBLE: '  claude-opus-5-5  ' })).toBe('claude-opus-5-5');
  });
  it('envKeyPorFn arma la clave con mayúsculas y guiones→_', () => {
    expect(envKeyPorFn('analizar-mueble')).toBe('ANTHROPIC_MODEL_ANALIZAR_MUEBLE');
  });
});

describe('resolverModelo · fail-closed (no inventa modelo)', () => {
  it('override inválido LANZA (MODEL_CONFIG_INVALID), no cae a un modelo silencioso', () => {
    let err;
    try { resolverModelo('analizar-mueble', { ANTHROPIC_MODEL_ANALIZAR_MUEBLE: 'gpt-4o' }); }
    catch (e) { err = e; }
    expect(err).toBeTruthy();
    expect(err.code).toBe('MODEL_CONFIG_INVALID');
  });
  it('override global inválido LANZA SÓLO si se permite el global explícitamente', () => {
    expect(() => resolverModelo('analizar-mueble', { ANTHROPIC_MODEL: 'modelo-fantasma' }, { permitirGlobal: true })).toThrow();
  });
  it('función sin default declarado LANZA (MODEL_CONFIG_MISSING), no adivina', () => {
    let err;
    try { resolverModelo('fn-inexistente', {}); }
    catch (e) { err = e; }
    expect(err).toBeTruthy();
    expect(err.code).toBe('MODEL_CONFIG_MISSING');
  });
  it('un override inválido NUNCA se resuelve a claude-opus-5 por accidente', () => {
    expect(() => resolverModelo('analizar-mueble', { ANTHROPIC_MODEL_ANALIZAR_MUEBLE: 'opus' })).toThrow();
  });
});

describe('aislamiento del global (P0.COSTEO · 2b)', () => {
  it('por defecto (aislado) el ANTHROPIC_MODEL global se IGNORA → cae al default', () => {
    // Aunque exista un global válido, sin permitirGlobal NO afecta a analizar-mueble.
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL: 'claude-sonnet-5-5' })).toBe('claude-opus-5');
  });
  it('un global inválido tampoco rompe cuando está aislado (se ignora)', () => {
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL: 'modelo-fantasma' })).toBe('claude-opus-5');
  });
  it('el override por-función SÍ aplica aunque el global esté aislado', () => {
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL: 'claude-sonnet-5-5', ANTHROPIC_MODEL_ANALIZAR_MUEBLE: 'claude-haiku-5-5' })).toBe('claude-haiku-5-5');
  });
  it('con permitirGlobal:true, el global válido sí se aplica (para otros callers)', () => {
    expect(resolverModelo('analizar-mueble', { ANTHROPIC_MODEL: 'claude-sonnet-5-5' }, { permitirGlobal: true })).toBe('claude-sonnet-5-5');
  });
});

describe('allowlist', () => {
  it('claude-opus-5 (legacy activo) está permitido; un id arbitrario no', () => {
    expect(MODELOS_PERMITIDOS.has('claude-opus-5')).toBe(true);
    expect(MODELOS_PERMITIDOS.has('claude-3')).toBe(false);
  });
});
