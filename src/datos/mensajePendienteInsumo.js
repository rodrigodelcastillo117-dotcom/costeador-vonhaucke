import { familiaDeMaterial } from './materialMatch.js';

// No sugerir que una BISAGRA necesita espesor o que un LED es una lámina.
// Mensajes diferenciados por naturaleza del insumo para el Costeador móvil.
export function mensajePendienteInsumo(solicitado = '') {
  const fam = familiaDeMaterial(solicitado);
  const s = String(solicitado || '').toLowerCase();
  if (fam === 'melamina' || fam === 'mdf' || fam === 'aglomerado') {
    return 'El plano identifica el tablero, pero falta el artículo exacto o una referencia costeable con precio configurado. No se inventará el acabado ni el costo.';
  }
  if (fam === 'metal_lamina' || fam === 'acero_inoxidable' || fam === 'aluminio' || fam === 'cristal') {
    return 'Falta confirmar perfil/calibre, espesor o formato. Un sustituto puede modificar peso, resistencia, desperdicio e instalación. Se permite comparar costos, no emitir ni dar por aprobada ingeniería.';
  }
  if (/bisagr|jalader|nivelador|herrajes?|led|luminaria|refrigerador|electr|kit\b|contacto|cerradura/.test(s)) {
    return 'Falta confirmar el artículo y sus especificaciones (modelo, tamaño o capacidad). El espesor de tablero no aplica. Si existe en el catálogo, puedes elegirlo arriba; si no, debe darse de alta con precio validado.';
  }
  return 'Falta vincular un insumo concreto del catálogo con precio utilizable. Mantén el costo pendiente hasta identificarlo.';
}
