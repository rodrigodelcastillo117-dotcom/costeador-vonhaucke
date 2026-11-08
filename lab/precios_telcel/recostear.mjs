// Recostea los BOM cuantificados a precio certificado de HOY (mapa de precios desde prod).
import { readFileSync } from 'node:fs';
const bom = JSON.parse(readFileSync(process.argv[2],'utf8'));
// Mapa "ARTICULO|OPCION" -> {id, precio_hoy, unidad, fecha}  (de insumos_catalogo/insumo_precios prod)
const P = {
 'MVLSLA05260402|':{id:'erp-ln18310',precio:615.15,fecha:'2026-10'},
 'MVLSLA05270402|':{id:'erp-ln18410',precio:776.52,fecha:'2026-09'},
 'MVLSLA05270202|':{id:'erp-ln14410',precio:1211.953,fecha:'2026-09'},
 'MVLSLA05270502|':{id:'erp-ln20410',precio:583.117,fecha:'2026-09'},
 'MVLSLA05280402|':{id:'erp-ln1848',precio:585.511,fecha:'2017-05 ⚠'},
 'MVLSLA05260502|':{id:'lamina-3x10-20',precio:null,fecha:'SIN PRECIO'},
 'MVLSLA05260202|':{id:'lamina-3x10-14',precio:null,fecha:'SIN PRECIO'},
 'MVLSTU01080501|':{id:'erp-tc201',precio:131.64,fecha:'2026-10'},
 'MVLSTU01080401|':{id:'erp-tc181',precio:132.5,fecha:'2026-07'},
 'MVLMMR050000E7|':{id:'erp-me258ex',precio:26.5,fecha:'2018-10 ⚠'},
 'MPMTLA01030601|':{id:'erp-ln4814ace',precio:900.376,fecha:'2025-02 ⚠dudoso'},
 'MVLABI19000000|':{id:'erp-bibi',precio:13.66,fecha:'2026-09'},
 'MLEMTM01040000|':{id:'erp-tmp534250',precio:47.43,fecha:'2026-09'},
 'MLEMTM01050000|':{id:'erp-tmp1011425',precio:189.75,fecha:'2026-02'},
 'MLEMTM01060000|':{id:'erp-tmp1034250',precio:94.87,fecha:'2026-02'},
 'MVLQPP00000000|A529':{id:'erp-pph-a529',precio:142.51419,fecha:'2020-07 ⚠'},
 'MVLQPP00000000|A10':{id:'erp-pph-a10',precio:207.978876,fecha:'2018-08 ⚠'},
};
for(const clave of Object.keys(bom)){
  const m=bom[clave]; let hoy=0, cubierto=0, hist=0; const faltan=[];
  for(const l of m.lineas){
    const key=l.articulo+'|'+(l.opcion||'');
    const p=P[key];
    hist += l.consumo*(l.costo_ultima||0);
    if(p&&p.precio!=null){ hoy+=l.consumo*p.precio; cubierto+=l.consumo*(l.costo_ultima||0); }
    else faltan.push(`${l.articulo}${l.opcion?'·'+l.opcion:''} (consumo ${l.consumo} ${l.unidad||'?'}, $${(l.total||0).toFixed(2)} hist) → ${p?p.fecha:'SIN INSUMO'}`);
  }
  const cobPct = 100*cubierto/hist;
  console.log(`\n=== ${clave} ===`);
  console.log(`  material histórico (hoja): $${m.material_real.toFixed(2)}`);
  console.log(`  material a precio de HOY (líneas resueltas): $${hoy.toFixed(2)}`);
  console.log(`  cobertura resuelta: ${cobPct.toFixed(1)}% del material identificado`);
  console.log(`  Δ hoy vs histórico (sobre lo resuelto): ${hist>0?(100*(hoy-cubierto)/cubierto).toFixed(1):'—'}%`);
  if(faltan.length){ console.log(`  LÍNEAS SIN PRECIO/IDENTIDAD (${faltan.length}):`); for(const f of faltan) console.log('    · '+f); }
  else console.log('  TODAS las líneas resueltas → costeable por material 100%');
}
