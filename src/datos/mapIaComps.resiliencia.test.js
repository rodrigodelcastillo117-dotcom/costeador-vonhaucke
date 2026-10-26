// Área J · R-03 (causa raíz): una respuesta `ok:true` de analizar-mueble con piezas vacías o mal formadas
// reemplazaba el despiece de la persona por uno vacío (Costeador.jsx · analizarDescripcion) o reventaba con
// "(…).map is not a function". Ver e2e/resiliencia.e2e.js escenario 3.
import { describe, it, expect } from 'vitest';
import { mapIaComps, propuestaConPiezas } from './mapIaComps.js';

describe('propuestaConPiezas / mapIaComps ante basura de la IA', () => {
  it('sin piezas utilizables → false (no se reemplaza el despiece)', () => {
    expect(propuestaConPiezas({ piezas: [] })).toBe(false);
    expect(propuestaConPiezas({ piezas: '[{"nombre":"Cubierta"}]' })).toBe(false);
    expect(propuestaConPiezas({ piezas: [null, 3, 'x', []] })).toBe(false);
    expect(propuestaConPiezas({})).toBe(false);
    expect(propuestaConPiezas(null)).toBe(false);
  });
  it('con al menos una pieza objeto → true', () => {
    expect(propuestaConPiezas({ piezas: [{ nombre: 'Cubierta', largoMM: 1200, anchoMM: 600, cantidad: 1 }] })).toBe(true);
  });
  it('mapIaComps no revienta con piezas en texto y descarta renglones que no son objeto', () => {
    expect(mapIaComps({ piezas: 'basura' })).toEqual([]);
    const r = mapIaComps({ piezas: [null, 'x', { nombre: 'Cubierta', material_solicitado: 'MDF 16 mm', largoMM: 1200, anchoMM: 600, cantidad: 1 }] });
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBe('Cubierta');
  });
});


describe('TELCEL · una cantidad física no se convierte en número de piezas geométricas', () => {
  it('45 kg de lámina 1200×600 NO se vuelven 45 paneles; queda 1 pieza + REVIEW_REQUIRED', async () => {
    const { INSUMOS_SEMILLA, mapaInsumos } = await import('./insumos.js');
    const insumos = mapaInsumos(INSUMOS_SEMILLA);
    const [c] = mapIaComps({ piezas: [{
      nombre: 'Cuerpo/gabinete lámina cal.18',
      insumoId: 'lamina-18',
      material_solicitado: 'Lámina de acero cal. 18',
      forma: 'pieza',
      largoMM: 1200,
      anchoMM: 600,
      cantidad: 45,
      unidad: 'kg',
    }] }, insumos);
    expect(c.forma).toBe('area');
    expect(c.piezas).toBe(1);
    expect(c.iaCantidadFisica).toEqual({ valor: 45, unidad: 'kg' });
    expect(c.iaIncoherencia).toMatchObject({ campo: 'cantidadPiezas', dice: 45, puso: 1, unidad: 'kg' });
  });

  it('la regla de pintura usa la geometría una vez: 1200×600×2 caras = 1.44 m², no 64.8 m²', async () => {
    const { INSUMOS_SEMILLA, mapaInsumos } = await import('./insumos.js');
    const { conAcompanantes } = await import('./autoInsumos.js');
    const insumos = mapaInsumos(INSUMOS_SEMILLA);
    const comps = mapIaComps({ piezas: [{
      nombre: 'Cuerpo/gabinete lámina cal.18',
      insumoId: 'lamina-18',
      material_solicitado: 'Lámina de acero cal. 18',
      material_confirmado: true,
      forma: 'pieza',
      largoMM: 1200,
      anchoMM: 600,
      cantidad: 45,
      unidad: 'kg',
    }] }, insumos);
    const r = conAcompanantes(comps, insumos);
    const pintura = r.find((c) => c && c._regla === 'pintura');
    expect(pintura).toBeTruthy();
    expect(pintura.areaPintadaM2).toBe(1.44);
    expect(pintura.areaPintadaM2).not.toBe(64.8);
  });
});
