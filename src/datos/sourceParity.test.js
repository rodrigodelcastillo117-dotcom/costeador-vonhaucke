// ============================================================================
//  SOURCE PARITY (GOLDEN LIVE-DATA, no engine). Hallazgo crítico 2026-10-04:
//  los tests corren con el SEED (INSUMOS_SEMILLA); el app LIVE superpone los precios
//  de `config` (BD). DIVERGEN en 62 insumos, varios por orden de magnitud (lámina,
//  inoxidable, cristal…). Por eso "golden al centavo" prueba el MÉTODO con el seed,
//  NO reproduce el costo de producción.
//
//  MAPA DE FUENTES DE COSTO (verificado):
//   · Tests (vitest) ......... SEED (INSUMOS_SEMILLA)                 ← engine golden
//   · App LIVE / preview ..... SEED ⊕ config (BD) vía config_para_rol ← prod bf6ec0f
//   · Rama claude/project-thread-4bot5u: app (Dirección/Diseño) y costear-servidor
//     usan fusionarInsumos(semilla, config, catalogo_vigente) → precio de compras.
//   · resolver_costo_insumo .. catalogo_vigente → config → DESCONOCIDO
//   · Producto Maestro ....... price-book comercial (economía sin certificar)
//   · Voni ................... get_material_prices sólo Dirección/Diseño (RPC filtra rol)
//
//  Esta prueba NO sincroniza precios (cuál es el correcto lo decide Compras). Sólo
//  CONGELA la divergencia conocida: si cambia (sync, nuevo insumo, nueva captura),
//  CI falla y obliga a re-examinar con evidencia.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';
import { CONFIG_SNAPSHOT, DIVERGENCIAS_GRAVES } from './_fixtures/configSnapshot.js';

const seed = mapaInsumos(INSUMOS_SEMILLA);
const DB = CONFIG_SNAPSHOT.precios;
const precioSeed = (id) => { const s = seed[id]; return s ? Number(s.precio ?? s.precioBase) : undefined; };

function divergencias() {
  const difs = [];
  for (const id of Object.keys(DB)) {
    const ps = precioSeed(id);
    if (ps === undefined) continue;          // sólo en config: lo cubre otra aserción
    if (Number(ps) !== Number(DB[id])) difs.push({ id, seed: ps, db: DB[id], ratio: Math.max(ps, DB[id]) / Math.max(1e-9, Math.min(ps, DB[id])) });
  }
  return difs;
}

describe('SOURCE PARITY seed (tests) ↔ config (producción)', () => {
  it('la divergencia conocida es exactamente 62 insumos (congelada; si cambia, re-examinar)', () => {
    expect(divergencias().length).toBe(62);
  });

  it('TODOS los insumos de config existen en el seed (config ⊂ seed por id)', () => {
    const faltan = Object.keys(DB).filter((id) => precioSeed(id) === undefined);
    expect(faltan).toEqual([]);
  });

  it('las divergencias GRAVES (ratio ≥5×) están documentadas y siguen siendo graves', () => {
    const graves = divergencias().filter((d) => d.ratio >= 5).map((d) => d.id).sort();
    for (const id of graves) expect(DIVERGENCIAS_GRAVES).toContain(id);
    expect(graves.length).toBeGreaterThanOrEqual(7);
  });

  it('ejemplo testigo: melamina-28 seed 1335.6 ≠ config 1280 (documentado)', () => {
    expect(precioSeed('melamina-28')).toBeCloseTo(1335.6, 2);
    expect(DB['melamina-28']).toBe(1280);
  });
});
