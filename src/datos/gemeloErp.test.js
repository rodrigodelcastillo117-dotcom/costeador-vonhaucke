import { describe, it, expect } from 'vitest';
import { esGemeloExacto, mejorGemeloCertificable, proponerGemelosErp, fusionarGemelosEnBom, piezasConTamanoDeHoja, consultaGemelo } from './gemeloErp.js';

const FMT = { tipo: 'tablero', medida: 2.9768, largoMM: 2440, anchoMM: 1220 };
const mdf = { id: 'mdf', nombre: 'MDF 19 mm', unidad: 'hoja', precio: 437, formato: FMT, fraccion: true, evidencia: { estado: 'propuesto', certificable: false } };
const erp19 = { id: 'erp-mdf19', nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 19 mm - "MDF19"', unidad: 'hoja', precio: 431.04, formato: FMT, clasificacion: 'erp', actualizado: '2026-06-01', evidencia: { estado: 'aprobado', certificable: true } };
const erp16 = { ...erp19, id: 'erp-mdf16', nombre: 'MDF NATURAL HOJA 4 X 8 ESPESOR 16 mm', precio: 372 };
const erp19viejo = { ...erp19, id: 'erp-mdf19-old', actualizado: '2014-01-01', evidencia: { estado: 'propuesto_validado', certificable: false } };
const erp19sinFormato = { ...erp19, id: 'erp-mdf19-sf', formato: null };

describe('gemelo ERP certificable (VH-152)', () => {
  it('misma familia + mismo espesor + misma unidad + formato → gemelo; otro espesor, otra unidad o sin formato → no', () => {
    expect(esGemeloExacto(mdf, erp19)).toBe(true);
    expect(esGemeloExacto(mdf, erp16)).toBe(false);
    expect(esGemeloExacto(mdf, { ...erp19, unidad: 'm2' })).toBe(false);
    expect(esGemeloExacto(mdf, erp19sinFormato)).toBe(false);
    expect(esGemeloExacto(mdf, { ...erp19, id: 'mdf' })).toBe(false);
  });
  it('elige el certificable con compra más reciente; ignora los no certificables', () => {
    expect(mejorGemeloCertificable(mdf, [erp19viejo, erp16, erp19]).id).toBe('erp-mdf19');
    expect(mejorGemeloCertificable(mdf, [erp19viejo])).toBeNull();
  });
  it('propone el gemelo sólo para curados sin precio certificable y sin confirmación humana; conserva el previo para auditoría', async () => {
    const buscar = async () => [erp16, erp19, erp19viejo];
    const comps = [
      { nombre: 'Laterales', insumoId: 'mdf', cantidad: 2 },
      { nombre: 'Puertas', insumoId: 'mdf', material_confirmado: true },
      { nombre: 'Respaldo', insumoId: 'erp-mdf8' },
    ];
    const agregados = [];
    const { comps: r, propuestos } = await proponerGemelosErp(comps, { insumos: { mdf }, buscar, agregarInsumo: (x) => agregados.push(x.id) });
    expect(r[0]).toMatchObject({ insumoId: 'erp-mdf19', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', cantidad: 2 });
    expect(r[0]._match).toMatchObject({ gemelo: true, erp: true, previo: 'mdf' });
    expect(r[1].insumoId).toBe('mdf');
    expect(r[2].insumoId).toBe('erp-mdf8');
    expect(propuestos).toEqual([{ nombre: 'Laterales', previo: 'mdf', id: 'erp-mdf19', insumoNombre: erp19.nombre, precio: 431.04, precioPrevio: 437 }]);
    expect(agregados).toEqual(['erp-mdf19']);
    expect(consultaGemelo(mdf)).toBe('mdf 19 mm');
  });
  it('si el curado ya es certificable, no se toca', async () => {
    const { propuestos } = await proponerGemelosErp([{ nombre: 'X', insumoId: 'mdf' }], { insumos: { mdf: { ...mdf, evidencia: { certificable: true } } }, buscar: async () => [erp19] });
    expect(propuestos).toEqual([]);
  });
  it('fusión tardía: sólo si la pieza sigue con el mismo curado y sin confirmación humana', () => {
    const prop = { nombre: 'Laterales', insumoId: 'erp-mdf19', candidate_insumo_id: 'erp-mdf19', material_match: 'SAME_FAMILY_COMPATIBLE_PROPOSED', _match: { gemelo: true, previo: 'mdf' } };
    expect(fusionarGemelosEnBom([{ nombre: 'Laterales', insumoId: 'mdf', cantidad: 3 }], [prop])[0]).toMatchObject({ insumoId: 'erp-mdf19', cantidad: 3 });
    expect(fusionarGemelosEnBom([{ nombre: 'Laterales', insumoId: 'melamina-16' }], [prop])[0].insumoId).toBe('melamina-16');
    expect(fusionarGemelosEnBom([{ nombre: 'Laterales', insumoId: 'mdf', material_confirmado: true }], [prop])[0].insumoId).toBe('mdf');
  });
});

describe('piezas con tamaño de hoja (VH-151)', () => {
  it('detecta 1220×2440 (girada o no) y piezas que exceden el formato; deja pasar piezas reales', () => {
    const r = piezasConTamanoDeHoja([
      { nombre: 'Chapa caras vistas', insumoId: 'chapa', largoMM: 1220, anchoMM: 2440 },
      { nombre: 'Lateral', insumoId: 'chapa', largoMM: 650, anchoMM: 450 },
      { nombre: 'Cubierta larga', insumoId: 'chapa', largoMM: 2600, anchoMM: 450 },
      { nombre: 'Sin insumo pero hoja', largoMM: 2440, anchoMM: 1220 },
    ], { chapa: { formato: FMT } });
    expect(r.map((x) => [x.nombre, x.motivo])).toEqual([['Chapa caras vistas', 'TAMANO_HOJA'], ['Cubierta larga', 'EXCEDE_FORMATO'], ['Sin insumo pero hoja', 'TAMANO_HOJA']]);
  });
});
