import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { leerPrimeraHoja, leerHojas, filasAObjetos, serialAFechaISO, colAIndice, desescaparXml } from './xlsxMinimo.js';
import { registroDesdeFila, prepararCargaErp, idErp, UNIDAD_ERP, tramoPorPiezaDe } from './erpCarga.js';

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
  it('leerHojas conserva nombre + filas y leerPrimeraHoja sigue siendo compatible', async () => {
    const buf = fs.readFileSync(FIX);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const hojas = await leerHojas(ab);
    expect(hojas.length).toBeGreaterThanOrEqual(1);
    expect(typeof hojas[0].nombre).toBe('string');
    expect(Array.isArray(hojas[0].filas)).toBe(true);
    expect((await leerPrimeraHoja(ab))).toEqual(hojas[0].filas);
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

describe('tramo vendido por pieza (14-oct): barras comerciales de perfil/tubular en pza', () => {
  const t = (n) => tramoPorPiezaDe(n, { unidad: 'pza', seccion: 'metal' });
  it('tubular "PIEZA DE 6000 mm" → tramo de 6 m con la merma D2 calculada (6.94 %)', () => {
    expect(t('TUBULAR INDUSTRIAL RECTANGULAR 1 1/2" X 3" CALIBRE 18 PIEZA DE 6000 mm - "TRE181123"'))
      .toEqual({ tramoPorPieza: { tipo: 'tramo', nombre: 'pieza de 6000 mm', corto: 'pieza', medida: 6 }, mermaTramo: 6.94 });
    expect(t('PTR CUADRADO 1"" CALIBRE 14 PIEZA DE 6000 mm - "PTR141"').mermaTramo).toBe(6.94);
  });
  it('ángulo/solera/redondo de acero → tramo con 5 %; aluminio no es D2 (5 %)', () => {
    expect(t('ANGULO LADOS IGUALES DE 1" ESPESOR 3/16" PIEZA DE 6000 mm - "AN13166"')).toMatchObject({ tramoPorPieza: { medida: 6 }, mermaTramo: 5 });
    expect(t('SOLERA 1/8" X 2" PIEZA DE 3000 mm, EN ACERO INOXIDABLE - "SO182INA"').tramoPorPieza.medida).toBe(3);
    expect(t('REDONDO DE ø 1/4" X 6000 mm EN ACERO INOXIDABLE TIPO 304').tramoPorPieza.medida).toBe(6);
    expect(t('BARRA REDONDA 5/8" EN ACERO INOXIDABLE, 6000 mm DE LARGO -- BARD58INOX').tramoPorPieza.medida).toBe(6);
    expect(t('ANGULO DE ALUMINIO DE 1.6 X 31.7 X 3660 mm --ANG163136').mermaTramo).toBe(5);
  });
  it('NO: piezas ya cortadas, otra unidad, otra sección, o sin largo', () => {
    expect(t('CORTE CON LASER DE TUBULAR CUADRADO DE 1" X 1230 mm CALIBRE 14 CON 6 PERFORACIONES')).toBeNull();
    expect(tramoPorPiezaDe('PTR CUADRADO 1" PIEZA DE 6000 mm', { unidad: 'm', seccion: 'metal' })).toBeNull();
    expect(tramoPorPiezaDe('PTR CUADRADO 1" PIEZA DE 6000 mm', { unidad: 'pza', seccion: 'herrajes' })).toBeNull();
    expect(t('SILLA EN CAJA MODELO ALLEGRO (MAXI DIVA 155-16000)')).toBeNull();
    expect(t('BISAGRA DE TUBO Ø 3/4" X 4" EN COLD ROLLED')).toBeNull();
    expect(t('SONOTUBO DE CARTON ENROLLADO EN ESPIRAL DE Ø 400 mm, ESPESOR 5 mm PIEZA DE 3000 mm')).toBeNull();
    expect(t('TUBO SANITARIO DE ACERO INOX SATINADO TIPO 304 DE 6" CALIBRE 12 DE 6 METROS CON CORTE A 3285 mm')).toBeNull();
  });
  it('la carga lo pone en atributos.tramoPorPieza, NUNCA en formato (el motor anterior lo cobraría 6×)', () => {
    const { catalogo } = prepararCargaErp([{ articulo: 'TRE181123', opcion: '', clave: 'TRE181123', desc: 'TUBULAR INDUSTRIAL RECTANGULAR 1 1/2" X 3" CALIBRE 18 PIEZA DE 6000 mm', unidad: 'PIEZA', costo_uc: 383.28, fecha_uc: '2026-08-07', estatus: 'ALTA' }], { hoy: new Date('2026-10-14') });
    if (catalogo[0].unidad_costeo === 'pza' && catalogo[0].seccion === 'metal') {
      expect(catalogo[0].atributos.formato).toBeNull();
      expect(catalogo[0].atributos.tramoPorPieza.medida).toBe(6); expect(catalogo[0].atributos.mermaTramo).toBe(6.94);
    } else {
      throw new Error(`unidad/sección inesperadas: ${catalogo[0].unidad_costeo}/${catalogo[0].seccion}`);
    }
  });
});


describe('registroDesdeFila · encabezados de workbook real (snake_case)', () => {
  it('acepta cata_mp/explo_x_id sin renombrar columnas', () => {
    const r = registroDesdeFila({
      articulo: 'MVLSLA05260502',
      descripción: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 20 - LN20310',
      opción: '-',
      opción_descripción: '',
      unidad: 'Hoja',
      fecha_última_compra: '2024-05-27',
      costo_última_compra: 428.65,
      clave_comercial: 'LN20310',
    });
    expect(r).toMatchObject({ articulo: 'MVLSLA05260502', opcion: '', unidad: 'Hoja', fecha_uc: '2024-05-27', costo_uc: 428.65, clave: 'LN20310' });
  });
});


describe('erpCarga · workbook de proyecto = evidencia preliminar, nunca autocertifica', () => {
  const reg = {
    articulo: 'MVLSLA05260502',
    opcion: '',
    desc: 'LAMINA NEGRA HOJA 3 X 10 CALIBRE 20 ACERO 1008 - LN20310',
    opc_desc: '',
    unidad: 'Hoja',
    clave: 'LN20310',
    estatus: 'ALTA',
    fecha_uc: '2026-08-05',
    costo_uc: 428.65,
  };

  it('reporte directo reciente conserva estado propuesto', () => {
    const { precios, resumen } = prepararCargaErp([reg], { documento: 'ultima-compra.xlsx', hoy: new Date('2026-10-26') });
    expect(precios).toHaveLength(1);
    expect(precios[0]).toMatchObject({ estado: 'propuesto', requiere_validacion_compras: false });
    expect(resumen.requierenValidacionCompras).toBe(0);
  });

  it('mismo dato dentro de workbook de proyecto queda propuesto_validado y requiere Compras', () => {
    const { precios, resumen } = prepararCargaErp([reg], {
      documento: 'C-CO-320R.xlsx',
      hoy: new Date('2026-10-26'),
      forzarValidacionCompras: true,
    });
    expect(precios).toHaveLength(1);
    expect(precios[0]).toMatchObject({ estado: 'propuesto_validado', requiere_validacion_compras: true });
    expect(precios[0].evidencia).toContain('WORKBOOK DE PROYECTO');
    expect(resumen.requierenValidacionCompras).toBe(1);
  });
});


describe('ERP · contrato SQL propuesto para workbooks de proyecto', () => {
  const sqlPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'supabase', 'migrations', 'PROPUESTA_20261026_workbook_proyecto_preliminar.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  it('la carga persiste requiere_validacion_compras y no autoaprueba esos precios', () => {
    expect(sql).toContain('v_requiere_validacion');
    expect(sql).toContain('requiere_validacion_compras');
    expect(sql).toContain("if v_estado = 'propuesto' and not v_requiere_validacion then");
  });

  it('ambas firmas masivas excluyen precios que requieren revalidación', () => {
    const filtro = 'and not coalesce(ip.requiere_validacion_compras, false)';
    expect(sql.split(filtro).length - 1).toBeGreaterThanOrEqual(2);
  });
});
