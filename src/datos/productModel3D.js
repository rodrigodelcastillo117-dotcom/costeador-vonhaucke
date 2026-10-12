// ============================================================================
// PRODUCT MODEL 3D/4D · representación técnica derivada, SIN inventar geometría.
//
// Conceptual 3D (CocrearVisual) sirve para ideación. Este módulo es otra cosa:
// toma el BOM/ProductSpec y sólo representa piezas que traen dimensiones
// suficientes. Como el BOM aún no contiene coordenadas de ensamble confiables,
// la vista técnica es EXPLOTADA (no pretende ser la posición final).
//
// "4D" = 3D + secuencia. Hasta tener routing/operaciones reales de Intelisis/
// Producción, la secuencia es DERIVED/PRELIMINARY y nunca se etiqueta certificada.
// ============================================================================
import { visualRevisionHash } from './visualRevision.js';

export const MODEL3D_STATUS = Object.freeze({
  NONE:'NONE',
  PARTIAL:'PARTIAL',
  EXPLODED_READY:'EXPLODED_READY',
});

const npos=(x)=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
const norm=(s)=>String(s||'').toLowerCase();

function dimsDe(c={}){
  const w=npos(c.largoMM ?? c.length_mm ?? c.ancho_mm);
  const d=npos(c.anchoMM ?? c.width_mm ?? c.prof_mm ?? c.fondo_mm);
  // El espesor debe venir explícito. NO usamos un 18mm genérico.
  const h=npos(c.espesorMM ?? c.thicknessMM ?? c.thickness_mm ?? c.altoMM ?? c.height_mm);
  return {w,d,h};
}

function etapaDe(c={}){
  const t=norm(`${c.semantic_role||''} ${c.nombre||''} ${c.seccion||''}`);
  if (/estructura|bastidor|pata|soporte|ptr|perfil|base/.test(t)) return 1;
  if (/cubierta|panel|lateral|costado|entrepano|entrepaño|faldon|faldón|tapa/.test(t)) return 2;
  if (/gaveta|cajon|cajón|puerta|corredera|bisagra|herraje/.test(t)) return 3;
  if (/electric|contacto|usb|led|luz|cable|charola|byrne/.test(t)) return 4;
  if (/acabado|pintura|tapiz|tela|chapa|laminado|canto/.test(t)) return 5;
  return 3;
}

const COLOR_ETAPA={1:'#72787e',2:'#bcae98',3:'#8f969d',4:'#4e6673',5:'#a99b8a'};

export function modeloTecnico3DDesdeSpec(spec={}){
  const comps=(Array.isArray(spec.componentes)?spec.componentes:[]).filter(c=>c&&!c.excluida);
  if(!comps.length)return {
    status:MODEL3D_STATUS.NONE, solids:[], secuencia:[],
    issues:['SIN_BOM'], source:'BOM', certification:'PRELIMINARY',
    visualRevisionHash: visualRevisionHash(spec),
  };

  const validas=[],issues=[];
  comps.forEach((c,idx)=>{
    const {w,d,h}=dimsDe(c);
    const q=Math.max(1,Math.round(Number(c.piezas??c.cantidad)||1));
    if(!(w&&d&&h)){
      issues.push({
        code:'GEOMETRIA_3D_INCOMPLETA',
        nombre:c.nombre||`Pieza ${idx+1}`,
        faltan:[!w?'largo':null,!d?'ancho':null,!h?'espesor/alto':null].filter(Boolean),
      });
      return;
    }
    for(let i=0;i<q;i++)validas.push({
      id:`${c.graph_node_id||c.id||idx}#${i+1}`,
      nombre:c.nombre||c.semantic_role||`Pieza ${idx+1}`,
      w,d,h,
      etapa:etapaDe(c),
      semantic_role:c.semantic_role||null,
      source:c.procedencia||c.source||'DERIVED',
    });
  });

  if(!validas.length)return {
    status:MODEL3D_STATUS.NONE, solids:[], secuencia:[],
    issues, source:'BOM', certification:'PRELIMINARY',
    visualRevisionHash: visualRevisionHash(spec),
  };

  // Exploded layout determinista: filas, sin fingir coordenadas de ensamble.
  const maxW=Math.max(...validas.map(p=>p.w));
  const maxD=Math.max(...validas.map(p=>p.d));
  const gap=Math.max(120,Math.min(500,Math.round(Math.max(maxW,maxD)*0.12)));
  const cols=Math.max(1,Math.ceil(Math.sqrt(validas.length)));
  const solids=validas.map((p,i)=>{
    const col=i%cols,row=Math.floor(i/cols);
    return {
      id:p.id,nombre:p.nombre,
      x:col*(maxW+gap),y:row*(maxD+gap),z:0,
      w:p.w,d:p.d,h:p.h,
      color:COLOR_ETAPA[p.etapa]||'#9da3a8',
      stage:p.etapa,
      semantic_role:p.semantic_role,
      source:p.source,
    };
  });

  const etapas=[
    [1,'Estructura y soportes'],
    [2,'Paneles y superficies'],
    [3,'Guardado, puertas y herrajes'],
    [4,'Electrificación e integración'],
    [5,'Acabados'],
  ].map(([stage,titulo])=>({
    stage,titulo,
    piezas:solids.filter(s=>s.stage===stage).map(s=>s.nombre),
  })).filter(x=>x.piezas.length);

  return {
    status:issues.length?MODEL3D_STATUS.PARTIAL:MODEL3D_STATUS.EXPLODED_READY,
    solids,
    secuencia:etapas,
    issues,
    source:'BOM',
    representation:'EXPLODED_NOT_ASSEMBLED',
    certification:'PRELIMINARY',
    sequence_source:'DERIVED',
    visualRevisionHash: visualRevisionHash(spec),
  };
}

export function solidsHastaEtapa(modelo,stage){
  if(!modelo?.solids)return [];
  const s=Math.max(1,Number(stage)||1);
  return modelo.solids.filter(x=>(x.stage||1)<=s);
}
