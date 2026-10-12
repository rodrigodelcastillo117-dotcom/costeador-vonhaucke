import { nube } from '../nube.js';
import { dinero } from '../motor/dinero.js';

const normal=(s='')=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money=(n,moneda='MXN')=>{
  const v=dinero(n);
  if(!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-MX',{
    style:'currency',currency:moneda||'MXN',
    minimumFractionDigits:2,maximumFractionDigits:2,
  }).format(v);
};

function capacidadDeNombre(nombre=''){
  const m=normal(nombre).match(/(\d{1,2})\s*(?:usuarios?|lugares?|puestos?)/);
  return m?Number(m[1]):null;
}

function objetivoEscala(intent){
  const base=Number(intent?.capacidad_personas||intent?.capacidad?.personas||0)||null;
  const t=normal(intent?._brief||intent?.textoOriginal||'');
  const m=t.match(/(?:crecer|escalar|ampliar|expandir)(?:\s+hasta|\s+a)?\s*(\d{1,2})/);
  const max=m?Number(m[1]):base;
  return {base,max:Math.max(base||0,max||0)||base};
}

function terminoPorIntent(intent){
  if(intent?.tipologia_cocrear==='operativo_colaborativo') return 'Módulo operativo';
  const fam=String(intent?.familia||'').toUpperCase();
  if(fam==='MESA') return 'Mesa de';
  if(fam==='RECEPCION') return 'Recepción';
  if(fam==='LOCKER') return 'Locker';
  if(fam==='DISPLAY') return 'Exhibidor';
  if(fam==='GUARDADO') return 'Credenza';
  if(fam==='ESCRITORIO') return 'Escritorio';
  return null;
}

export async function referenciasComercialesCocrear(intent){
  const termino=terminoPorIntent(intent);
  if(!termino) return {ok:true,items:[],motivo:'Sin familia comparable suficiente'};
  try{
    const {data:productos,error:e1}=await nube.from('productos')
      .select('id,nombre,familia,activo')
      .ilike('nombre',`%${termino}%`)
      .neq('activo',false)
      .limit(80);
    if(e1) throw e1;
    const ids=(productos||[]).map(x=>x.id).filter(Boolean);
    if(!ids.length) return {ok:true,items:[],motivo:'No hay productos comparables vigentes'};

    const {data:precios,error:e2}=await nube.from('lista_precio_items')
      .select('producto_id,producto_version_id,precio_lista,moneda,vigencia_desde,vigencia_hasta,provenance')
      .in('producto_id',ids)
      .not('precio_lista','is',null)
      .limit(200);
    if(e2) throw e2;

    const pmap=new Map((productos||[]).map(p=>[p.id,p]));
    const hoy=new Date().toISOString().slice(0,10);
    let items=(precios||[])
      .filter(x=>!x.vigencia_hasta||x.vigencia_hasta>=hoy)
      .map(x=>({
        ...x,
        nombre:pmap.get(x.producto_id)?.nombre||'Producto comparable',
        familia:pmap.get(x.producto_id)?.familia||null,
        capacidad:capacidadDeNombre(pmap.get(x.producto_id)?.nombre||''),
        precio:Number(x.precio_lista),
      }))
      .filter(x=>Number.isFinite(x.precio)&&x.precio>0);

    // Dedupe de cargas repetidas: mismo nombre/capacidad/precio se considera la misma evidencia comercial.
    const uniq=new Map();
    for(const x of items){const k=`${x.nombre}|${x.capacidad||''}|${x.precio}|${x.moneda||'MXN'}`;if(!uniq.has(k))uniq.set(k,x)}
    items=[...uniq.values()];

    const {base,max}=objetivoEscala(intent);
    if(intent?.tipologia_cocrear==='operativo_colaborativo'){
      const conCap=items.filter(x=>x.capacidad);
      const enRango=base?conCap.filter(x=>x.capacidad>=base&&(!max||x.capacidad<=max)):conCap;
      const universo=enRango.length?enRango:conCap;
      items=universo.sort((a,b)=>{
        const da=Math.abs((a.capacidad||999)-(base||0)),db=Math.abs((b.capacidad||999)-(base||0));
        return da-db||a.capacidad-b.capacidad||a.precio-b.precio;
      }).slice(0,5);
    }else{
      items=items.sort((a,b)=>a.precio-b.precio).slice(0,5);
    }

    // Economía es sensible y RLS decide si el rol puede verla. Si no hay permiso, simplemente no aparece.
    const versionIds=[...new Set(items.map(x=>x.producto_version_id).filter(Boolean))];
    let economia=[];
    if(versionIds.length){
      const {data}=await nube.from('producto_version_economia')
        .select('producto_version_id,costo_oficial_referencia,fuente,formula_version')
        .in('producto_version_id',versionIds);
      economia=data||[];
    }
    const emap=new Map(economia.map(e=>[e.producto_version_id,e]));
    items=items.map(x=>({...x,costo_referencia:emap.get(x.producto_version_id)?.costo_oficial_referencia!=null?Number(emap.get(x.producto_version_id).costo_oficial_referencia):null,costo_fuente:emap.get(x.producto_version_id)?.fuente||null}));

    const preciosValidos=items.map(x=>x.precio).filter(Number.isFinite);
    const costosValidos=items.map(x=>x.costo_referencia).filter(x=>Number.isFinite(x)&&x>0);
    return {
      ok:true,
      items,
      base,
      max,
      moneda:items[0]?.moneda||'MXN',
      rango_precio:preciosValidos.length?{min:Math.min(...preciosValidos),max:Math.max(...preciosValidos)}:null,
      rango_costo:costosValidos.length?{min:Math.min(...costosValidos),max:Math.max(...costosValidos)}:null,
      nota:'Referencias reales de la lista de precios vigente. No incluyen automáticamente especiales de la co-creación hasta que exista BOM.'
    };
  }catch(e){
    return {ok:false,items:[],error:String(e?.message||e)};
  }
}

export function formatearReferenciaCocrear(ref){
  if(!ref?.items?.length) return null;
  const moneda=ref.moneda||'MXN';
  return {
    titulo:ref.base&&ref.max&&ref.max!==ref.base?`Base comparable real para ${ref.base}–${ref.max} puestos`:'Base comparable real',
    rangoPrecio:ref.rango_precio?`${money(ref.rango_precio.min,moneda)} – ${money(ref.rango_precio.max,moneda)}`:null,
    rangoCosto:ref.rango_costo?`${money(ref.rango_costo.min,moneda)} – ${money(ref.rango_costo.max,moneda)}`:null,
    items:ref.items,
    nota:ref.nota,
  };
}
