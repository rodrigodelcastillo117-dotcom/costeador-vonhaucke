// ============================================================================
// MATERIAL KNOWLEDGE · vista técnica seller-safe para VONI.
// No contiene precio/costo/margen/proveedor. Sólo datos físicos/técnicos.
// ============================================================================
const npos=(x)=>Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
const norm=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function catalogoTecnicoMateriales(insumos = {}) {
  return Object.entries(insumos || {}).map(([id,x])=>{
    const f=x?.formato||{};
    return {
      id,
      nombre:x?.nombre||id,
      seccion:x?.seccion||null,
      unidad:x?.unidad||null,
      veta:!!x?.veta,
      inventario:!!x?.inventario,
      espesor_mm:npos(x?.espesorMM ?? x?.espesor_mm ?? f?.espesorMM ?? f?.espesor_mm),
      formato:{
        tipo:f.tipo||null,
        nombre:f.nombre||null,
        largo_mm:npos(f.largoMM ?? f.largo_mm),
        ancho_mm:npos(f.anchoMM ?? f.ancho_mm),
        medida:npos(f.medida),
        largo_comercial_mm:(f.tipo==='tramo' && (x?.unidad==='m' || x?.unidad==='metro') && npos(f.medida))
          ? npos(f.medida)*1000 : null,
      },
    };
  });
}

export function buscarMaterialTecnico(catalogo = [], consulta = '') {
  const q=norm(consulta).split(/[^a-z0-9]+/).filter(Boolean);
  if(!q.length) return [];
  return (catalogo||[])
    .map((m)=>{
      const h=norm(`${m.id} ${m.nombre} ${m.seccion} ${m.unidad}`);
      const score=q.reduce((s,w)=>s+(h.includes(w)?1:0),0);
      return {m,score};
    })
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||String(a.m.nombre).localeCompare(String(b.m.nombre)))
    .slice(0,8)
    .map(x=>x.m);
}

export function describirFormatoTecnico(m={}) {
  const f=m.formato||{};
  if(f.largo_mm&&f.ancho_mm) {
    return `${f.tipo||'formato'} ${Math.round(f.largo_mm)} × ${Math.round(f.ancho_mm)} mm${m.espesor_mm?` · espesor ${m.espesor_mm} mm`:''}${m.veta?' · con veta':''}`;
  }
  if(f.tipo==='tramo' && f.largo_comercial_mm) {
    return `tramo ${(f.largo_comercial_mm/1000).toFixed(2)} m${m.espesor_mm?` · espesor ${m.espesor_mm} mm`:''}`;
  }
  if(f.medida) return `${f.tipo?f.tipo+' · ':''}formato de compra: ${f.medida} ${m.unidad||''}`.trim();
  return 'formato físico no documentado';
}

export function contieneEconomiaMaterial(obj) {
  const prohibidas=/precio|costo|margen|utilidad|proveedor|factura|compra/i;
  const walk=(x)=>{
    if(!x||typeof x!=='object')return false;
    for(const [k,v] of Object.entries(x)){
      if(prohibidas.test(k))return true;
      if(typeof v==='object'&&walk(v))return true;
    }
    return false;
  };
  return walk(obj);
}
