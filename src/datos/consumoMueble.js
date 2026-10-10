// Auditoría dimensional para TODO mueble (manual/IA/plano). Sólo interpreta
// geometría observada; los importes provienen del motor autoritativo.
// m² DESARROLLADOS de piezas, no m² de superficie de piso del mueble.
// Nunca confundir precio/kg, precio/hoja o precio/pieza con precio por m².
const positivo=(v)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const enteroPos=(v)=>{const x=positivo(v);return x!=null&&Number.isInteger(x)?x:null};
const areaMaterial=(i,c)=>i?.unidad==='m2'||i?.formato?.tipo==='tablero'||i?.formato?.tipo==='lamina'||c?.forma==='area';
const areaFormato=(i)=>{
  const f=i?.formato;
  if(positivo(f?.largoMM)&&positivo(f?.anchoMM))return Number(f.largoMM)*Number(f.anchoMM)/1e6;
  if(f?.tipo==='tablero'&&positivo(f.medida))return Number(f.medida);
  return null;
};
export function auditarConsumoMueble({componentes=[],insumos={},lote=1,resultado=null}={}) {
 const piezas=Array.isArray(componentes)?componentes:[];
 const n=enteroPos(lote),grupos=new Map(),pendientes=[],renglones=[];
 if(!n)return {valido:false,areaNetaM2:0,grupos:[],renglones:[],pendientes:['Lote: cantidad inválida'],totales:null};
 const costeoPorId=new Map((resultado?.detalleInsumos||[]).map(d=>[d.insumoId,d]));
 let areaNetaM2=0;
 for(let k=0;k<piezas.length;k++){
  const c=piezas[k];if(!c||c.excluida)continue;
  const ins=insumos?.[c.insumoId];
  const nombre=String(c.nombre||ins?.nombre||'Componente '+(k+1));
  if(!ins){pendientes.push(nombre+': falta insumo vinculado');continue}
  const unidades=enteroPos(c.piezas??(c.forma==='area'?c.cantidad:1)??1);
  const formaArea=areaMaterial(ins,c);
  if(!formaArea)continue; // los metros lineales, soldadura, tornillería NO son m²
  let area=null,tipo='';
  const largo=positivo(c.largoMM),ancho=positivo(c.anchoMM);
  if(!unidades){pendientes.push(nombre+': cantidad de piezas no válida');continue}
  if(largo&&ancho){area=largo*ancho*unidades*n/1e6;tipo='COTAS';}
  else if(positivo(c.hojas)&&areaFormato(ins)){
    area=Number(c.hojas)*areaFormato(ins)*n;tipo='HOJAS_FORMATO';
  } else if(ins.unidad==='m2'&&c.forma!=='area'&&positivo(c.cantidad)){
    area=Number(c.cantidad)*n;tipo='CANTIDAD_M2';
  }else{
    pendientes.push(nombre+': faltan largo/ancho o formato físico y consumo');
    continue;
  }
  if(!Number.isFinite(area)||area<=0){pendientes.push(nombre+': área no finita');continue}
  areaNetaM2+=area;
  const fila={indice:k,nombre,insumoId:c.insumoId,largoMM:largo||null,anchoMM:ancho||null,unidades:unidades*n,areaM2:area,origenGeometria:tipo,unidadPrecio:ins.unidad};
  renglones.push(fila);
  const g=grupos.get(c.insumoId)||{insumoId:c.insumoId,nombreMaterial:ins.nombre||c.insumoId,unidadPrecio:ins.unidad,areaNetaM2:0,piezas:0,
   estadoPrecio:ins.estadoEconomia||'LEGACY',fuentePrecio:ins.fuenteCompra||ins.fuente||'',precioUnitario:positivo(ins.precio),certificado:ins.precioCertificable===true};
  g.areaNetaM2+=area;g.piezas+=unidades*n;grupos.set(c.insumoId,g);
 }
 const gs=[...grupos.values()].map(g=>{
   const d=costeoPorId.get(g.insumoId);
   const costoMotor=d&&Number.isFinite(Number(d.costo))?Number(d.costo):null;
   const netoTeorico=g.unidadPrecio==='m2'&&g.precioUnitario!=null?g.areaNetaM2*g.precioUnitario:null;
   const precioPorM2=costoMotor!=null&&g.areaNetaM2>0?costoMotor/g.areaNetaM2:null;
   const requiereVerificarUnidad=g.unidadPrecio!=='m2'&&!d;
   if(requiereVerificarUnidad)pendientes.push(g.nombreMaterial+': precio por '+g.unidadPrecio+' necesita cálculo del motor, no m² × precio');
   return {...g,costoMotor,costoNetoTeorico:netoTeorico,costoPorM2Desarrollado:precioPorM2,
    metodoMotor:d?.metodoConsumo||null,unidadesCompradas:d?.unidades??null,desperdicio:d?.desperdicio??null,
    formato:d?.formato||null};
 });
 const costoTotalSuperficies=gs.every(g=>g.costoMotor!=null)&&gs.length?gs.reduce((a,g)=>a+g.costoMotor,0):null;
 const costeoCompleto=resultado&&Array.isArray(resultado.componentesIgnorados)&&resultado.componentesIgnorados.length===0;
 return {valido:pendientes.length===0,areaNetaM2,renglones,grupos:gs,pendientes,
  totales:{costoMaterialGrupos:costoTotalSuperficies,costoTotalFabricacion:costeoCompleto&&Number.isFinite(Number(resultado.costoUnitario))?Number(resultado.costoUnitario)*n:null,
   costoMaterialPorM2:costoTotalSuperficies!=null&&areaNetaM2>0?costoTotalSuperficies/areaNetaM2:null},
  etiquetaArea:'m² desarrollados de piezas medidas (no huella en planta)'};
}
