import { describe, it, expect } from 'vitest';
import {
  resolverOperativos, resolverPrivado, resolverJuntas, resolverRecepcion,
  resolverPrograma, medidasAwd,
} from './resolverPrograma.js';

describe('resolverPrograma · Product Resolver real (P0.1)', () => {
  it('#102 GOLDEN: 10 operativos → módulo REAL 6000×1200, NUNCA 7500', () => {
    const { resoluciones, faltante } = resolverOperativos(10, { linea: 'App LT' });
    expect(faltante).toBe(0);
    expect(resoluciones).toHaveLength(1);
    const r = resoluciones[0];
    expect(r.bancoId).toBe('op-10u-6000x1200-cristal');
    expect(r.w).toBe(6000);
    expect(r.d).toBe(1200);
    expect(r.w).not.toBe(7500);          // <-- la regresión que NO puede volver
    expect(r.precio).toBe(28540);        // precio real, no $0
    expect(r.source).toBe('RESUELTO');   // nunca 'SUGERIDO'/sug-*
  });

  it('capacidades exactas del catálogo resuelven a un solo módulo real', () => {
    for (const n of [1, 2, 4, 6, 8, 12]) {
      const r = resolverOperativos(n).resoluciones;
      expect(r).toHaveLength(1);
      expect(r[0].usuarios).toBe(n);
      expect(Number(r[0].w)).toBeGreaterThan(0);
      expect(r[0].bancoId).toBeTruthy();
      expect(Number(r[0].precio)).toBeGreaterThan(0);
    }
  });

  it('composición determinista de capacidad NO exacta (5 = 4 + 1), sin inventar', () => {
    const { resoluciones, faltante } = resolverOperativos(5);
    expect(faltante).toBe(0);
    const total = resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0);
    expect(total).toBe(5);
    expect(resoluciones.every((r) => r.bancoId && r.precio > 0)).toBe(true);
  });

  it('7 usuarios se compone con módulos reales sumando exactamente 7', () => {
    const { resoluciones, faltante } = resolverOperativos(7);
    expect(faltante).toBe(0);
    expect(resoluciones.reduce((s, r) => s + r.usuarios * r.cantidad, 0)).toBe(7);
  });

  it('privado → escritorio directivo REAL (ancla ANCHOR_DESK)', () => {
    const r = resolverPrivado();
    expect(r).toBeTruthy();
    expect(r.anchor_role).toBe('ANCHOR_DESK');
    expect(r.w).toBeGreaterThan(0);
    expect(r.precio).toBeGreaterThan(0);
  });

  it('juntas: capacidad → mesa REAL que la cubre (producto real, no inventado)', () => {
    const m4 = resolverJuntas(4);
    expect(m4.usuarios).toBeGreaterThanOrEqual(4);
    expect(m4.bancoId).toBeTruthy();
    expect(m4.w).toBeGreaterThan(0);
    const m10 = resolverJuntas(10);
    expect(m10.usuarios).toBeGreaterThanOrEqual(10);   // cubre la capacidad pedida
    expect(m10.w).toBeGreaterThan(0);
    expect(m10.precio).toBeGreaterThan(0);
    expect(m10.source).toBe('RESUELTO');
  });

  it('recepción → módulo recepción REAL', () => {
    const r = resolverRecepcion();
    expect(r).toBeTruthy();
    expect(/recep/i.test(r.nombre)).toBe(true);
    expect(r.anchor_role).toBe('ANCHOR_RECEPTION');
    expect(r.precio).toBeGreaterThan(0);
  });

  it('orquestador: programa completo → todas las resoluciones REALES (todasReales)', () => {
    const prog = { operativos: 10, privados: 1, salas: [4], recepcion: true };
    const r = resolverPrograma(prog, { linea: 'App LT' });
    expect(r.ok).toBe(true);
    expect(r.todasReales).toBe(true);               // ningún sug-*/$0
    expect(r.resoluciones.some((x) => x.w === 6000)).toBe(true);  // el 10u real
    expect(r.resoluciones.every((x) => x.source === 'RESUELTO')).toBe(true);
    expect(r.resoluciones.every((x) => x.bancoId && Number(x.precio) > 0)).toBe(true);
  });

  it('medidasAwd parsea strings del banco', () => {
    expect(medidasAwd('6000 × 1200 mm')).toEqual({ w: 6000, d: 1200 });
    expect(medidasAwd('2420 × 830 mm')).toEqual({ w: 2420, d: 830 });
    expect(medidasAwd('Ø 600 × 398 mm')).toEqual({ w: 600, d: 398 });
    expect(medidasAwd('sin medida')).toBeNull();
  });

  it('nunca produce un id sug-* ni precio 0', () => {
    const r = resolverPrograma({ operativos: 7, privados: 2, salas: [6, 10], recepcion: true });
    expect(r.resoluciones.every((x) => !String(x.bancoId).startsWith('sug-'))).toBe(true);
    expect(r.resoluciones.every((x) => Number(x.precio) > 0)).toBe(true);
  });
});
