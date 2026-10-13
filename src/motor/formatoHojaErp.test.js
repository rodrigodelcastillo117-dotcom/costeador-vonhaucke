// ============================================================================
//  VH-146 · EFECTO DEL FORMATO EN EL MOTOR: una hoja ERP con precio por hoja, SIN formato (hoy) vs CON el formato
//  que asigna PROPUESTA_vh146 (4×8 = tablero 1.22×2.44 y 5×8 = tablero 1.525×2.44, `fraccion:true, mermaCorte:6`),
//  comparada con los tableros CURADOS (`melamina-16`, `mdf` de insumos.js, hechos con `tablero()`).
//
//  Piezas de la orden: cubierta 650×450 mm ×2 y costado 1800×450 mm ×1. Parámetros = PARAMETROS_DEFAULT de
//  calculo.js (no existe parametros*.js: el motor trae sus defaults en calculo.js:52-137; tablero 2440×1220 en
//  :98-99, kerf 6, recorte 10, aprovechamientoCorte 80 en :102).
//
//  DÓNDE ENTRA CADA COSA EN LA FÓRMULA (calculo.js, comprarInsumo, :356-492):
//   · `mermaCorte`      → factorMerma (:358) sólo alimenta `conCorte` (:389), y `conCorte` sólo se usa en la rama de
//                         FORMATO COMPLETO / sin formato (porArea :486, unidades :487). En la rama de FRACCIÓN
//                         (`insumo.formato && insumo.fraccion`, :454-467) NO entra: la fracción sale de la rejilla.
//                         Igual en comprar() 6.2 (:153-160). Por eso `mermaCorte:6` es inerte para estas hojas.
//   · `aprovechamientoCorte` → sólo en la rama de fracción y sólo para lo SIN medida (`netoSinMedida`, :455-457):
//                         una pieza con largo×ancho cobra su fracción real de rejilla (hojasExactas, :418) o la regla
//                         de Producción ½/1 hoja (:396-398), nunca el 80 % genérico.
//   · `formato.medida`  → convierte hojas ↔ m² (comprado = hojas × medida, :458) y precio/m² equivalente.
//   · `formato.largoMM/anchoMM` → NO los usa la rejilla: piezasPorTablero (:200-205) lee par.tableroLargoMM/AnchoMM
//                         (2440×1220 por omisión). Sólo el optimizador advisory (:646) lee el formato. HALLAZGO:
//                         para una hoja 5×8 la fracción por rejilla es la misma que en 4×8 salvo que se pasen los
//                         parámetros del tablero 2440×1525 (se muestra abajo).
//  El 6 % de `mermaCorte`: es lo que fija `tablero()` para TODOS los tableros curados (insumos.js:64-65); no hay
//  fuente técnica documentada (el encabezado de insumos.js lo llama "datos semilla"). Se copia por paridad.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calcular, piezasPorTablero, PARAMETROS_DEFAULT } from './calculo.js';
import { INSUMOS_SEMILLA, tablero } from '../datos/insumos.js';
import { hojasPorPiezaProduccion } from './politicaMerma.js';

// Los objetos `formato` EXACTOS del SQL propuesto (si el SQL cambia, esta prueba lo nota).
const SQL = readFileSync(new URL('../../supabase/migrations/PROPUESTA_vh146_formato_hojas_erp.sql', import.meta.url), 'utf8');
const literales = [...SQL.matchAll(/'(\{"tipo":"tablero"[^']*\})'::jsonb/g)].map((m) => JSON.parse(m[1]));
const FORMATO_4X8 = literales.find((f) => f.anchoMM === 1220);
const FORMATO_5X8 = literales.find((f) => f.anchoMM === 1525);

const CURADO = Object.fromEntries(INSUMOS_SEMILLA.map((i) => [i.id, i]));
// Como sale HOY del catálogo (catalogo_motor → insumo_motor): precio por hoja, formato null (P0-02 lo bloquea).
const erpSinFormato = { id: 'erp-ame1948-b14', nombre: 'AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm (ERP)', seccion: 'cubiertas', unidad: 'hoja', precio: 306, precioBase: 306, moneda: 'MXN', clase: 'directa', fraccion: false, mermaCorte: 0, veta: false, inventario: false, formato: null };
// El MISMO insumo tras el backfill (atributos || {fraccion:true, mermaCorte:6, formato}).
const erp4x8 = { ...erpSinFormato, fraccion: true, mermaCorte: 6, formato: FORMATO_4X8 };
// La hoja 5×8 real del doc § 3 (melamina 5×8 28 mm, 645.37 $/hoja) y la misma a 306 para aislar el efecto del formato.
const erp5x8 = { ...erpSinFormato, id: 'erp-ame28152', nombre: 'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm (ERP)', precio: 645.37, precioBase: 645.37, fraccion: true, mermaCorte: 6, formato: FORMATO_5X8 };
const erp5x8a306 = { ...erp5x8, precio: 306, precioBase: 306 };

const PIEZAS = (insumoId) => ({
  nombre: 'Mueble de prueba VH-146', modoManoObra: 'porcentaje',
  componentes: [
    { insumoId, nombre: 'Cubierta 650×450', largoMM: 650, anchoMM: 450, piezas: 2 },
    { insumoId, nombre: 'Costado 1800×450', largoMM: 1800, anchoMM: 450, piezas: 1 },
  ],
});
const NETO_M2 = 2 * 0.65 * 0.45 + 1.8 * 0.45; // 1.395 m²
const costear = (insumo, par) => {
  const r = calcular(PIEZAS(insumo.id), 1, { [insumo.id]: insumo }, par);
  return { r, mat: (r.detalleInsumos || []).find((d) => d.insumoId === insumo.id) };
};
const linea = (et, mat) => `${et.padEnd(44)} hojas=${mat.unidades.toFixed(4)}  m²=${mat.comprado.toFixed(4)}  neto=${mat.neto.toFixed(3)}  $=${mat.costo.toFixed(2)}  desperdicio=${mat.pct.toFixed(1)}%`;

describe('VH-146 · formato de hoja ERP en el motor (650×450 ×2 + 1800×450 ×1)', () => {
  it('los literales del SQL son los formatos del cargador/catálogo', () => {
    expect(FORMATO_4X8).toEqual({ tipo: 'tablero', nombre: 'tablero 1.22 x 2.44', corto: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 });
    expect(FORMATO_5X8).toEqual({ tipo: 'tablero', nombre: 'tablero 1.52 x 2.44', corto: 'tablero 5x8', medida: 3.721, largoMM: 2440, anchoMM: 1525 });
    // misma forma que el formato de los tableros curados (insumos.js TABLERO vía tablero())
    expect(CURADO['melamina-16'].formato).toEqual(FORMATO_4X8);
    expect(CURADO.mdf.formato).toEqual(FORMATO_4X8);
    expect(CURADO['melamina-16']).toMatchObject({ unidad: 'hoja', fraccion: true, mermaCorte: 6 });
  });

  it('(i) ERP SIN formato: P0-02 deja las dos piezas PENDIENTES (formato_incompatible), $0 y costo incompleto', () => {
    const { r, mat } = costear(erpSinFormato);
    expect(mat).toBeUndefined();
    expect(r.materialTotal).toBe(0);
    expect(r.estadoCosto).toBe('incompleto');
    expect(r.costoOficial).toBeNull();
    expect(r.pendientes).toHaveLength(2);
    for (const p of r.pendientes) expect(p).toMatch(/precio por hoja sin formato del material/);
    console.log('(i)  ERP sin formato → PENDIENTE:', r.pendientes);
  });

  it('(ii) MISMO insumo CON formato 4×8: 0.8333 hojas (2/6 por rejilla + ½ hoja regla Producción) = 2.4807 m² → $255.00', () => {
    const { r, mat } = costear(erp4x8);
    expect(r.estadoCosto).toBe('completo');
    expect(r.pendientes).toEqual([]);
    // rejilla real: 650×450 caben 6 por tablero 2440×1220 (kerf 6, recorte 10) → 2 piezas = 1/3 de hoja
    expect(piezasPorTablero(650, 450)).toBe(6);
    // 1800×450: lado mayor > 1.50 m y menor ≤ 0.60 → ½ hoja (política de Producción, politicaMerma.js)
    expect(hojasPorPiezaProduccion(1800, 450)).toBe(0.5);
    const hojas = 2 / 6 + 0.5;
    expect(mat.metodoConsumo).toBe('RENDIMIENTO_GEOMETRICO');
    expect(mat.unidades).toBeCloseTo(hojas, 6);
    expect(mat.neto).toBeCloseTo(NETO_M2, 6);
    expect(mat.comprado).toBeCloseTo(hojas * 2.9768, 6);           // 2.4807 m²
    expect(mat.costo).toBeCloseTo(hojas * 306, 6);                  // $255.00
    expect(mat.pct).toBeCloseTo((hojas * 2.9768 - NETO_M2) / (hojas * 2.9768) * 100, 6); // 43.8 % de scrap cargado
    expect(mat.reglaProduccion).toBe('produccion-rogelio-2026-10');
    expect(mat.piezasRegla).toEqual([{ pieza: 'Costado 1800×450', largoMM: 1800, anchoMM: 450, hojasPorPieza: 0.5 }]);
    expect(r.materialDirecto).toBeCloseTo(255, 2);
    console.log(linea('(ii) ERP 4×8 @306/hoja', mat));
  });

  it('(iii) 5×8: con los parámetros por omisión la rejilla sigue siendo la del 4×8 (0.8333 hojas) → 3.1008 m²; sólo cambia la medida', () => {
    const { r, mat } = costear(erp5x8);
    const hojas = 2 / 6 + 0.5;
    expect(r.estadoCosto).toBe('completo');
    expect(mat.unidades).toBeCloseTo(hojas, 6);                      // misma fracción que 4×8: piezasPorTablero lee par.tableroAnchoMM=1220
    expect(mat.comprado).toBeCloseTo(hojas * 3.721, 6);              // 3.1008 m² (medida distinta)
    expect(mat.costo).toBeCloseTo(hojas * 645.37, 6);                // $537.81
    console.log(linea('(iii) ERP 5×8 @645.37/hoja (par. 2440×1220)', mat));
    // A igual precio, la hoja 5×8 cuesta lo mismo que la 4×8 con los parámetros por omisión: la ventaja de la hoja
    // grande NO entra al costo salvo que los parámetros del tablero digan 2440×1525.
    const a306 = costear(erp5x8a306).mat;
    expect(a306.costo).toBeCloseTo(costear(erp4x8).mat.costo, 6);
    const conPar = costear(erp5x8a306, { ...PARAMETROS_DEFAULT, tableroLargoMM: 2440, tableroAnchoMM: 1525 }).mat;
    expect(piezasPorTablero(650, 450, { tableroAnchoMM: 1525 })).toBe(10);
    expect(conPar.unidades).toBeCloseTo(2 / 10 + 0.5, 6);            // 0.70 hojas
    expect(conPar.costo).toBeCloseTo(0.7 * 306, 6);                  // $214.20 (vs $255.00)
    expect(conPar.costo).toBeLessThan(a306.costo);
    console.log(linea('(iii) ERP 5×8 @306/hoja (par. 2440×1220)', a306));
    console.log(linea('(iii) ERP 5×8 @306/hoja (par. 2440×1525)', conPar));
  });

  it('misma fórmula que los tableros curados: melamina-16 y mdf dan la MISMA fracción (0.8333) y costo = fracción × precio', () => {
    const e = costear(erp4x8).mat;
    for (const id of ['melamina-16', 'mdf']) {
      const c = costear(CURADO[id]).mat;
      expect(c.metodoConsumo).toBe(e.metodoConsumo);
      expect(c.unidades).toBeCloseTo(e.unidades, 9);
      expect(c.comprado).toBeCloseTo(e.comprado, 9);
      expect(c.neto).toBeCloseTo(e.neto, 9);
      expect(c.pct).toBeCloseTo(e.pct, 9);
      expect(c.formato).toEqual(e.formato);
      expect(c.costo).toBeCloseTo(e.unidades * CURADO[id].precio, 6);
      expect(c.costo / CURADO[id].precio).toBeCloseTo(e.costo / erp4x8.precio, 9);
      console.log(linea(`curado ${id} @${CURADO[id].precio}/hoja`, c));
    }
    // y un ERP construido con el propio helper del catálogo curado da byte a byte lo mismo que el backfill
    const viaHelper = tablero({ id: erp4x8.id, nombre: erp4x8.nombre, precio: 306 });
    expect(costear(viaHelper).mat.costo).toBeCloseTo(e.costo, 9);
    expect(viaHelper.formato).toEqual(erp4x8.formato);
  });

  it('`mermaCorte` NO entra en la rama de fracción: 0 % y 6 % dan el mismo costo; sí entra con fraccion=false (formato completo)', () => {
    const m6 = costear(erp4x8).mat;
    const m0 = costear({ ...erp4x8, mermaCorte: 0 }).mat;
    expect(m0.costo).toBeCloseTo(m6.costo, 9);
    expect(m0.unidades).toBeCloseTo(m6.unidades, 9);
    // fraccion=false → rama FORMATO_COMPLETO (calculo.js:486-492): unidades = max(rejilla, ceil(neto×1.06/medida)) = 2 hojas enteras,
    // y `costo = comprado × precio` (:490) multiplica M² por un precio que es POR HOJA: 2 × 2.9768 × 306 = $1,821.80 (7× el
    // costo real). HALLAZGO: para un insumo con precio por hoja, `fraccion:true` es OBLIGATORIO, no cosmético; el backfill
    // lo fija y el motor no lo valida (calculo.js es sólo lectura: queda documentado, no corregido aquí).
    const completo = costear({ ...erp4x8, fraccion: false }).mat;
    expect(completo.metodoConsumo).toBe('FORMATO_COMPLETO');
    expect(completo.unidades).toBe(2);                               // rejilla: ceil(2/6)=1 + ceil(0.5)=1
    expect(completo.comprado).toBeCloseTo(2 * 2.9768, 6);
    expect(completo.costo).toBeCloseTo(2 * 2.9768 * 306, 6);         // $1,821.80: m² × $/hoja (incorrecto para hoja), vs $255 con fracción
    const completo0 = costear({ ...erp4x8, fraccion: false, mermaCorte: 0 }).mat;
    expect(completo0.unidades).toBe(2);                              // aquí la merma sólo movería ceil(1.395×1.06/2.9768)=1 → no cambia
    console.log(linea('ERP 4×8 fraccion=false (formato completo)', completo));
  });

  it('`aprovechamientoCorte` NO entra para piezas con medida; sólo para consumo sin medida (m² sueltos)', () => {
    const a80 = costear(erp4x8).mat;
    const a100 = costear(erp4x8, { ...PARAMETROS_DEFAULT, aprovechamientoCorte: 100 }).mat;
    expect(a100.costo).toBeCloseTo(a80.costo, 9);
    // 0.5 m² sin largo×ancho (retazo/canto suelto): 0.5/(2.9768×0.8)=0.21 hojas con 80 %, 0.168 con 100 %
    const pieza = { componentes: [{ insumoId: erp4x8.id, nombre: 'Retazo 0.5 m²', cantidad: 0.5 }], modoManoObra: 'porcentaje' };
    const s80 = calcular(pieza, 1, { [erp4x8.id]: erp4x8 }).detalleInsumos[0];
    const s100 = calcular(pieza, 1, { [erp4x8.id]: erp4x8 }, { ...PARAMETROS_DEFAULT, aprovechamientoCorte: 100 }).detalleInsumos[0];
    expect(s80.metodoConsumo).toBe('APROVECHAMIENTO_GENERICO');
    expect(s80.unidades).toBeCloseTo(0.5 / (2.9768 * 0.8), 9);
    expect(s100.unidades).toBeCloseTo(0.5 / 2.9768, 9);
    expect(s80.costo).toBeGreaterThan(s100.costo);
  });

  it('el 6 % de mermaCorte es el valor de semilla de TODOS los tableros curados (tablero()), no un dato de Producción', () => {
    const tableros = INSUMOS_SEMILLA.filter((i) => i.unidad === 'hoja' && i.formato?.tipo === 'tablero');
    expect(tableros.length).toBeGreaterThan(10);
    expect(new Set(tableros.map((i) => i.mermaCorte))).toEqual(new Set([6]));
    expect(tableros.every((i) => i.fraccion === true)).toBe(true);
    // láminas de metal usan 8 (otro criterio, otra unidad de medida: kg por hoja) — por eso vh146 NO las toca
    const laminas = INSUMOS_SEMILLA.filter((i) => i.unidad === 'hoja' && i.formato?.tipo === 'lamina');
    expect(new Set(laminas.map((i) => i.mermaCorte))).toEqual(new Set([8]));
  });
});
