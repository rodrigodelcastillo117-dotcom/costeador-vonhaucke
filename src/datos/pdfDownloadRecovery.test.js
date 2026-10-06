import {describe,it,expect,vi,afterEach} from 'vitest';
import {jsPDF} from 'jspdf/dist/jspdf.es.min.js';
import {descargarPropuesta} from './pdfPropuesta.js';

afterEach(()=>vi.restoreAllMocks());

function datos(borrador=false){
  return {
    cot:{cliente:'Cliente QA',folio:'QA-001',fecha:'2026-10-06',acomodo:null},
    partidas:[],
    resumen:[],
    especificacion:()=> '',
    totales:{
      precioLista:0,descuento:0,descuentoPct:0,subtotal:0,
      contingencia:0,contingenciaPct:0,maniobras:0,maniobrasPct:0,
      flete:0,fletePct:0,iva:0,ivaPct:16,total:0,anticipoPct:50,anticipo:0,
    },
    nPzas:0,fotos:{},piezas:[],cuartos:[],marca:null,borrador,
  };
}

describe('descarga PDF real',()=>{
  it('llama save() con un archivo .pdf definitivo',()=>{
    const save=vi.spyOn(jsPDF.API,'save').mockImplementation(()=>{});
    const nombre=descargarPropuesta(datos(false));
    expect(nombre).toBe('Propuesta QA-001 Cliente QA.pdf');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('Propuesta QA-001 Cliente QA.pdf');
  });

  it('un documento no emitido se descarga como BORRADOR',()=>{
    const save=vi.spyOn(jsPDF.API,'save').mockImplementation(()=>{});
    const nombre=descargarPropuesta(datos(true));
    expect(nombre).toBe('BORRADOR Propuesta QA-001 Cliente QA.pdf');
    expect(save).toHaveBeenCalledWith('BORRADOR Propuesta QA-001 Cliente QA.pdf');
  });
});
