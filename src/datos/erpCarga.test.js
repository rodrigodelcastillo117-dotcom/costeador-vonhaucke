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
