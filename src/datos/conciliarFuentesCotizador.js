// Cotizar: reconcilia DOS fuentes económicas de UN MISMO artículo físico.
// Nunca sumar "referencia de línea" + "precio de banco" si ambas describen
// la misma silla, misma cantidad y misma zona. Distintas cantidades/zona/modelo
// quedan intactos (pueden ser pedidos legítimos de áreas diferentes).
const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const modelos=['CONCERTO','SONATA','ALPHA','WIN','DEX','GAMMA','ENERGY'];
const modelo=(p)=>{const t=norm(p?.nombre);return modelos.find(x=>new RegExp('\\b'+x.toLowerCase()+'\\b').test(t))||null;};
const zona=(p)=>{
 const t=norm([p?.zonaSugerida,p?.zone_id,p?.nota].filter(Boolean).join(' '));
 if(/junta|consejo|meeting|sala de reunion/.test(t))return 'juntas';
 if(/privad|direccion|directiv|ejecutiv/.test(t))return 'privado';
 if(/bench|operativ|open|puesto/.test(t))return 'operativo';
 if(/recepcion|espera/.test(t))return 'recepcion';
 return null;
};
const cantidad=(p)=>{const n=Number(p?.cantidad);return Number.isInteger(n)&&n>0?n:null;};
const banco=(p)=>p?.deBanco===true;
const tipos = (p)=> {
 const t=norm(p?.nombre);
 if(/silla|sillon|asiento/.test(t))return 'silla';
 return null;
};
export function conciliarFuentesCotizador(partidas=[]) {
 const lista=Array.isArray(partidas)?partidas:[];
 const ignorar=new Set(),deduplicadas=[],avisos=[];
 for(let i=0;i<lista.length;i++)for(let j=i+1;j<lista.length;j++){
  const a=lista[i],b=lista[j];
  if(ignorar.has(i)||ignorar.has(j)||!a||!b)continue;
  if(banco(a)===banco(b))continue; // dos bancos/escenarios diferentes NO se fusionan
  const q1=cantidad(a),q2=cantidad(b),m1=modelo(a),m2=modelo(b);
  if(!q1||q1!==q2||!m1||m1!==m2||tipos(a)!=='silla'||tipos(b)!=='silla')continue;
  const z1=zona(a),z2=zona(b);
  if(z1&&z2&&z1!==z2)continue; // misma silla para DOS ZONAS DISTINTAS, conservar
  // Solo puede descartarse la REFERENCIA si la otra trae precio de BANCO; nunca
  // descartar una compra REAL, ni sustituir medida, acabado o producto especial.
  const iEliminar=banco(a)?j:i;
  const representante=banco(a)?a:b;
  const referencial=lista[iEliminar];
  if(referencial?.material_override||referencial?.acabadoDiferente||referencial?.candadoUsuarios)continue;
  ignorar.add(iEliminar);
  deduplicadas.push({cantidad:q1,modelo:m1,
   conservado:representante.nombre,descartado:referencial.nombre,
   motivo:'La IA pidió el mismo modelo y cantidad de silla en línea y banco; se conserva la referencia firme.'});
 }
 const partidasLimpias=lista.filter((_,i)=>!ignorar.has(i));
 const ambiguos=[];
 // Productos de ancla distintos que podrían ocupar el MISMO lugar NO se
 // eliminan a ciegas. Aviso accionable en lugar de "14 confirmados" engañoso.
 const usoRecepcion=partidasLimpias.filter(p=>/recepcion|mostrador/i.test(norm(p.nombre)));
 if(usoRecepcion.length>1)ambiguos.push('Hay más de un mostrador/recepción. Verifica si son piezas distintas antes de acomodar.');
 return {partidas:partidasLimpias,deduplicadas,ambiguos,avisos};
}
