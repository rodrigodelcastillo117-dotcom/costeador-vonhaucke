import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {nombreArchivoPropuesta} from './pdfPropuesta.js';

function datos(borrador=false){
  return {
    cot:{cliente:'Cliente QA',folio:'QA-001',fecha:'2026-10-06',acomodo:null},
    partidas:[],borrador,
  };
}

describe('descarga PDF real',()=>{
  it('nombra el archivo definitivo correctamente',()=>{
    expect(nombreArchivoPropuesta(datos(false))).toBe('Propuesta QA-001 Cliente QA.pdf');
  });

  it('un documento no emitido queda inequívocamente como BORRADOR',()=>{
    expect(nombreArchivoPropuesta(datos(true))).toBe('BORRADOR Propuesta QA-001 Cliente QA.pdf');
  });

  it('la implementación descarga el jsPDF con save() y devuelve el mismo nombre',()=>{
    const s=fs.readFileSync('src/datos/pdfPropuesta.js','utf8');
    const i=s.indexOf('export function descargarPropuesta');
    const b=s.slice(i,i+1800);
    expect(b).toContain('const archivo = nombreArchivoPropuesta(datos)');
    expect(b).toContain('doc.save(archivo)');
    expect(b).toContain('return archivo');
    expect(b).toContain('if (datos.borrador) marcarBorrador(doc)');
  });
});
