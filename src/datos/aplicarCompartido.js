// Mezcla lo compartido (de la nube) sobre el estado local. Los parametros se
// FUNDEN (para no borrar la nomina que Direccion tenga desbloqueada en memoria);
// los precios, recetas y el bloque cifrado se reemplazan.
//
// VH-145: los insumos del catálogo grande (ERP) que la persona eligió a mano entran al mapa
// local sólo en memoria (`agregarInsumoCatalogo`); cada refresco de `config_para_rol` o evento
// realtime reemplazaba el mapa entero y los borraba: el motor local decía "Pendiente / sin
// material" mientras el servidor sí costeaba por id. Se conservan los que no vienen en lo nuevo.
export const esInsumoErp = (id, ins) => !!(ins && (ins.clasificacion === 'erp' || String(id || ins.id || '').startsWith('erp-')));

export function aplicarCompartido(estado, datos) {
  const nuevo = { ...estado };
  if (datos.insumos) {
    const conservados = {};
    for (const [id, ins] of Object.entries(estado?.insumos || {})) {
      if (!(id in datos.insumos) && esInsumoErp(id, ins)) conservados[id] = ins;
    }
    nuevo.insumos = { ...conservados, ...datos.insumos };
  }
  // VH-088: de dónde salieron los insumos ('catalogo' = catálogo certificado vía config_para_rol;
  // 'config-fallback' = foto de config). Precios.jsx lo usa para no dejar editar lo que no manda.
  if (datos.insumosFuente) nuevo.insumosFuente = datos.insumosFuente;
  if (datos.piezas) nuevo.piezas = datos.piezas;
  // Los parametros se FUNDEN: lo compartido no debe borrar la nomina que
  // Direccion ya tenga cargada desde su boveda.
  if (datos.parametros) nuevo.parametros = { ...estado.parametros, ...datos.parametros };
  return nuevo;
}
