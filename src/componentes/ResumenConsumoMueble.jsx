import {useMemo} from 'react';
import {auditarConsumoMueble} from '../datos/consumoMueble.js';
import {pesos2} from '../util.js';
// Reusa el costo del MOTOR. Sólo la geometría viene del BOM.
// No reproduce reglas de precio, hojas, peso, desperdicio ni mano de obra aquí.
export default function ResumenConsumoMueble({componentes=[],insumos={},lote=1,resultado=null,mostrarCosto=true}) {
 const r=useMemo(()=>auditarConsumoMueble({componentes,insumos,lote,resultado}),[componentes,insumos,lote,resultado]);
 if(!r.grupos.length&&!r.pendientes.length)return null;
 return <section className="tarjeta" aria-label="Superficies y consumos del mueble" style={{margin:'12px 0'}}>
   <h3>Despiece matemático · metros cuadrados y costos</h3>
   <p className="ayuda">Se suman las caras y paneles realmente contenidos en el BOM. <strong>No se inventan profundidades, frentes, cantos ni retornos.</strong> El precio sale del motor, según la unidad de compra de cada insumo.</p>
   {r.renglones.map((x)=> <div className="pieza-calc" key={x.indice} style={{padding:'4px 0'}}>
      {x.nombre}: {x.origenGeometria==='COTAS' ? <>{x.unidades} × {(x.largoMM/1000).toFixed(3)} × {(x.anchoMM/1000).toFixed(3)} m</> : <>{x.unidades} unidad(es) · formato/consumo</>}
      {' = '}<strong>{x.areaM2.toFixed(3)} m² netos</strong>
    </div>)}
   {r.grupos.length>0&&<div style={{marginTop:10}}>
      <strong>{r.areaNetaM2.toFixed(3)} m² netos desarrollados</strong>
      <div className="ayuda">No son m² de superficie de piso. Para hojas/perfiles el motor aplica rendimiento, compra y merma por separado.</div>
    </div>}
   {mostrarCosto&&r.grupos.map((g)=><div className="pieza-calc" key={g.insumoId} style={{padding:'6px 0',borderTop:'1px solid var(--borde,#ddd)'}}>
     <strong>{g.nombreMaterial}</strong> · {g.areaNetaM2.toFixed(3)} m²
     <div className="ayuda">Unidad de precio: {g.unidadPrecio} · {g.metodoMotor||'motor pendiente'} · {g.certificado?'Compras aprobadas':'costo preliminar o histórico, verificar procedencia'}</div>
     {g.costoMotor!=null?<div>Material según el motor: <strong>{pesos2(g.costoMotor)}</strong>
       {g.costoPorM2Desarrollado!=null&&<> · <strong>{pesos2(g.costoPorM2Desarrollado)}/m² desarrollado</strong></>}
     </div>:<div role="status">Precio por unidad disponible, pero falta costo verificable del motor.</div>}
   </div>)}
   {r.pendientes.length>0&&<div className="alerta ambar" role="alert" style={{marginTop:8}}>
       <strong>Datos por resolver antes de cerrar el costeo:</strong>
       {r.pendientes.map((s,i)=><div key={i} className="ayuda">• {s}</div>)}
    </div>}
   {mostrarCosto&&r.totales?.costoMaterialGrupos!=null&&
      <div className="pieza-calc" style={{marginTop:8}}>
        <strong>Material de las superficies medidas: {pesos2(r.totales.costoMaterialGrupos)}</strong>
        {r.totales.costoMaterialPorM2!=null&&<> · {pesos2(r.totales.costoMaterialPorM2)}/m² neto</>}
        <div className="ayuda">El total final del mueble, sus herrajes, metal, mano de obra, fábrica y margen se calculan en la hoja de costo, no por esta cifra aislada.</div>
      </div>}
  </section>;
}
