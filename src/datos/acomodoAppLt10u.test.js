// Operación 9.5 · punto 12 · acomodo de la banca doble APP LT 10 usuarios (6000 × 1200) con el solver real.
// Valores esperados por geometría: banca doble = 1200 de fondo + zona de silla (≈900) por ambos lados ≈ 3000 de fondo.
import { describe, it, expect } from 'vitest';
import { acomodarLocal } from './planner.js';
import { auditarColocacion } from './acomodoAudit.js';

const banca = (id) => ({ id, nombre: 'Banca doble APP LT · 10 usuarios', w: 6000, d: 1200, tipo: 'escritorio', ruta: 'applt', productoId: 'banca_doble' });
function correr(ancho, largo, n) {
  const piezas = [...Array(n)].map((_, i) => banca('b' + i));
  const areas = [{ nombre: 'Operativa', tipo: 'open', ancho, largo }];
  const plan = acomodarLocal(areas, piezas, {});
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const col = plan.colocacion.filter((k) => byId[k.id]);
  return { plan, col, audit: auditarColocacion({ areas: plan.areas || areas, colocacion: col, byId }) };
}

describe('APP LT 10U (6000×1200) · acomodo real', () => {
  it.each([[8000, 4000, 1, 1], [6500, 3000, 1, 1], [8000, 7000, 2, 2], [12000, 8000, 3, 3]])('%i×%i con %i banca(s): coloca %i, sin encimar ni salirse', (an, la, n, esperadas) => {
    const { plan, col, audit } = correr(an, la, n);
    expect(col).toHaveLength(esperadas);
    expect(plan.caben).toBe(true);
    expect(audit.overlaps).toHaveLength(0);
    expect(audit.fuera).toHaveLength(0);
  });
  it('un cuarto de 5900 mm no admite una banca de 6000 mm: lo dice, no la encoge', () => {
    const { plan, col } = correr(5900, 4000, 1);
    expect(col).toHaveLength(0);
    expect(plan.caben).toBe(false);
  });
  it('dos bancas dobles no caben en 4.5 m de fondo (necesitan ≈ 6 m con sillas): coloca 1 y avisa', () => {
    const { plan, col } = correr(8000, 4500, 2);
    expect(col).toHaveLength(1);
    expect(plan.caben).toBe(false);
  });
  it('texto en singular para una sola banca (antes: "Los 1 muebles… 1 estaciones")', () => {
    const { plan } = correr(8000, 4000, 1);
    expect(plan.resumen).not.toMatch(/Los 1 |1 estaciones/);
    expect(plan.resumen).toMatch(/El mueble queda/);
  });
});
