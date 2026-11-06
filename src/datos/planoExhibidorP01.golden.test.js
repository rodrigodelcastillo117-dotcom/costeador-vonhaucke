// GOLDEN · analizar-mueble leyendo un PLANO REAL de mueble (P-01: exhibidor/mostrador
// convenience store aeropuerto, 2400×700×2200 mm, 3 módulos). El fixture es la salida
// CONGELADA de analizar-mueble sobre el plano; este test NO llama al edge (determinista,
// CI-safe). Candado de regresión: si una actualización degrada la LECTURA/DESPIECE del
// plano (pierde piezas, deja de marcar procedencia, cuesta el refri del nicho, o fuerza
// el vidrio opcional), este test lo caza antes de llegar a prod.
import { describe, it, expect } from 'vitest';
import propuesta from './fixtures/plano_exhibidor_P01.golden.json';

const piezas = Array.isArray(propuesta.piezas) ? propuesta.piezas : [];
const txt = (p) => `${p.nombre || ''} ${p.material_solicitado || p.material || ''}`;

describe('GOLDEN · plano P-01 exhibidor convenience store', () => {
  it('reconoce el producto (exhibidor/mostrador)', () => {
    expect(propuesta.producto || '').toMatch(/exhibidor|mostrador|conveniencia|convenience/i);
  });

  it('despiece completo (≥15 piezas)', () => {
    expect(piezas.length).toBeGreaterThanOrEqual(15);
  });

  it('CADA pieza trae procedencia válida (el fix del prompt)', () => {
    const ok = new Set(['MEASURED', 'DERIVED', 'INFERRED', 'ASSUMED']);
    const sin = piezas.filter((p) => !ok.has(p.procedencia));
    expect(sin.map((p) => p.nombre)).toEqual([]);
  });

  it('melamina con medidas REALES (≥3 piezas de área con largo y ancho)', () => {
    const mel = piezas.filter((p) => /melamina|mdf|tablero/i.test(p.material_solicitado || '') && p.forma === 'area');
    expect(mel.length).toBeGreaterThanOrEqual(3);
    for (const p of mel) {
      expect(Number(p.largoMM)).toBeGreaterThan(0);
      expect(Number(p.anchoMM)).toBeGreaterThan(0);
    }
  });

  it('estructura metálica (PTR) presente', () => {
    expect(piezas.some((p) => /ptr|estructura|met[aá]l/i.test(txt(p)))).toBe(true);
  });

  it('vidrio/cristal/acrílico es OPCIONAL (cantidad 0), nunca costeado a la fuerza', () => {
    const v = piezas.filter((p) => /vidrio|cristal|acr[ií]lico/i.test(txt(p)));
    for (const p of v) expect(p.cantidad === 0 || p.cantidad == null).toBe(true);
  });

  it('NO despieza un refrigerador (el plano dice NICHO para refri = espacio)', () => {
    expect(piezas.some((p) => /refriger|\brefri\b/i.test(txt(p)))).toBe(false);
  });

  it('coherencia confianza↔procedencia: ASSUMED ⇒ confianza no "alta"', () => {
    const malas = piezas.filter((p) => p.procedencia === 'ASSUMED' && p.confianza === 'alta');
    expect(malas.map((p) => p.nombre)).toEqual([]);
  });
});
