import { calcular } from '../src/motor/calculo.js';
const INS = {
  metal:  { id:'metal',  nombre:'Metal fabricado', clase:'directa', seccion:'metal', precio:100, unidad:'kg' },
  bari:   { id:'bari',   nombre:'Multicontactos Bari', clase:'indirecta', seccion:'electrico', precio:887, unidad:'pza' },
  pintura:{ id:'pintura',nombre:'Pintura', clase:'indirecta', seccion:'acabados', precio:200, unidad:'kg' },
};
const pieza = {
  modoManoObra:'porcentaje', factorDirecta:55, factorIndirecta:12,
  componentes: [
    { insumoId:'metal', cantidad:50 },     // $5000 fabricado -> 55% MO = 2750
    { insumoId:'bari', cantidad:2 },       // $1774 comprado (electrico) -> 0 MO (antes 12% = 213)
    { insumoId:'pintura', cantidad:1 },    // $200 acabado -> 12% MO = 24 (sigue llevando MO)
  ],
};
const r = calcular(pieza, 1, INS);
console.log('materialDirecto', r.materialDirecto, 'materialIndirecto', r.materialIndirecto);
console.log('manoObra', r.manoObra.toFixed(2), '(esperado 2750 + 0(bari) + 24(pintura) = 2774)');
