// ============================================================================
//  2026-10-19 · Decisión de Dirección (Rodrigo: "Corregir ambas"). Certificación del pedido por texto:
//  "una recepción para 2 personas" salió SIN sillas y la sala de juntas con "Silla de visita DELTA".
//  La regla del prompt de cotizar-texto debe pedir: recepción = mostrador + 1 silla operativa por persona
//  que atiende; sala de juntas = CONCERTO (misma regla que el acomodo por plano: catalogoCanonico).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { catalogoIA } from './lineas.js';
import { asientoPara } from './catalogoCanonico.js';

const src = readFileSync(new URL('../../supabase/functions/cotizar-texto/index.ts', import.meta.url), 'utf8');

describe('cotizar-texto · sillas de recepción y de sala de juntas', () => {
  it('recepción para N personas lleva N sillas operativas (sin sillas de espera no pedidas)', () => {
    expect(src).toMatch(/Recepcion para N personas[^"]*N sillas OPERATIVAS con sugerido:false/);
    expect(src).toMatch(/NO agregues sillas de ESPERA salvo que se pidan/);
    expect(src).not.toMatch(/NO agregues sillas de espera\/operativas/);
  });
  it('sala de juntas → CONCERTO (SONATA de respaldo), nunca DELTA', () => {
    expect(src).toMatch(/sala de juntas\/consejo -> modelo CONCERTO/);
    expect(src).toMatch(/NO uses DELTA/);
  });
  it('la regla coincide con el acomodo por plano y el catálogo que recibe la IA SÍ trae CONCERTO, SONATA y operativas', () => {
    expect(asientoPara('MEETING_SEAT')?.nombre).toMatch(/CONCERTO/);
    const nombres = catalogoIA().__banco.piezas.map((p) => p.nombre);
    expect(nombres.some((n) => /CONCERTO/.test(n))).toBe(true);
    expect(nombres.some((n) => /SONATA/.test(n))).toBe(true);
    expect(nombres.some((n) => /^Silla operativa/.test(n))).toBe(true);
  });
});

// Dirección 2026-10-19 (Rodrigo): "Alpha es una silla cara, directiva, sólo sería para directores y privados; para lo
// demás, serían GAMMA-E". Misma regla en el pedido por texto y en el acomodo por plano.
describe('ALPHA sólo para dirección y privados; GAMMA-E para operativos y recepción', () => {
  it('cotizar-texto lo pide así', () => {
    expect(src).toMatch(/direccion u oficina privada -> ALPHA/);
    expect(src).toMatch(/Puestos operativos y recepcion -> GAMMA-E/);
  });
  it('el plano usa GAMMA-E para WORK_SEAT y ALPHA para EXECUTIVE_SEAT', () => {
    expect(asientoPara('WORK_SEAT')?.nombre).toMatch(/GAMMA-E/);
    expect(asientoPara('EXECUTIVE_SEAT')?.nombre).toMatch(/ALPHA/);
    expect(asientoPara('MEETING_SEAT')?.nombre).toMatch(/CONCERTO/);
  });
  it('el catálogo que recibe la IA trae ALPHA y GAMMA-E', () => {
    const nombres = catalogoIA().__banco.piezas.map((p) => p.nombre);
    expect(nombres.some((n) => /ALPHA/.test(n))).toBe(true);
    expect(nombres.some((n) => /GAMMA-E/.test(n))).toBe(true);
  });
});

describe('sin modelo pedido, el operativo del plano sale GAMMA-E; si piden WIN, WIN', () => {
  it('resolverPrograma por defecto → GAMMA-E; con WIN pedido → WIN', async () => {
    const { resolverPrograma } = await import('./resolverPrograma.js');
    const seat = (brief) => resolverPrograma({ operativos: 6, brief }, { linea: 'App LT' }).partidas.find((p) => p.relation_role === 'WORK_SEAT')?.bancoId;
    expect(seat(undefined)).toBe('silla-gamma-e');
    expect(seat({ operativoSeatModel: 'win' })).toBe('silla-win');
  });
});
