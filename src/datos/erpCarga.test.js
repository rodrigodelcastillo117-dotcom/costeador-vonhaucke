import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { leerPrimeraHoja, filasAObjetos, serialAFechaISO, colAIndice, desescaparXml } from './xlsxMinimo.js';
import { registroDesdeFila, prepararCargaErp, idErp, UNIDAD_ERP } from './erpCarga.js';

const FIX = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'erp_ultima_compra_mini.xlsx');

describe('xlsxMinimo · lector sin dependencias', () => {
  it('utilidades: columnas, fechas serial y entidades XML', () => {
    expect(colAIndice('A')).toBe(0); expect(colAIndice('P')).toBe(15); expect(colAIndice('AA')).toBe(26);
    expect(serialAFechaISO(46127)).toBe('2026-04-15');
    expect(serialAFechaISO(0)).toBeNull();
    expect(desescaparXml('PINTURA &quot;PPH&quot; &amp; m&#xB2;')).toBe('PINTURA "PPH" & m²');
  });
  it('lee el reporte del ERP: 16 encabezados, 4 artículos, fechas como ISO, costos como número', async () => {
    const buf = fs.readFileSync(FIX);
    const filas = await leerPrimeraHoja(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const { encabezados, registros } = filasAObjetos(filas);
    expect(encabezados).toHaveLength(16);
    expect(encabezados[0]).toBe('Articulo'); expect(encabezados[15]).toBe('Costo Última Compra');
    expect(registros).toHaveLength(4);
    expect(registros[0]['Fecha Última Compra']).toBe('2026-04-15');
    expect(registros[0]['Costo Última Compra']).toBe(483);
    expect(registros[2]['Costo Última Compra']).toBeNull();
    expect(registros[3]['Opción']).toBe('A101');
  });
});

describe('erpCarga · del reporte a catálogo + precios', () => {
  it('normaliza registros, asigna ids estables y separa recientes/antiguos/sin costo', async () => {
    const buf = fs.readFileSync(FIX);
    const { registros } = filasAObjetos(await leerPrimeraHoja(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
    const regs = registros.map(registroDesdeFila).filter(Boolean);
    expect(regs).toHaveLength(4);
    const { catalogo, precios, resumen } = prepararCargaErp(regs, { documento: 'prueba.xlsx', hoy: new Date('2026-10-12') });
    expect(resumen.sinCosto).toBe(1);          // el artículo sin costo NO entra (nunca $0)
    expect(catalogo).toHaveLength(3);
    expect(precios).toHaveLength(3);
    const mel = catalogo.find((c) => c.id === 'erp-ame1948-b809');
    expect(mel).toMatchObject({ unidad_costeo: 'hoja', seccion: 'cubiertas', familia: 'melamina', activo: true });
    expect(mel.atributos.formato.tipo).toBe('tablero'); expect(mel.atributos.fraccion).toBe(true);
    const tub = catalogo.find((c) => c.id === 'erp-tr1834');
    expect(tub.unidad_costeo).toBe('pza');     // "pieza" del ERP → pza
    const pin = catalogo.find((c) => c.id === 'erp-pph-a101');
    expect(pin.activo).toBe(false);            // BLOQUEADO en ERP → inactivo
    expect(precios.find((p) => p.insumo_id === 'erp-ame1948-b809').estado).toBe('propuesto');          // 2026-04-15 ≤ 24 meses
    expect(precios.find((p) => p.insumo_id === 'erp-tr1834').estado).toBe('propuesto_validado');      // 2021 → antigua
    expect(precios.find((p) => p.insumo_id === 'erp-tr1834').evidencia).toMatch(/ANTIGUA/);
    expect(precios.every((p) => p.source_price > 0 && p.cost_unit && p.vigente_desde)).toBe(true);
    expect(resumen).toMatchObject({ recientes: 2, antiguos: 1, bloqueados: 1 });
  });
  it('idErp: clave comercial + opción; sin clave usa el artículo', () => {
    expect(idErp({ clave: 'AME1948', articulo: 'MVLMAG01280600', opcion: 'B809' })).toBe('erp-ame1948-b809');
    expect(idErp({ clave: '', articulo: 'MVLXXX1', opcion: '' })).toBe('erp-mvlxxx1');
    expect(UNIDAD_ERP['hoja']).toBe('hoja');
  });
});

describe('formato de hoja por nombre (VH-146)', () => {
  it("reconoce \"HOJA 4' X 8'\" (comilla de pie) y 5 x 8 como tableros con fracción", async () => {
    const { prepararCargaErp } = await import('./erpCarga.js');
    const base = { costo_uc: 725.4, unidad: 'hoja', estatus: 'ALTA', fecha_uc: '2021-11-17', opcion: null };
    const { catalogo } = prepararCargaErp([
      { ...base, articulo: 'MVLMMD18011702', clave: 'MDF18H', desc: "MDF CON UNA CARA EN MELAMINA DURABLE BLANCO HOJA 4' X 8' ESPESOR 18 mm" },
      { ...base, articulo: 'MVLMAG01320800', clave: 'AME28152', desc: 'AGLOMERADO MELAMINA DOS CARAS HOJA 5 X 8 ESPESOR 28 mm' },
      { ...base, articulo: 'MVLMAG01280600', clave: 'AME1948', desc: 'AGLOMERADO MELAMINA DOS CARAS HOJA 4 X 8 ESPESOR 19 mm' },
      { ...base, articulo: 'X48', clave: 'X48', desc: 'ACRILICO VERDE UNA CARA SATINADA DE 2400 X 1200 mm ESPESOR 3 mm' },
    ], { documento: 't' });
    const f = (clave) => catalogo.find((c) => c.atributos.erp.clave === clave).atributos;
    expect(f('MDF18H').formato).toMatchObject({ tipo: 'tablero', largoMM: 2440, anchoMM: 1220 });
    expect(f('MDF18H').fraccion).toBe(true);
    expect(f('AME28152').formato).toMatchObject({ tipo: 'tablero', largoMM: 2440, anchoMM: 1525 });
    expect(f('AME1948').formato.medida).toBeCloseTo(2.9768, 3);
    // 2400 x 1200 no es 4x8 literal ni 1.22/2.44: sigue sin formato (honesto; se decide con Compras)
    expect(f('X48').formato).toBeNull();
  });
});
