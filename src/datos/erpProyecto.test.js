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
  });
});
