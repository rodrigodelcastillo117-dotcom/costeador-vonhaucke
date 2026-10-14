// Dinero comercial autoritativo para cotización server-side.
// Centavos enteros en cada frontera; NO toca fórmulas de costeo Alba/Rafa.
import { aCentavosEnteros, deCentavosEnteros, porcentajeCentavos } from './dinero.js';

// Reauditoría 14-oct (P1-06): la AUTORIDAD es el SQL desplegado (emitir_revision_v2: round(lista × (1 − d/100), 2),
// half-away-from-zero sobre el PRECIO FINAL). Antes se redondeaba el DESCUENTO y se restaba: 1000.10 al 5 % daba 950.09
// y el servidor exigía 950.10 (lo rechazaba). Ahora se redondea el precio final, igual que el servidor.
export function precioConDescuento(precioLista, descuentoPct=0){
  const base=aCentavosEnteros(precioLista);
  if(base==null)return null;
  if(descuentoPct==null||descuentoPct==='')return null;
  const d=Number(descuentoPct);
  if(!Number.isFinite(d))return null;
  const final=porcentajeCentavos(base,100-d);
  if(final==null)return null;
  return deCentavosEnteros(final);
}

export function importePorCantidad(precioUnitario,cantidad){
  const unit=aCentavosEnteros(precioUnitario);
  const q=Number(cantidad);
  if(unit==null||!Number.isFinite(q)||q<=0)return null;
  const cents=Math.round(unit*q);
  return Number.isSafeInteger(cents)?deCentavosEnteros(cents):null;
}

export function cargoPorcentaje(base,pct){
  const cents=aCentavosEnteros(base);
  if(cents==null)return null;
  const c=porcentajeCentavos(cents,pct);
  return c==null?null:deCentavosEnteros(c);
}

export function sumarMontos(montos=[]){
  let cents=0;
  for(const m of montos){
    const c=aCentavosEnteros(m);
    if(c==null)return null;
    cents+=c;
  }
  return Number.isSafeInteger(cents)?deCentavosEnteros(cents):null;
}
