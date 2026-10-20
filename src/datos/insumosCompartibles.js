// Cierre ChatGPT v3 (certificación a0179dcd): la config COMPARTIDA (`config.datos.insumos`) es la foto curada de
// Dirección; los artículos del ERP viven en el catálogo canónico (insumos_catalogo, VH-088) y el servidor los resuelve
// por id. Elegir un insumo ERP en el buscador lo agrega a la copia LOCAL (para verlo y costearlo en pantalla), pero NO
// debe viajar a la config de todos: antes, una sesión de Dirección/Diseño que "usaba" un ERP lo escribía en producción
// (lo hizo el laboratorio de Cocrear con un Silestone) y cambiaba la huella del holdout a media corrida.
export function insumosCompartibles(insumos) {
  if (!insumos || typeof insumos !== 'object') return insumos;
  const out = {};
  for (const [id, ins] of Object.entries(insumos)) if (!(ins && ins.clasificacion === 'erp')) out[id] = ins;
  return out;
}
