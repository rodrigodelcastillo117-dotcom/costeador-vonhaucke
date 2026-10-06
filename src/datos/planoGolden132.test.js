import { describe,it,expect } from 'vitest';
import { areasDeLectura, revisarAreas } from './planoLeido.js';

const golden = {
  envolvente:{ancho:15000,largo:8800},
  areas:[
    {nombre:'ARCHIVO / APOYO',tipo:'servicio',forma:'poligono',puntos:[{x:0,y:0},{x:3300,y:0},{x:3300,y:2727},{x:0,y:2727}],dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'COLABORACION',tipo:'lounge',forma:'poligono',puntos:[{x:0,y:2727},{x:3300,y:2727},{x:3300,y:5273},{x:0,y:5273}],dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'RECEPCION',tipo:'recepcion',forma:'poligono',puntos:[{x:0,y:5273},{x:3300,y:5273},{x:3300,y:8000},{x:0,y:8000}],dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'OPEN SPACE',tipo:'open',forma:'poligono',puntos:[{x:3300,y:0},{x:10500,y:0},{x:10500,y:8800},{x:3300,y:8800}],dentroDe:'',puestos:8,confianza:'alta'},
    {nombre:'COFFEE / PRINT',tipo:'servicio',forma:'poligono',puntos:[{x:10500,y:0},{x:15000,y:0},{x:15000,y:2500},{x:10500,y:2500}],dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'DIRECCION',tipo:'privado',forma:'poligono',puntos:[{x:10500,y:2500},{x:15000,y:2500},{x:15000,y:5500},{x:10500,y:5500}],dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'SALA DE JUNTAS',tipo:'juntas',forma:'poligono',puntos:[{x:10500,y:5500},{x:15000,y:5500},{x:15000,y:8611},{x:10500,y:8611}],dentroDe:'',puestos:0,confianza:'alta'},
  ],
  puertas:[
    {x:900,y:8800,ancho:900,confianza:'alta'},
    {x:3300,y:6800,ancho:900,confianza:'alta'},
    {x:10500,y:1600,ancho:900,confianza:'alta'},
    {x:10500,y:3900,ancho:900,confianza:'alta'},
    {x:10500,y:6900,ancho:900,confianza:'alta'}
  ],
  tieneCotas:true,
};

describe('golden plano QA-COT-01 · 132 m²',()=>{
  it('mantiene envolvente y semántica de 8 puestos sin duplicarlos',()=>{
    expect((golden.envolvente.ancho*golden.envolvente.largo)/1e6).toBe(132);
    const {areas}=areasDeLectura(golden);
    expect(areas).toHaveLength(7);
    const open=areas.find(a=>a.nombre==='OPEN SPACE');
    expect(open?.puestos).toBe(8);
    expect(areas.filter(a=>a.puestos>0).reduce((s,a)=>s+a.puestos,0)).toBe(8);
  });

  it('preserva las cinco puertas como evidencia espacial',()=>{
    const {areas,puertas}=areasDeLectura(golden);
    expect(puertas).toHaveLength(5);
    expect(areas.some(a=>(a.puertas||[]).length>0)).toBe(true);
  });

  it('no reporta cuartos fuera de envolvente ni solapes estructurales',()=>{
    const problemas=revisarAreas(golden);
    expect(problemas.filter(x=>/salen del contorno|se enciman|diminuto|enorme|astilla/i.test(x))).toEqual([]);
  });

  it('detecta regresión de escala cuando la envolvente ya no corresponde',()=>{
    const bad=structuredClone(golden);
    bad.envolvente.ancho=10000;
    expect(revisarAreas(bad).some(x=>/se salen del contorno/i.test(x))).toBe(true);
  });
});
