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
