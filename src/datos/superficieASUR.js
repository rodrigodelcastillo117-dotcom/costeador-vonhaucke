// Despiece geométrico de superficie sólida ASUR. Nunca infiere fondos ni alturas.
// Muestra CONSUMO NETO: compra mínima, merma, unión, mano de obra y fábrica
// se calculan por otras capas y sólo con medidas/evidencias verificables.
export function calcularSuperficieASUR(componentes = [], insumos = {}, lote = 1) {
  const n = Number(lote);
  if (!Number.isInteger(n) || n < 1) return { haySuperficie:false, error:'Lote inválido', detalles:[], pendientes:[] };
  const detalles = [], pendientes = [];
  let areaTotalM2 = 0, costoSuperficie = 0, costoAdhesivo = 0, cartuchos = 0;
  let haySuperficie = false;
  for (const c of Array.isArray(componentes) ? componentes : []) {
    const id = c?.insumoId;
    if (!['solid-surface','solid-surface-azul','adhesivo-solid-surface'].includes(id)) continue;
    if (c.excluida) continue;
    const ins = insumos[id] || {};
    const precio = Number(ins.precio);
    const precioUsable = Number.isFinite(precio) && precio > 0;
    const nombre = c.nombre || ins.nombre || id;
    if (id === 'adhesivo-solid-surface') {
      const cantidad = Number(c.cantidad ?? 0);
      if (!Number.isFinite(cantidad) || cantidad < 0 || !Number.isInteger(cantidad) || !precioUsable)
        pendientes.push(nombre + ': especificar cartuchos enteros y precio');
      else { cartuchos += cantidad * n; costoAdhesivo += cantidad*n*precio; }
      continue;
    }
    haySuperficie = true;
    // Cada cara de la cubierta, frente, canto engrosado, faldón o retorno
    // debe ser una pieza distinta del BOM (nunca adivinar sus áreas).
    const largo=Number(c.largoMM), ancho=Number(c.anchoMM);
    const unidades=Number(c.piezas ?? c.cantidad ?? 1);
    if (!Number.isFinite(largo) || largo <= 0 || !Number.isFinite(ancho) || ancho <= 0
      || !Number.isInteger(unidades) || unidades < 1 || !precioUsable) {
      pendientes.push(nombre + ': falta largo, ancho, cantidad o tarifa');
      continue;
    }
    const areaM2=(largo/1000)*(ancho/1000)*unidades*n;
    const importe=areaM2*precio;
    if (!Number.isFinite(areaM2) || !Number.isFinite(importe)) {
      pendientes.push(nombre + ': resultado no finito'); continue;
    }
    areaTotalM2+=areaM2; costoSuperficie+=importe;
    detalles.push({nombre,id,largoMM:largo,anchoMM:ancho,unidades:unidades*n,areaM2,precioM2:precio,importe});
  }
  const totalConocido=costoSuperficie+costoAdhesivo;
  return {
    haySuperficie, piezas:detalles.length, detalles, pendientes, areaTotalM2,
    costoSuperficie, cartuchos, costoAdhesivo, totalConocido,
    costoMaterialPorM2:areaTotalM2 > 0 ? costoSuperficie/areaTotalM2 : null,
    costoMaterialConAdhesivoPorM2:areaTotalM2 > 0 && pendientes.length === 0 ? totalConocido/areaTotalM2 : null,
    estimado:true, // tarifas autorizadas por usuario, NO costo factura ni fabricación
    incluyeMerma:false, incluyeManoObra:false, incluyeFabrica:false,
  };
}
