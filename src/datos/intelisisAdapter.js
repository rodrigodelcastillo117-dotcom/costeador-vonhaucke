// Contrato de ingestión READ-ONLY para datos de Intelisis.
// Este módulo NO llama al ERP. Normaliza filas autorizadas sin inventar huecos.

const txt=(v)=>String(v??'').trim();
const num=(v)=>{const n=Number(v); return Number.isFinite(n)?n:null;};

export function normalizarMaterialIntelisis(row={}) {
  const out={
    clave_erp:txt(row.clave_erp||row.clave||row.articulo),
    descripcion:txt(row.descripcion||row.nombre),
    proveedor:txt(row.proveedor)||null,
    unidad_compra:txt(row.unidad_compra||row.unidad)||null,
    unidad_consumo:txt(row.unidad_consumo)||null,
    conversion:row.conversion??null,
    precio:num(row.precio??row.ultimo_costo),
    moneda:(txt(row.moneda)||'MXN').toUpperCase(),
    vigencia:txt(row.vigencia||row.fecha)||null,
    evidencia:txt(row.evidencia||row.folio||row.oc)||null,
  };
  const issues=[];
  if(!out.clave_erp) issues.push('FALTA_CLAVE_ERP');
  if(out.precio===null||out.precio<0) issues.push('PRECIO_INVALIDO');
  if(!out.unidad_compra) issues.push('FALTA_UNIDAD_COMPRA');
  if(!out.vigencia) issues.push('FALTA_VIGENCIA');
  if(!out.evidencia) issues.push('FALTA_EVIDENCIA');
  return {...out,evidence_status:issues.length?'incompleta':'verificada',issues};
}

export function normalizarOperacionIntelisis(row={}) {
  const out={
    producto:txt(row.producto||row.sku_producto),
    version_receta:txt(row.version_receta)||null,
    operacion:txt(row.operacion),
    centro_trabajo:txt(row.centro_trabajo||row.centro),
    horas:num(row.horas),
    tarifa_mo_hora:num(row.tarifa_mo_hora??row.costo_hora_mo),
    tarifa_gif_hora:num(row.tarifa_gif_hora??row.costo_hora_gif),
    preparacion_horas:num(row.preparacion_horas)??0,
    evidencia:txt(row.evidencia||row.folio)||null,
  };
  const issues=[];
  if(!out.producto) issues.push('FALTA_PRODUCTO');
  if(!out.operacion) issues.push('FALTA_OPERACION');
  if(!out.centro_trabajo) issues.push('FALTA_CENTRO');
  if(out.horas===null||out.horas<0) issues.push('HORAS_INVALIDAS');
  if(out.tarifa_mo_hora===null||out.tarifa_mo_hora<0) issues.push('TARIFA_MO_INVALIDA');
  if(out.tarifa_gif_hora===null||out.tarifa_gif_hora<0) issues.push('TARIFA_GIF_INVALIDA');
  return {...out,evidence_status:issues.length?'incompleta':'verificada',issues};
}

export function normalizarBomIntelisis(row={}) {
  const out={
    producto:txt(row.producto||row.sku_producto),
    variante:txt(row.variante)||null,
    version_receta:txt(row.version_receta)||null,
    componente:txt(row.componente),
    clave_material:txt(row.clave_material||row.insumo),
    cantidad:num(row.cantidad),
    unidad_consumo:txt(row.unidad_consumo||row.unidad)||null,
    merma_pct:num(row.merma_pct),
    evidencia:txt(row.evidencia||row.folio)||null,
  };
  const issues=[];
  if(!out.producto) issues.push('FALTA_PRODUCTO');
  if(!out.componente) issues.push('FALTA_COMPONENTE');
  if(!out.clave_material) issues.push('FALTA_MATERIAL');
  if(out.cantidad===null||out.cantidad<=0) issues.push('CANTIDAD_INVALIDA');
  if(!out.unidad_consumo) issues.push('FALTA_UNIDAD_CONSUMO');
  return {...out,evidence_status:issues.length?'incompleta':'verificada',issues};
}
