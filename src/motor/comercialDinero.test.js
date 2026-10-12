import {describe,it,expect} from 'vitest';
import {precioConDescuento,importePorCantidad,cargoPorcentaje,sumarMontos} from './comercialDinero.js';

describe('dinero comercial a centavos',()=>{
 it('descuento conserva centavos',()=>expect(precioConDescuento(1234.56,12.5)).toBe(1080.24));
 it('cantidad multiplica desde precio ya cuantizado',()=>expect(importePorCantidad(10.01,3)).toBe(30.03));
 it('IVA/servicios quedan a centavos',()=>expect(cargoPorcentaje(96351.92,16)).toBe(15416.31));
 it('suma acumulando centavos, no floats',()=>expect(sumarMontos([0.1,0.2,10.01])).toBe(10.31));
});
