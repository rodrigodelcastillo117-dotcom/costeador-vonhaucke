import {pesos2} from '../util.js';
import {calcularSuperficieASUR} from '../datos/superficieASUR.js';
// Costeo MATERIAL por superficies reales del BOM. No es precio completo del módulo.
export default function ResumenASUR({componentes=[],insumos={},lote=1,mostrarCosto=true}) {
  const r=calcularSuperficieASUR(componentes,insumos,lote);
  if (!r.haySuperficie) return null;
  return <section className="tarjeta" aria-label="Costeo ASUR superficie sólida" style={{margin:'12px 0'}}>
    <h3>ASUR · superficie sólida por m²</h3>
    <div className="ayuda">Despiece medido, sin inventar caras, cortes ni desperdicios. Precios autorizados para ESTIMAR; no representan factura de Compras.</div>
    {r.detalles.map((d,i)=><div className="pieza-calc" key={i} style={{padding:'5px 0'}}>
      {d.nombre}: {d.unidades} × {(d.largoMM/1000).toFixed(3)} × {(d.anchoMM/1000).toFixed(3)} m =
      <strong> {d.areaM2.toFixed(3)} m²</strong>
      {mostrarCosto && <> · {pesos2(d.precioM2)}/m² → {pesos2(d.importe)}</>}
    </div>)}
    <div style={{fontWeight:600,marginTop:8}}>Total de superficie sólida identificada: {r.areaTotalM2.toFixed(3)} m²</div>
    {mostrarCosto && <>
      <div className="pieza-calc">Material superficial (sin merma): {pesos2(r.costoSuperficie)}</div>
      <div className="pieza-calc">Adhesivo especificado: {r.cartuchos} cartucho(s) · {pesos2(r.costoAdhesivo)}</div>
      <div className="pieza-calc"><strong>Subtotal material conocido: {pesos2(r.totalConocido)}</strong></div>
      {r.costoMaterialConAdhesivoPorM2 != null
        && <div className="pieza-calc">Material + adhesivo por m² desarrollado: {pesos2(r.costoMaterialConAdhesivoPorM2)}/m²</div>}
    </>}
    {r.pendientes.length>0 && <div className="alerta ambar" role="alert">
      Sin costo final: faltan medidas o precios de {r.pendientes.join(' · ')}.
    </div>}
    <div className="ayuda" style={{marginTop:8}}>
      No incluye consumo por mermas/corte, compra mínima de placas, mano de obra,
      termoformado, base estructural, instalación ni indirectos. La receta completa se calcula aparte.
    </div>
  </section>;
}
