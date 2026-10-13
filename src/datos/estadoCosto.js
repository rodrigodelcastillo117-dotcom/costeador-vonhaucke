// ============================================================================
//  ESTADO DEL COSTO EN TRES NIVELES (Dirección 2026-10-13): VALIDADO · PRELIMINAR · BLOQUEADO. Una sola función para la
//  pantalla y el expediente: antes la pantalla decía "Costo preliminar" mientras el servidor decía "incompleto" (lab
//  credenza). Los estados internos del servidor (certificado/preliminar/incompleto/bloqueado) NO cambian: Cotizar, Cocrear
//  y los gates siguen leyéndolos igual; esto es la lectura para la persona, con sus motivos.
//   · BLOQUEADO: no hay base defendible — falta material o precio, formato incompatible, costo inválido, un validador de
//     Ingeniería en rojo o una lectura de la IA incompleta sin revisar.
//   · PRELIMINAR: se puede calcular, con supuestos identificados — materiales propuestos sin confirmar, sin validación
//     del servidor, o precios sin aprobación HUMANA verificada (los aprobados por la cuenta de prueba no cuentan).
//   · VALIDADO: el servidor certifica Y declara que todos los precios tienen aprobación humana (`aprobacionHumana`).
// ============================================================================
export const ESTADO_COSTO = Object.freeze({ VALIDADO: 'validado', PRELIMINAR: 'preliminar', BLOQUEADO: 'bloqueado' });
export const ETIQUETA_ESTADO = Object.freeze({ validado: 'COSTO VALIDADO', preliminar: 'COSTO PRELIMINAR', bloqueado: 'COSTO BLOQUEADO' });

/**
 * @param {{ emision: object, servidor?: { estado?: string, aprobacionHumana?: boolean, bomVigente?: boolean } | null }} e
 *   emision: salida de costeoEmitible + pendientes de estructura/lectura (como la arma la pantalla).
 *   servidor: última validación de costear-servidor para ESTE BOM (null si no hay o es de otro BOM).
 * @returns {{ estado: 'validado'|'preliminar'|'bloqueado', etiqueta: string, motivos: string[] }}
 */
// D3 (firmado por Dirección 2026-10-13): la tornillería sale del BOM (artículos con cantidad) o de la tabla de uniones de
// Producción. El "juego" genérico de $45 (insumo `tornilleria`) es un SUPUESTO: nunca deja el costo como validado.
export const TORNILLERIA_GENERICA = 'tornilleria';

export function clasificarCosto({ emision = {}, servidor = null, componentes = [] } = {}) {
  const b = emision.bloqueos || {};
  const pend = Array.isArray(emision.pendientes) ? emision.pendientes : [];
  const duros = [
    ...(b.datos_faltantes || []).map((x) => `Sin material o precio: ${x}`),
    ...(b.formato_incompatible || []),
    ...(b.tarifas_faltantes || []).map((x) => `Tarifa faltante: ${x}`),
    ...(b.costo_invalido ? ['Costo calculado inválido'] : []),
    ...pend.filter((p) => /^Estructura:|^Lectura de la IA incompleta/.test(String(p))),
  ];
  if (duros.length) return { estado: ESTADO_COSTO.BLOQUEADO, etiqueta: ETIQUETA_ESTADO.bloqueado, motivos: duros };
  const supuestos = [];
  const porConfirmar = b.materiales_por_confirmar || [];
  if ((componentes || []).some((c) => c && !c.excluida && c.insumoId === TORNILLERIA_GENERICA))
    supuestos.push('Tornillería como juego genérico: falta la tornillería por unión según el despiece o la tabla de Producción (D3).');
  if (porConfirmar.length) supuestos.push(`${porConfirmar.length} material(es) propuestos sin confirmar: ${porConfirmar.slice(0, 4).join(', ')}${porConfirmar.length > 4 ? '…' : ''}`);
  if (!servidor || servidor.bomVigente === false) supuestos.push('El servidor aún no validó este despiece.');
  else if (servidor.estado !== 'certificado') supuestos.push(`El servidor lo calcula como "${servidor.estado || 'sin estado'}": hay precios sin certificar.`);
  else if (servidor.aprobacionHumana !== true) supuestos.push('Hay precios aprobados sin firma humana verificada (p. ej. por la cuenta de prueba).');
  if (supuestos.length) return { estado: ESTADO_COSTO.PRELIMINAR, etiqueta: ETIQUETA_ESTADO.preliminar, motivos: supuestos };
  return { estado: ESTADO_COSTO.VALIDADO, etiqueta: ETIQUETA_ESTADO.validado, motivos: [] };
}
