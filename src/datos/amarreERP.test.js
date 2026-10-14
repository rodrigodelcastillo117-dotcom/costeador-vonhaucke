import { describe, it, expect } from 'vitest';
import { amarrarPendientesERP, consultasPara } from './amarreERP.js';
import { MATCH } from './materialMatch.js';

const ERP = [
  { id: 'erp-led-5000', nombre: 'Kit iluminacion LED 5000K tira + fuente', unidad: 'kit', precio: 1890, clasificacion: 'erp' },
  { id: 'erp-led-3000', nombre: 'Kit iluminacion LED 3000K tira + fuente', unidad: 'kit', precio: 1790, clasificacion: 'erp' },
  { id: 'erp-contacto-doble', nombre: 'Contacto doble polarizado', unidad: 'pza', precio: 55, clasificacion: 'erp' },
  { id: 'erp-contacto-sin-precio', nombre: 'Contacto sencillo', unidad: 'pza', precio: null, clasificacion: 'erp' },
  { id: 'erp-ptr-1-cal14', nombre: 'PTR 1" cal. 14', unidad: 'm', precio: 48, clasificacion: 'erp' },
  { id: 'erp-ptr-pza', nombre: 'PTR CUADRADO 1"" CALIBRE 14 PIEZA DE 6000 mm', unidad: 'pza', precio: 134.2, clasificacion: 'erp' },
  { id: 'bisagra', nombre: 'Bisagra', unidad: 'pza', precio: 19, evidencia: { estado: 'propuesto', certificable: false }, actualizado: '2026-10-01' },
  { id: 'erp-bibi', nombre: 'BISAGRA BIDIMENSIONAL MONTAJE SOBREPUESTO', unidad: 'pza', precio: 13.66, evidencia: { estado: 'aprobado', certificable: true }, actualizado: '2026-07-03' },
  { id: 'erp-bitac', nombre: 'BISAGRA BIDIMENSIONAL RECTA TAC 110 CIERRE SUAVE', unidad: 'pza', precio: 20.83, evidencia: { estado: 'aprobado', certificable: true }, actualizado: '2026-08-10' },
];
const buscar = async (q) => ERP.filter((r) => q.toLowerCase().split(/\s+/).some((w) => w.length > 2 && r.nombre.toLowerCase().includes(w)));

describe('amarre al catálogo de Compras (ERP) · provisional, nunca inventa precio', () => {
  it('pendiente con familia reconocible → se amarra al mejor del ERP (color/variante) y se agrega al catálogo local', async () => {
    const agregados = [];
    const comps = [{ nombre: 'Kit iluminación LED', material_solicitado: 'Kit iluminacion LED 5000 K (tiras + fuente + arnes)', material_match: MATCH.NOT_AVAILABLE, insumoId: '', cantidad: 1 }];
    const r = await amarrarPendientesERP(comps, { buscar, agregarInsumo: (i) => agregados.push(i.id), insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-led-5000'); expect(r.comps[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
    expect(r.comps[0]._match.erp).toBe(true); expect(agregados).toEqual(['erp-led-5000']); expect(r.amarrados[0].precio).toBe(1890);
  });
  it('prefiere filas CON precio; la sin precio no se escoge si hay otra', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Contacto eléctrico', material_solicitado: 'Contacto', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-contacto-doble');
  });
  it('sin familia reconocible (refrigerador del cliente) → no toca nada y lo lista', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Refrigerador doble puerta', material_solicitado: 'Refrigerador doble puerta de vidrio', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.sinCandidato).toEqual(['Refrigerador doble puerta']);
  });
  it('ya amarrado localmente → no se toca', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bisagras', insumoId: 'bisagra', material_match: MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED }], { buscar, agregarInsumo: () => { throw new Error('no debía'); }, insumos: {} });
    expect(r.amarrados).toHaveLength(0);
  });
  it('atributo crítico distinto (calibre) → candidato preseleccionado, NO costea', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bastidor', material_solicitado: 'PTR 1" cal. 12', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.comps[0].material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT); expect(r.comps[0].candidate_insumo_id).toBe('erp-ptr-1-cal14');
  });
  it('sin red (buscar falla) → todo queda como estaba', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Kit LED', material_solicitado: 'Kit LED', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar: async () => { throw new Error('offline'); }, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.sinCandidato).toEqual(['Kit LED']);
  });
});

describe('amarre ERP · consultas y "lo que el taller compra de verdad"', () => {
  it('la búsqueda por término recibe la frase sin acentos y las palabras clave (sin "cal.14" ni color)', () => {
    expect(consultasPara('PTR cal.14 negro')).toEqual(['PTR negro', 'ptr']);
    expect(consultasPara('Pintura electrostática negra')).toEqual(['Pintura electrostatica negra', 'pintura', 'electrostatica']);
    expect(consultasPara('Lámina de acero cal. 18 negra')).toEqual(['Lamina de acero negra', 'lamina', 'acero']);
  });
  it('"Bisagra" genérica con 3 candidatos: gana la certificada por Compras más reciente, no la propuesta ni la primera', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bisagras puertas', material_solicitado: 'Bisagra', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-bitac'); expect(r.comps[0]._match.motivo).toMatch(/Compras/);
  });
  it('"bisagra cierre suave" → la variante nombrada manda sobre la certificación', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bisagras', material_solicitado: 'bisagra cierre suave', material_match: 'NOT_AVAILABLE', insumoId: '' }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-bitac');
  });
});

describe('amarre ERP · unidad compatible con el consumo', () => {
  it('pieza lineal (metros) prefiere filas por metro; la "pieza de 6000 mm" no se multiplica por metros', async () => {
    const r = await amarrarPendientesERP([{ nombre: 'Bastidor', material_solicitado: 'PTR 1" cal. 14', material_match: 'NOT_AVAILABLE', insumoId: '', forma: 'lineal', cantidad: 30 }], { buscar, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-ptr-1-cal14');
  });
  it('si SÓLO hay filas con unidad incompatible → preselecciona como crítico, no costea', async () => {
    const soloPza = async () => ERP.filter((x) => x.id === 'erp-ptr-pza');
    const r = await amarrarPendientesERP([{ nombre: 'Bastidor', material_solicitado: 'PTR 1" cal. 14', material_match: 'NOT_AVAILABLE', insumoId: '', forma: 'lineal', cantidad: 30 }], { buscar: soloPza, agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe(''); expect(r.comps[0].material_match).toBe(MATCH.SAME_FAMILY_CRITICAL_CONFLICT); expect(r.comps[0]._match.cambio).toMatch(/unidad/);
  });
  it('la "pieza de 6000 mm" CON tramoPorPieza en el catálogo sí es compatible: el motor la consume en metros a $/pieza ÷ 6', async () => {
    const conTramo = { ...ERP.find((x) => x.id === 'erp-ptr-pza'), tramoPorPieza: { tipo: 'tramo', medida: 6 }, mermaTramo: 6.94 };
    const r = await amarrarPendientesERP([{ nombre: 'Bastidor', material_solicitado: 'PTR 1" cal. 14', material_match: 'NOT_AVAILABLE', insumoId: '', forma: 'lineal', cantidad: 30 }], { buscar: async () => [conTramo], agregarInsumo: () => {}, insumos: {} });
    expect(r.comps[0].insumoId).toBe('erp-ptr-pza'); expect(r.comps[0].material_match).toBe(MATCH.SAME_FAMILY_COMPATIBLE_PROPOSED);
  });
});

describe('fusionarAmarreEnBom (VH-149): el amarre tardío no pisa lo que la persona editó', () => {
  it('copia sólo insumoId/material_match/candidate/_match; conserva cantidad, medidas y nombre editados', async () => {
    const { fusionarAmarreEnBom } = await import('./amarreERP.js');
    const viejo = { nombre: 'Lateral', cantidad: 2, largoMM: 650, anchoMM: 450, material_match: 'NOT_AVAILABLE' };
    const amarrado = { ...viejo, insumoId: 'erp-mdf19', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', candidate_insumo_id: 'erp-mdf19', _match: { clase: 'SAME_FAMILY_COMPATIBLE_PROPOSED', erp: true } };
    const editado = { ...viejo, cantidad: 4, largoMM: 700 };   // la persona cambió cantidad y largo mientras buscaba el ERP
    const r = fusionarAmarreEnBom([editado], [amarrado]);
    expect(r[0]).toMatchObject({ cantidad: 4, largoMM: 700, insumoId: 'erp-mdf19', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', candidate_insumo_id: 'erp-mdf19' });
    expect(r[0]._match.erp).toBe(true);
  });
  it('si la persona ya eligió material o excluyó la pieza, el amarre no la toca; si cambió el nombre o el largo del BOM, no fusiona', async () => {
    const { fusionarAmarreEnBom } = await import('./amarreERP.js');
    const a = { nombre: 'Lateral', insumoId: 'erp-x', _match: { erp: true } };
    expect(fusionarAmarreEnBom([{ nombre: 'Lateral', insumoId: 'mdf' }], [a])[0].insumoId).toBe('mdf');
    expect(fusionarAmarreEnBom([{ nombre: 'Lateral', excluida: true }], [a])[0].insumoId).toBeUndefined();
    expect(fusionarAmarreEnBom([{ nombre: 'Costado' }], [a])[0].insumoId).toBeUndefined();
    const dos = fusionarAmarreEnBom([{ nombre: 'Lateral' }, { nombre: 'Otra' }], [a]);
    expect(dos[0].insumoId).toBeUndefined();   // longitud distinta: el BOM cambió, no se fusiona nada
  });
});

describe('VH-155: las medidas del nombre de la pieza cuentan para el conflicto', () => {
  it('"Jaladeras rectas 300 mm" con material_solicitado "jaladera" NO acepta una jaladera de 128 mm como compatible: queda candidata crítica, sin costear', async () => {
    const { amarrarPendientesERP } = await import('./amarreERP.js');
    const buscar = async () => [{ id: 'erp-jal128', nombre: 'JALADERA ALUMINIO DE 128 mm CODIGO 079-1583', unidad: 'pza', precio: 45, clasificacion: 'erp', evidencia: { certificable: true } }];
    const { comps, amarrados } = await amarrarPendientesERP([{ nombre: 'Jaladeras rectas 300 mm', material_solicitado: 'jaladera', material_match: 'NOT_AVAILABLE', forma: 'pieza', cantidad: 3 }], { buscar, insumos: {} });
    expect(comps[0].insumoId).toBeUndefined();
    expect(comps[0].material_match).toBe('SAME_FAMILY_CRITICAL_CONFLICT');
    expect(comps[0].candidate_insumo_id).toBe('erp-jal128');
    expect(amarrados[0].critico).toBe(true);
  });
});
