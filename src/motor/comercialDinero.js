// Dinero comercial autoritativo para cotización server-side.
// Centavos enteros en cada frontera; NO toca fórmulas de costeo Alba/Rafa.
import { aCentavosEnteros, deCentavosEnteros, porcentajeCentavos } from './dinero.js';

export function precioConDescuento(precioLista, descuentoPct=0){
  const base=aCentavosEnteros(precioLista);
  if(base==null)return null;
  const desc=porcentajeCentavos(base,descuentoPct);
  if(desc==null)return null;
  return deCentavosEnteros(base-desc);
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
