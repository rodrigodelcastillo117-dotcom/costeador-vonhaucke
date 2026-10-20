import { describe, it, expect } from 'vitest';
import { PRECIOS_LINEA } from './preciosLinea.js';
import { BANCO, bancoUnico } from './banco.js';
import { asientoPara } from './catalogoCanonico.js';
import { buscarPrecioVenta, precioDeLista } from './preciosVenta.js';
import { resolverArticuloCatalogo } from './resolverArticulo.js';

// ---------------------------------------------------------------------------
//  COTIZACIÓN REAL A-2610022-01 (20-oct-2026, asesor Edgar Serna) contra la app.
//  Rodrigo (2026-10-20):
//    · "mantente con esos precios que tiene la app"  → lo que ya existía no se mueve.
//    · "agrega todo, y hazlo con un 5% abajo del precio que dice" → lo que faltaba
//      entra a precio de la cotización × 0.95.
//    · "revisa que sí sea la GAMMA E y no la GAMMA. SON 2 MODELOS DIFERENTES".
//  Esta prueba amarra cada partida del papel al producto de la app que la cotiza.
// ---------------------------------------------------------------------------
const linea = (c) => PRECIOS_LINEA.find((a) => a.c === c);
const banco = (id) => BANCO.find((b) => b.id === id);
const visible = (id) => bancoUnico().find((b) => b.id === id);
const x095 = (p) => Math.round(p * 0.95 * 100) / 100;

describe('A-2610022-01 · lo que ya existía conserva el precio de la app', () => {
  it('escritorio gerente FLEX 1500 (FXESCCA25M19ABS): lista $5,930 (el papel dice $6,523)', () => {
    expect(linea('FXESCCA25M19ABS').l).toBe(5930);
  });
  it('banco alto RE571CT: $4,022 (el papel dice $4,424.20)', () => {
    expect(banco('p9-banco-re571ct-4022').precio).toBe(4022);
  });
});

describe('A-2610022-01 · lo que faltaba entra 5% abajo del papel', () => {
  it('FLEX 1200 rodante con charola y cajón (FXESCCM24M19ABS): 3,300 × 0.95 = $3,135', () => {
    const a = linea('FXESCCM24M19ABS');
    expect(a.l).toBe(x095(3300));
    expect(a.ruta).toBe('flex');
    expect(a.d).toMatch(/1200 X 751/);
    expect(a.d).toMatch(/RODANTE/);
    // Voni lo ofrece entre los candidatos de un escritorio FLEX de 1200.
    const r = resolverArticuloCatalogo({ ruta: 'flex', producto: 'escritorio', config: { largoMM: 1200 } });
    expect(r.candidatos.map((c) => c.clave)).toContain('FXESCCM24M19ABS');
  });

  it('archiveros Modulor 1200 izq/der (MOAHCL4IABSJ / MOAHCL4DABSJ): 8,560 × 0.95 = $8,132', () => {
    for (const [id, clave] of [['p9-modulor-archivero-izq-8132', 'MOAHCL4IABSJ'], ['p9-modulor-archivero-der-8132', 'MOAHCL4DABSJ']]) {
      expect(banco(id).precio).toBe(x095(8560));
      expect(banco(id).clave).toBe(clave);
      expect(visible(id).precio).toBe(8132);
    }
    // El de junio ($9,460, 226060050) es la misma clave izquierda: queda como historial, no como otro renglón.
    expect(visible('p9-modulor-archivero-registro-lateral-9460')).toBeUndefined();
    expect(visible('p9-modulor-archivero-izq-8132').otrosPrecios).toEqual([{ precio: 9460, fuente: '226060050', mes: '2026-06' }]);
    // Y el price-book del Costeador da lo mismo que el catálogo.
    for (const modelo of ['cajones120izq', 'cajones120der']) {
      const fila = buscarPrecioVenta('modulor', { producto: 'archivero_h', modelo });
      expect(fila && precioDeLista(fila.lista)).toBe(8132);
    }
  });

  it('mesas: APP 3000×1200 8u $12,540 · APP redonda Ø1500 6u $14,630 · ALBA alta 4000×1030 10u $20,037.40', () => {
    expect(banco('p9-app-mesa-de-juntas-12540')).toMatchObject({ precio: x095(13200), usuarios: 8, medidas: '3000 × 1200 mm', linea: 'App' });
    expect(banco('p9-app-mesa-de-juntas-redonda-14630')).toMatchObject({ precio: x095(15400), usuarios: 6, medidas: 'Ø 1500 mm', linea: 'App' });
    expect(banco('p9-alba-mesa-alta-20037')).toMatchObject({ precio: x095(21092), usuarios: 10, medidas: '4000 × 1030 mm', linea: 'Alba' });
  });
});

describe('A-2610022-01 · GAMMA-E (no GAMMA), un solo precio: $3,990', () => {
  it('todas las GAMMA-E de la app son la de polipropileno — ninguna es la GAMMA de aluminio', () => {
    const gammas = BANCO.filter((b) => /GAMMA/i.test(b.nombre) && !/TAP/i.test(b.nombre));
    expect(gammas.map((b) => b.id).sort()).toEqual(['p9-silla-operativa-gamma-e-3990', 'p9-silla-operativa-gamma-e-4140', 'silla-gamma-e']);
    for (const g of gammas) {
      expect(g.nombre).toMatch(/GAMMA-E/);
      expect(`${g.material}`).not.toMatch(/aluminio/i);
    }
  });
  it('banco/Voni y el asiento que pone el plano dan el MISMO precio', () => {
    const enBanco = bancoUnico().filter((b) => /GAMMA-E/.test(b.nombre));
    expect(enBanco).toHaveLength(1);
    expect(enBanco[0].precio).toBe(3990);
    const asiento = asientoPara('WORK_SEAT');
    expect(asiento.id).toBe('silla-gamma-e');
    expect(asiento.precio).toBe(3990);
  });
});

describe('A-2610022-01 · el proyecto completo con precios de la app', () => {
  it('suma partida por partida', () => {
    const partidas = [
      [20, linea('FXESCCA25M19ABS').l],              // escritorio gerente
      [13, banco('p9-modulor-archivero-izq-8132').precio],
      [7, banco('p9-modulor-archivero-der-8132').precio],
      [60, linea('FXESCCM24M19ABS').l],              // escritorio rodante
      [110, asientoPara('WORK_SEAT').precio],        // 80 oficinas + 30 salas
      [3, banco('p9-app-mesa-de-juntas-12540').precio],
      [1, banco('p9-app-mesa-de-juntas-redonda-14630').precio],
      [1, banco('p9-alba-mesa-alta-20037').precio],
      [10, banco('p9-banco-re571ct-4022').precio],
    ];
    const subtotal = Math.round(partidas.reduce((s, [n, p]) => s + n * p, 0) * 100) / 100;
    // Papel: $1,058,894.00 de subtotal (sin maniobras: VH no las cotiza).
    expect(subtotal).toBe(1020747.4);
  });
});
