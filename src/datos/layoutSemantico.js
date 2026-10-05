// Motor semantico de layout. La geometria decide si CABE; este modulo decide DONDE PERTENECE.
// Puro y determinista: mismo input => mismo orden de areas/candidatos.
import { zonaSemantica, zonaPermite, rolDePiezaAcomodo } from './floorSpec.js';

const norm = (s='') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export function clasePieza(p={}) {
  const t = norm(`${p.tipo||''} ${p.nombre||''} ${p.semantic_role||''}`);
  if (/recep|mostrador/.test(t)) return 'recepcion';
  if (/mesa.*junta|consejo|board|meeting/.test(t)) return 'juntas';
  if (/silla.*junta|meeting.*seat/.test(t)) return 'silla_juntas';
  if (/silla.*direct|executive.*seat/.test(t)) return 'silla_directiva';
  if (/silla|asiento|chair|seat/.test(t)) return 'silla_operativa';
  if (/bench|workstation|estacion|escritorio|desk/.test(t)) return 'puesto';
  if (/credenza|archiv|guarda|storage|pedestal/.test(t)) return 'guarda';
  return 'otro';
}

const preferencia = {
  recepcion: ['RECEPCION','GENERICA'],
  juntas: ['SALA_CONSEJO','GENERICA'],
  silla_juntas: ['SALA_CONSEJO','GENERICA'],
  silla_directiva: ['OFICINA_CEO','GENERICA'],
  silla_operativa: ['AREA_OPERATIVA','OFICINA_CEO','GENERICA'],
  puesto: ['AREA_OPERATIVA','OFICINA_CEO','GENERICA'],
  guarda: ['OFICINA_CEO','AREA_OPERATIVA','GENERICA'],
  otro: ['GENERICA','AREA_OPERATIVA','OFICINA_CEO','SALA_CONSEJO','RECEPCION'],
};

export function ordenarAreasParaPieza(pieza, areas=[]) {
  const rol = rolDePiezaAcomodo(pieza);
  const pref = preferencia[clasePieza(pieza)] || preferencia.otro;
  return areas.map((a,i)=>({i,z:zonaSemantica(a?.nombre||''),a}))
    .filter(x => zonaPermite(rol, x.z))
    .sort((x,y)=>{
      const ax=pref.indexOf(x.z), ay=pref.indexOf(y.z);
      const px=ax<0?999:ax, py=ay<0?999:ay;
      if(px!==py) return px-py;
      const sx=(Number(x.a?.ancho)||0)*(Number(x.a?.largo)||0);
      const sy=(Number(y.a?.ancho)||0)*(Number(y.a?.largo)||0);
      return sy-sx || x.i-y.i;
    }).map(x=>x.i);
}

export function prepararPiezasSemanticas(piezas=[], areas=[]) {
  return piezas.map(p=>({ ...p, _areasPreferidas: ordenarAreasParaPieza(p,areas), _claseLayout: clasePieza(p) }));
}
