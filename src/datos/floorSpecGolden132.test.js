import { describe, it, expect } from 'vitest';
import { buildFloorSpec, evaluateGolden132 } from '../../supabase/functions/leer-plano/floor-spec.js';

const goldenLectura = {
  documento:{codigo:'QA-COT-01',revision:'B',unidades:'mm',paginas_utiles:[1,2]},
  envolvente:{ancho:15000,largo:8800},
  grid:{horizontal:[3300,7200,4500],vertical:[8800]},
  areas:[
    {nombre:'ARCHIVO / APOYO',tipo:'servicio',forma:'poligono',puntos:[{x:0,y:0},{x:3300,y:0},{x:3300,y:2727},{x:0,y:2727}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'COLABORACION',tipo:'lounge',forma:'poligono',puntos:[{x:0,y:2727},{x:3300,y:2727},{x:3300,y:5273},{x:0,y:5273}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'RECEPCION',tipo:'recepcion',forma:'poligono',puntos:[{x:0,y:5273},{x:3300,y:5273},{x:3300,y:8000},{x:0,y:8000}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'OPEN SPACE',tipo:'open',forma:'poligono',puntos:[{x:3300,y:0},{x:10500,y:0},{x:10500,y:8800},{x:3300,y:8800}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:8,confianza:'alta'},
    {nombre:'COFFEE / PRINT',tipo:'servicio',forma:'poligono',puntos:[{x:10500,y:0},{x:15000,y:0},{x:15000,y:2500},{x:10500,y:2500}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'DIRECCION',tipo:'privado',forma:'poligono',puntos:[{x:10500,y:2500},{x:15000,y:2500},{x:15000,y:5500},{x:10500,y:5500}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:0,confianza:'alta'},
    {nombre:'SALA DE JUNTAS',tipo:'juntas',forma:'poligono',puntos:[{x:10500,y:5500},{x:15000,y:5500},{x:15000,y:8611},{x:10500,y:8611}],circulo:{cx:0,cy:0,r:0},dentroDe:'',puestos:0,confianza:'alta'},
  ],
  muros:[
    {x1:0,y1:0,x2:15000,y2:0,tipo:'exterior',confianza:'alta'},{x1:15000,y1:0,x2:15000,y2:8800,tipo:'exterior',confianza:'alta'},
    {x1:15000,y1:8800,x2:0,y2:8800,tipo:'exterior',confianza:'alta'},{x1:0,y1:8800,x2:0,y2:0,tipo:'exterior',confianza:'alta'},
    {x1:3300,y1:0,x2:3300,y2:8800,tipo:'interior',confianza:'alta'},{x1:10500,y1:0,x2:10500,y2:8800,tipo:'interior',confianza:'alta'},
    {x1:0,y1:2727,x2:3300,y2:2727,tipo:'interior',confianza:'alta'},{x1:0,y1:5273,x2:3300,y2:5273,tipo:'interior',confianza:'alta'},
    {x1:10500,y1:2500,x2:15000,y2:2500,tipo:'interior',confianza:'alta'},{x1:10500,y1:5500,x2:15000,y2:5500,tipo:'interior',confianza:'alta'}
  ],
  puertas:[
    {x:900,y:8800,ancho:900,orientacion:'horizontal',conecta:['exterior','RECEPCION'],confianza:'alta'},
    {x:3300,y:6800,ancho:900,orientacion:'vertical',conecta:['RECEPCION','OPEN SPACE'],confianza:'alta'},
    {x:10500,y:1600,ancho:900,orientacion:'vertical',conecta:['OPEN SPACE','COFFEE / PRINT'],confianza:'alta'},
    {x:10500,y:3900,ancho:900,orientacion:'vertical',conecta:['OPEN SPACE','DIRECCION'],confianza:'alta'},
    {x:10500,y:6900,ancho:900,orientacion:'vertical',conecta:['OPEN SPACE','SALA DE JUNTAS'],confianza:'alta'}
  ],
  ventanas:[],
  cotas:[{valor_mm:15000,etiqueta:'15000',tipo:'general',pagina:1,confianza:'alta'},{valor_mm:8800,etiqueta:'8800',tipo:'general',pagina:1,confianza:'alta'},{valor_mm:3300,etiqueta:'3300',tipo:'eje',pagina:1,confianza:'alta'},{valor_mm:7200,etiqueta:'7200',tipo:'eje',pagina:1,confianza:'alta'},{valor_mm:4500,etiqueta:'4500',tipo:'eje',pagina:1,confianza:'alta'}],
  acabados:[
    {scope:'mobiliario',target:'R-01',categoria:'acabado',valor:'Nogal + solid surface',pagina:2,confianza:'alta'},
    {scope:'mobiliario',target:'B-01',categoria:'acabado',valor:'Melamina clara + metal',pagina:2,confianza:'alta'}
  ],
  equipamiento:[
    {id:'R-01',producto:'Recepcion especial',cantidad:1,ancho_mm:2000,fondo_mm:700,capacidad:0,acabado:'Nogal + solid surface',area:'RECEPCION',confianza:'alta'},
    {id:'B-01',producto:'Bench 2 usuarios',cantidad:4,ancho_mm:2400,fondo_mm:1400,capacidad:2,acabado:'Melamina clara + metal',area:'OPEN SPACE',confianza:'alta'},
    {id:'S-01',producto:'Silla operativa',cantidad:8,ancho_mm:0,fondo_mm:0,capacidad:1,acabado:'Tela gris',area:'OPEN SPACE',confianza:'alta'},
    {id:'J-01',producto:'Mesa juntas',cantidad:1,ancho_mm:3200,fondo_mm:1200,capacidad:8,acabado:'Nogal + metal',area:'SALA DE JUNTAS',confianza:'alta'},
    {id:'SJ-01',producto:'Silla juntas',cantidad:8,ancho_mm:0,fondo_mm:0,capacidad:1,acabado:'Tela negra',area:'SALA DE JUNTAS',confianza:'alta'},
    {id:'D-01',producto:'Escritorio direccion',cantidad:1,ancho_mm:2000,fondo_mm:900,capacidad:1,acabado:'Nogal oscuro',area:'DIRECCION',confianza:'alta'},
    {id:'CR-01',producto:'Credenza',cantidad:1,ancho_mm:1200,fondo_mm:500,capacidad:0,acabado:'Nogal oscuro',area:'DIRECCION',confianza:'alta'},
    {id:'CF-01',producto:'Coffee point',cantidad:1,ancho_mm:3300,fondo_mm:600,capacidad:0,acabado:'Melamina + cubierta clara',area:'COFFEE / PRINT',confianza:'alta'}
  ],
  escala:'1:50 @ A3',tieneCotas:true,notas:[],evidencias:['15000','8800','Open Space = EXACTAMENTE 8 puestos']
};

describe('FloorSpec V2 — golden oficina 132 m²',()=>{
  it('construye FloorSpec con geometría, muros, puertas, cotas y acabados',()=>{
    const f=buildFloorSpec(goldenLectura);
    expect(f.version).toBe('FLOOR_SPEC_V2');
    expect(f.envelope).toEqual({width_mm:15000,depth_mm:8800,area_m2:132});
    expect(f.validation.issues).toEqual([]);
    expect(f.validation.metrics.walls).toBeGreaterThanOrEqual(8);
    expect(f.validation.metrics.doors).toBeGreaterThanOrEqual(4);
    expect(f.validation.metrics.dimensions).toBeGreaterThanOrEqual(5);
    expect(f.validation.metrics.authority_score).toBeGreaterThanOrEqual(.7);
  });
  it('golden gate exige 132 m², 8 puestos y equipamiento exacto',()=>{
    const f=buildFloorSpec(goldenLectura); const q=evaluateGolden132(goldenLectura,f);
    expect(q.pass).toBe(true); expect(q.score).toBe(1);
  });
  it('falla si duplica puestos del Open Space',()=>{
    const bad=structuredClone(goldenLectura); bad.areas.find(a=>a.nombre==='OPEN SPACE').puestos=16;
    const q=evaluateGolden132(bad,buildFloorSpec(bad)); expect(q.pass).toBe(false);
    expect(q.checks.find(c=>c.id==='open_space.workstations').ok).toBe(false);
  });
  it('falla si la envolvente no reproduce 15,000 × 8,800',()=>{
    const bad=structuredClone(goldenLectura); bad.envolvente.ancho=14500;
    const q=evaluateGolden132(bad,buildFloorSpec(bad)); expect(q.pass).toBe(false);
  });
  it('rechaza puerta lejos de cualquier muro',()=>{
    const bad=structuredClone(goldenLectura); bad.puertas[0]={...bad.puertas[0],x:7000,y:4400};
    const f=buildFloorSpec(bad); expect(f.validation.issues.some(x=>x.code==='DOOR_NOT_ON_WALL')).toBe(true);
  });
});
