import { describe, it, expect } from 'vitest';
import { registrosErpDesdeWorkbookProyecto, _indiceEncabezadoProyecto } from './erpProyecto.js';

describe('erpProyecto · workbook real de costeo → sólo materiales usados', () => {
  const hojas = [
    { nombre: 'solicitud', filas: [['solicitud'], ['cliente', 'TELCEL']] },
    { nombre: 'explo_x_id', filas: [
      ['id_01'],
      [null, null, 'familia_de_operación', 'articulo', 'descripción', 'opción', 'opción_descripción', 'unidad', 'fecha_última_compra', 'costo_última_compra'],
      [null, null, 'AL-PROC', 'MVLSLA05260502', 'LAMINA NEGRA 3 X 10 CAL 20 - LN20310', '-', '', 'Hoja', '2024-05-27', 428.65],
      [null, null, 'AL-PROC', 'MVLQPP00000000', 'PINTURA PPH', 'A10', 'AZUL TELCEL', 'Kg', '2018-08-28', 207.98],
      // misma materia repetida en otro módulo: debe deduplicarse
      [null, null, 'AL-PROC', 'MVLSLA05260502', 'LAMINA NEGRA 3 X 10 CAL 20 - LN20310', '-', '', 'Hoja', '2024-05-27', 428.65],
    ]},
    { nombre: 'cata_mp', filas: [
      ['Consulta MP última compra'],
      ['articulo', 'descripción', 'opción', 'opción_descripción', 'unidad', 'fecha_última_compra', 'costo_última_compra', 'clave_comercial'],
      ['MVLSLA05260502', 'LAMINA NEGRA 3 X 10 CAL 20', '-', '', 'Hoja', '2024-05-27', 428.65, 'LN20310'],
      ['MVLQPP00000000', 'PINTURA PPH', 'A10', 'AZUL TELCEL', 'Kg', '2018-08-28', 207.98, 'PPH'],
    ]},
  ];

  it('encuentra encabezado aunque haya título antes y nombres snake_case', () => {
    expect(_indiceEncabezadoProyecto(hojas[1].filas)).toBe(1);
    expect(_indiceEncabezadoProyecto(hojas[2].filas, { requiereClave: true })).toBe(1);
  });

  it('usa explo_x_id, recupera clave comercial desde cata_mp y deduplica', () => {
    const r = registrosErpDesdeWorkbookProyecto(hojas);
    expect(r.hojaExplosion).toBe('explo_x_id');
    expect(r.hojaCatalogo).toBe('cata_mp');
    expect(r.esWorkbookProyecto).toBe(true);   // explosión nombrada + catálogo auxiliar aparte
    expect(r.registros).toHaveLength(2);
    expect(r.registros[0]).toMatchObject({ articulo: 'MVLSLA05260502', clave: 'LN20310', unidad: 'Hoja', fecha_uc: '2024-05-27', costo_uc: 428.65 });
    expect(r.registros[1]).toMatchObject({ articulo: 'MVLQPP00000000', opcion: 'A10', clave: 'PPH', unidad: 'Kg', costo_uc: 207.98 });
    expect(r.resumen.clavesRecuperadas).toBe(2);
    expect(r.resumen.registrosUnicos).toBe(2);
  });

  it('sin cata_mp conserva el artículo pero NO inventa clave', () => {
    const r = registrosErpDesdeWorkbookProyecto(hojas.slice(0, 2));
    expect(r.registros[0].clave).toBe('');
    expect(r.resumen.sinClave).toBeGreaterThan(0);
    expect(r.esWorkbookProyecto).toBe(true);   // explo_x_id nombrada basta para marcarlo workbook
  });
});

describe('erpProyecto · reporte directo "Última Compra" NO es workbook de proyecto', () => {
  // Regresión: el candado de workbooks (TELCEL) llegó a tragarse el reporte estándar de Intelisis,
  // que es UNA sola tabla con Clave Comercial inline. Si la explosión se elige a sí misma como
  // "catálogo", NO hay catálogo auxiliar y debe certificar con la política normal (no forzar
  // revalidación de Compras). Sin este candado, la carga mensual real del ERP dejaba de certificar.
  const reporteDirecto = [{
    nombre: 'Hoja1',
    filas: [
      ['Articulo', 'Descripcion', 'Opción', 'Opción Descripción', 'Unidad', 'Clave Comercial', 'Estatus', 'Fecha Última Compra', 'Costo Última Compra'],
      ['MVLMAG01280600', 'AGLOMERADO MELAMINA', 'B809', 'BLANCO ABSOLUTO', 'Hoja', 'AME1948', 'ALTA', '2026-04-15', 483],
      ['MVLSTU02060401', 'TUBULAR REDONDO', '', '', 'pieza', 'TR1834', 'ALTA', '2021-10-13', 138.4],
    ],
  }];

  it('una sola tabla con clave inline → NO es workbook, NO reporta catálogo auxiliar', () => {
    const r = registrosErpDesdeWorkbookProyecto(reporteDirecto);
    expect(r.hojaExplosion).toBe('Hoja1');
    expect(r.hojaCatalogo).toBe(null);          // la misma hoja no cuenta como catálogo MP aparte
    expect(r.esWorkbookProyecto).toBe(false);   // reporte directo de Compras, certifica normal
    expect(r.registros).toHaveLength(2);
    expect(r.registros[0]).toMatchObject({ articulo: 'MVLMAG01280600', clave: 'AME1948' });
  });
});
