import {describe,it,expect} from 'vitest';
import {conciliarFuentesCotizador} from './conciliarFuentesCotizador.js';
const ref=(nombre,cantidad,nota='')=>({nombre,cantidad,nota,precioUnitario:5400});
const banco=(nombre,cantidad,nota='')=>({...ref(nombre,cantidad,nota),deBanco:true,precioReal:true});
describe('P0 Cotizar: línea+BANCO no son dos sillas físicas',()=>{
 it('WIN 8 línea + WIN 8 banco → 8, no 16',()=>{
  const r=conciliarFuentesCotizador([ref('Silla operativa WIN',8),banco('Silla operativa · WIN',8)]);
  expect(r.partidas).toHaveLength(1);expect(r.partidas[0].deBanco).toBe(true);
  expect(r.deduplicadas).toHaveLength(1);
 });
 it('ALPHA 1 línea + ALPHA 1 banco → una silla',()=>{
  const r=conciliarFuentesCotizador([ref('Silla directiva ALPHA',1),banco('Silla directiva ALPHA',1)]);
  expect(r.partidas).toHaveLength(1);
 });
 it('CONCERTO 6 de zona juntas y 2 de privado no se descartan',()=>{
  const r=conciliarFuentesCotizador([ref('Silla CONCERTO (visita 4 pts)',6,'Sala de juntas'),
    banco('Silla de visita CONCERTO',2,'Privado')]);
  expect(r.partidas).toHaveLength(2);expect(r.deduplicadas).toHaveLength(0);
 });
 it('dos órdenes reales WIN 8 + WIN 8 no se fusionan',()=>{
  expect(conciliarFuentesCotizador([banco('WIN silla operativa',8),banco('WIN silla operativa',8)]).partidas).toHaveLength(2);
 });
 it('modelo diferente no es la misma silla',()=>{
  expect(conciliarFuentesCotizador([ref('Silla operativa WIN',8),banco('Silla SONATA',8)]).partidas).toHaveLength(2);
 });
 it('recepciones parecidas avisan sin borrarlas ni cambiar precios',()=>{
  const r=conciliarFuentesCotizador([ref('Módulo recepción 2 usuarios',1),banco('Recepción (2420 x 830 mm)',1)]);
  expect(r.partidas).toHaveLength(2);expect(r.ambiguos).toHaveLength(1);
 });
});
