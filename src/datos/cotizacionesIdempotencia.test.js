import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../nube.js',()=>({nube:{rpc:mocks.rpc}}));
import {guardarCotizacion} from './cotizaciones.js';

const estado={
 insumos:{panel:{id:'panel',precio:450,unidad:'hoja',formato:{tipo:'tablero',medida:2.9768}}},
 parametros:{},
 cotizacion:{cliente:'Prueba RPC',folio:'TEST-MISMA-OPERACION',estadoComercial:'borrador',
   partidas:[{id:'p1',nombre:'Mueble',cantidad:1,precioUnitario:4500}]}
};
describe('P1 create idempotent: a lost response must not duplicate quotations',()=>{
 let original;
 beforeEach(()=>{
   mocks.rpc.mockReset();
   original=globalThis.sessionStorage;
   const values=new Map();
   Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
     getItem:(k)=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),
     removeItem:(k)=>values.delete(k),
   }});
 });
 afterEach(()=>Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:original}));
 it('retries after network error with same operation key, then allows a new identical operation',async()=>{
   mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'response lost'}})
     .mockResolvedValueOnce({data:{ok:true,id:9001},error:null})
     .mockResolvedValueOnce({data:{ok:true,id:9002},error:null});
   expect(await guardarCotizacion(estado,'qa@example.com',null)).toBeNull();
   expect(await guardarCotizacion(estado,'qa@example.com',null)).toBe(9001);
   expect(await guardarCotizacion(estado,'qa@example.com',null)).toBe(9002);
   const payloads=mocks.rpc.mock.calls.map(c=>c[1].p_payload);
   expect(mocks.rpc.mock.calls.map(x=>x[0])).toEqual([
     'crear_cotizacion_segura','crear_cotizacion_segura','crear_cotizacion_segura'
   ]);
   expect(payloads[0]._idempotency_key).toBe(payloads[1]._idempotency_key);
   expect(payloads[1]._idempotency_key).not.toBe(payloads[2]._idempotency_key);
   expect(payloads[0].partidas[0].precioUnitario).toBe(4500);
   const stored=globalThis.sessionStorage.getItem('vh-quote-create-pending-v1');
   expect(stored).toBeNull(); // se limpia sólo después del servidor.
 });
 it('only stores an opaque fingerprint in session storage, not customer or part prices',async()=>{
   mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'offline'}});
   await guardarCotizacion(estado,'qa@example.com',null);
   const storage=globalThis.sessionStorage.getItem('vh-quote-create-pending-v1');
   expect(storage).not.toContain('Prueba RPC');
   expect(storage).not.toContain('4500');
   expect(storage).not.toContain('Mueble');
 });
});
