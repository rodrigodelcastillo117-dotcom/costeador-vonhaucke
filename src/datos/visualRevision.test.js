import {describe,it,expect} from 'vitest';
import {visualRevisionHash,visualesSincronizados} from './visualRevision.js';

const spec={familia:'mesa',dimensiones:{ancho_mm:1200,prof_mm:600,alto_mm:750},materiales:[{material:'nogal'}],acabados:[],caracteristicas:['curva'],capacidad:{personas:4},componentes:[{id:'c1',nombre:'Cubierta',largoMM:1200,anchoMM:600,espesorMM:25,piezas:1}]};

describe('visual revision signature',()=>{
 it('same visual truth => same signature',()=>expect(visualRevisionHash(spec)).toBe(visualRevisionHash(structuredClone(spec))));
 it('geometry/material/BOM changes invalidate signature',()=>{
   for(const s of [
    {...spec,dimensiones:{...spec.dimensiones,ancho_mm:1300}},
    {...spec,materiales:[{material:'roble'}]},
    {...spec,componentes:[{...spec.componentes[0],largoMM:1300}]},
   ]) expect(visualRevisionHash(s)).not.toBe(visualRevisionHash(spec));
 });
 it('engineering metadata alone does not create false visual change',()=>{
   expect(visualRevisionHash({...spec,engineering_validated:true})).toBe(visualRevisionHash(spec));
 });
 it('detects stale render/model independently',()=>{
   const h=visualRevisionHash(spec);
   expect(visualesSincronizados({spec,render:{visualRevisionHash:h},model3d:{visualRevisionHash:h}}).synchronized).toBe(true);
   expect(visualesSincronizados({spec,render:{visualRevisionHash:'old'},model3d:{visualRevisionHash:h}}).synchronized).toBe(false);
 });
});


 it('concepto/layout distinto invalida firma aunque dimensiones/materiales coincidan',()=>{
   const base={...spec,concepto:'A',layout_conceptual:'isla',tipologia_cocrear:'operativo_colaborativo'};
   expect(visualRevisionHash({...base,concepto:'B'})).not.toBe(visualRevisionHash(base));
   expect(visualRevisionHash({...base,layout_conceptual:'modulos'})).not.toBe(visualRevisionHash(base));
 });
