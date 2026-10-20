// P1-MAT-02 (cierre ChatGPT v3, 2026-10-20): UNA taxonomía de acabados para motor (materialMatch) y validador
// estructural (revisionEstructural). Antes "Barniz de acabado sobre chapa" se clasificaba chapa_madera por la palabra
// "chapa"; el validador sí lo veía como acabado y bloqueaba: dos taxonomías distintas. Regla: el OBJETO principal manda;
// el acabado es familia propia cuando el renglón ES el acabado.
import { describe, it, expect } from 'vitest';
import { familiaDeMaterial, FAMILIAS_ACABADO, aplicarPoliticaMaterial, reconciliarMaterialServidor } from './materialMatch.js';
import { revisarEstructura } from './revisionEstructural.js';

describe('familiaDeMaterial: acabado vs objeto principal', () => {
  const casos = [
    ['Barniz de acabado sobre chapa', 'acabado_liquido'],
    ['Barniz', 'acabado_liquido'],
    ['Barniz PU mate sobre chapa', 'acabado_liquido'],
    ['Sellador para madera', 'acabado_liquido'],
    ['Laca negra sobre MDF', 'acabado_liquido'],
    ['Esmalte blanco', 'acabado_liquido'],
    ['Tinte nogal para chapa', 'acabado_liquido'],
    ['Poliuretano mate (acabado)', 'acabado_liquido'],
    ['MDF lacado', 'mdf'],
    ['MDF 18 mm lacado blanco', 'mdf'],
    ['Chapa de nogal barnizada', 'chapa_madera'],
    ['Pintura electrostática negra para PTR', 'pintura_polvo'],
    ['PTR pintado negro', 'metal_lamina'],
    ['Cromado de la base', 'acabado_metal'],
  ];
  it.each(casos)('%s → %s', (t, fam) => expect(familiaDeMaterial(t)).toBe(fam));
  it('el poliuretano de la espuma NO es acabado', () => {
    expect(familiaDeMaterial('Espuma de poliuretano D30')).not.toBe('acabado_liquido');
    expect(familiaDeMaterial('Poliuretano flexible 5 cm')).not.toBe('acabado_liquido');
  });
  it('un objeto "con barniz" sin material base no se adivina (queda pendiente)', () => {
    expect(familiaDeMaterial('Mesa con barniz')).toBe('');
  });
  it('las familias de acabado son un conjunto único exportado', () => {
    expect([...FAMILIAS_ACABADO].sort()).toEqual(['acabado_liquido', 'acabado_metal', 'pintura_polvo']);
  });
});

// Catálogo real (consulta de solo lectura 2026-10-20): id "barniz", nombre "Barniz", unidad_costeo m2.
const cat = {
  barniz: { id: 'barniz', nombre: 'Barniz', seccion: 'acabados', clasificacion: 'vigente', unidad: 'm2', precio: 100 },
  'chapa-madera': { id: 'chapa-madera', nombre: 'Chapa de madera (sabana natural)', seccion: 'tableros', clasificacion: 'vigente', unidad: 'm2', precio: 300 },
};
const resolver = (id) => cat[id];

describe('selección real de "Barniz" del catálogo: sin cruce de familia falso (cliente = servidor)', () => {
  const renglon = { nombre: 'Barniz de acabado sobre chapa', insumoId: 'barniz', material_solicitado: 'chapa nogal mate', material_confirmado: true, cantidad: 3 };
  it('cliente (política) confirma el barniz', () => {
    const r = aplicarPoliticaMaterial(renglon, resolver, Object.values(cat));
    expect(r.insumoId).toBe('barniz');
    expect(r.material_match).toBe('USER_CONFIRMED');
    expect(r.material_solicitado).toBe('chapa nogal mate');
  });
  it('servidor (reconciliación autoritativa) llega a lo MISMO', () => {
    const r = reconciliarMaterialServidor(renglon, resolver, Object.values(cat), { puedeConfirmar: true });
    expect(r.insumoId).toBe('barniz');
    expect(r.material_match).toBe('USER_CONFIRMED');
  });
  it('el validador estructural NO bloquea el barniz costeado con barniz', () => {
    const { observaciones } = revisarEstructura({ componentes: [{ ...renglon }], insumos: cat, descripcion: '' });
    expect(observaciones.filter((o) => o.regla === 'material_funcion')).toEqual([]);
  });
  it('y SÍ bloquea el barniz costeado con chapa (cobraría material)', () => {
    const { observaciones } = revisarEstructura({ componentes: [{ ...renglon, insumoId: 'chapa-madera' }], insumos: cat, descripcion: '' });
    expect(observaciones.some((o) => o.regla === 'material_funcion' && o.nivel === 'blocker')).toBe(true);
  });
});

// Regresión real: cocrear-3 (recepción curva, run 39417119157 intento 1). La IA mandó "Barniz PU mate sobre chapa"
// con lo pedido sobre la chapa; el renglón terminó costeado como Chapa de madera y el servidor lo bloqueó.
describe('regresión cocrear-3: barniz sobre chapa', () => {
  it('sin confirmación, la política NO autollena el barniz con chapa', () => {
    const r = aplicarPoliticaMaterial({ nombre: 'Barniz PU mate sobre chapa', insumoId: '', material_solicitado: 'chapa de madera natural', cantidad: 4 }, resolver, Object.values(cat));
    expect(r.insumoId).not.toBe('chapa-madera');
  });
});

// Cierre v3 (cocrear-7): nombre ERP "<artículo> · <nota>" y accesorio nombrado primero.
describe('familia del artículo ERP y del accesorio nombrado primero', () => {
  it('Silestone del ERP con nota "· ACRILICO" es piedra (no acrílico)', () => {
    expect(familiaDeMaterial('HOJA DE ECOMARMOL SILESTONE DE 3220 X 1580 X 12 mm - "SILESTONE321512" · ACRILICO, ECOMARMOL MARQUINA')).toBe('marmol_piedra');
  });
  it('una nota sin familia no estorba y un artículo sin familia toma la de la nota', () => {
    expect(familiaDeMaterial('Melamina 16 mm · Walnut')).toBe('melamina');
    expect(familiaDeMaterial('HOJA 3220 X 1580 · MELAMINA BLANCA')).toBe('melamina');
  });
  it('"Tornillería y silicón estructural" es tornillería; "Silicón y tornillería" es adhesivo', () => {
    expect(familiaDeMaterial('Tornillería y silicón estructural')).toBe('tornilleria');
    expect(familiaDeMaterial('Silicón y tornillería')).toBe('adhesivo');
  });
  it('la confirmación de Diseño del Silestone y de la tornillería se honran en el servidor', () => {
    const c2 = {
      'erp-silestone321512-y19': { id: 'erp-silestone321512-y19', nombre: 'HOJA DE ECOMARMOL SILESTONE DE 3220 X 1580 X 12 mm - "SILESTONE321512" · ACRILICO, ECOMARMOL MARQUINA', unidad: 'hoja', precio: 24283.09 },
      tornilleria: { id: 'tornilleria', nombre: 'Tornilleria', unidad: 'jgo', precio: 45 },
    };
    const r1 = reconciliarMaterialServidor({ nombre: 'Cubierta de cuarzo 1800x600', insumoId: 'erp-silestone321512-y19', material_solicitado: 'Cuarzo (aglomerado de cuarzo tipo Silestone) 20 mm', material_confirmado: true, cantidad: 1 }, (id) => c2[id], Object.values(c2), { puedeConfirmar: true });
    const r2 = reconciliarMaterialServidor({ nombre: 'Tornillería de ensamble cubierta-base', insumoId: 'tornilleria', material_solicitado: 'Tornillería y silicón estructural', material_confirmado: true, cantidad: 1 }, (id) => c2[id], Object.values(c2), { puedeConfirmar: true });
    expect([r1.material_match, r2.material_match]).toEqual(['USER_CONFIRMED', 'USER_CONFIRMED']);
  });
});

describe('cierre v3 · lo que va "bajo/sobre" es contexto, no el material', () => {
  it.each([
    ['MDF 19 mm (sustrato de refuerzo bajo piedra)', 'mdf'],
    ['Chapa de nogal sobre MDF', 'chapa_madera'],
    ['Laca negra sobre MDF', 'acabado_liquido'],
    ['Barniz de acabado sobre chapa', 'acabado_liquido'],
    ['Melamina sobre estructura metálica', 'melamina'],
    ['Cubierta de piedra sobre base de MDF', 'marmol_piedra'],
  ])('%s → %s', (t, fam) => expect(familiaDeMaterial(t)).toBe(fam));
});
