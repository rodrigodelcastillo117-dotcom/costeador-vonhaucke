import { describe, expect, it } from 'vitest';
import { catalogoDeSugerencias } from './catalogoDeSugerencias.js';

describe('catálogo Compras visible pero no certifica precios', () => {
  it('insumo activo gana sobre catálogo de Compras, sin sustituir dinero ni unidad', () => {
    const r = catalogoDeSugerencias({ptr:{id:'ptr',nombre:'Tubo / PTR',precio:42,unidad:'m'}},[
      {id:'ptr',nombre:'PTR real 1x2',activo:true,unidad_costeo:'tramo'},
      {id:'ptr-3-14',nombre:'PTR 3 x 1.5 cal 14',activo:true,unidad_costeo:'m'},
    ]);
    expect(r.ptr.precio).toBe(42);
    expect(r.ptr.unidad).toBe('m');
    expect(r['ptr-3-14'].disponibleCosteo).toBe(false);
    expect(r['ptr-3-14'].precio).toBeUndefined();
  });
  it('inactivos y datos inválidos se excluyen', () => {
    const r = catalogoDeSugerencias({},[{id:'x',nombre:'X',activo:false},{nombre:'?',activo:true}]);
    expect(Object.keys(r)).toEqual([]);
  });
});
