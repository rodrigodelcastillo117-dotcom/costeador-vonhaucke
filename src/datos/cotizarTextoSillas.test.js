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
