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
import { esTubularD2 } from '../motor/calculo.js';

export const ESTADO_COSTO = Object.freeze({ VALIDADO: 'validado', PRELIMINAR: 'preliminar', BLOQUEADO: 'bloqueado' });
export const ETIQUETA_ESTADO = Object.freeze({ validado: 'COSTO VALIDADO', preliminar: 'COSTO PRELIMINAR', bloqueado: 'COSTO BLOQUEADO' });

/**
 * @param {{ emision: object, servidor?: { estado?: string, aprobacionHumana?: boolean, bomVigente?: boolean, advertencias?: string[] } | null }} e
 *   emision: salida de costeoEmitible + pendientes de estructura/lectura (como la arma la pantalla).
 *   servidor: última validación de costear-servidor para ESTE BOM (null si no hay o es de otro BOM).
 * @returns {{ estado: 'validado'|'preliminar'|'bloqueado', etiqueta: string, motivos: string[] }}
 */
// D3 (firmado por Dirección 2026-10-13): la tornillería sale del BOM (artículos con cantidad) o de la tabla de uniones de
// Producción. El "juego" genérico de $45 (insumo `tornilleria`) es un SUPUESTO: nunca deja el costo como validado.
export const TORNILLERIA_GENERICA = 'tornilleria';
// Estados del servidor con los que hay costo calculable. Cualquier otro (incompleto, bloqueado, desconocido) bloquea.
const ESTADOS_SRV_CALCULABLES = new Set(['certificado', 'preliminar']);

export function clasificarCosto({ emision = {}, servidor = null, componentes = [], insumos = null } = {}) {
  const b = emision.bloqueos || {};
  const pend = Array.isArray(emision.pendientes) ? emision.pendientes : [];
  const duros = [
    ...(b.datos_faltantes || []).map((x) => `Sin material o precio: ${x}`),
    ...(b.formato_incompatible || []),
    ...(b.tarifas_faltantes || []).map((x) => `Tarifa faltante: ${x}`),
    ...(b.costo_invalido ? ['Costo calculado inválido'] : []),
    ...pend.filter((p) => /^Estructura:|^Lectura de la IA incompleta/.test(String(p))),
  ];
  // Auditoría 2026-10-14 (P1-02): el SERVIDOR es autoridad. Si su validación vigente dice incompleto/bloqueado —o un
  // estado que no conocemos— el costo está BLOQUEADO aunque la pantalla no haya encontrado el motivo por su cuenta.
  const srvVigente = !!servidor && servidor.bomVigente !== false;
  if (srvVigente && !ESTADOS_SRV_CALCULABLES.has(servidor.estado)) {
    const adv = (Array.isArray(servidor.advertencias) ? servidor.advertencias : []).map(String);
    duros.push(`El servidor marca el costo como "${servidor.estado || 'sin estado'}"${adv.length ? `: ${adv.slice(0, 4).join(' · ')}` : '.'}`);
  }
  if (duros.length) return { estado: ESTADO_COSTO.BLOQUEADO, etiqueta: ETIQUETA_ESTADO.bloqueado, motivos: duros };
  const supuestos = [];
  const porConfirmar = b.materiales_por_confirmar || [];
  if ((componentes || []).some((c) => c && !c.excluida && c.insumoId === TORNILLERIA_GENERICA))
    supuestos.push('Tornillería como juego genérico: falta la tornillería por unión según el despiece o la tabla de Producción (D3).');
  // D2 firmada por Dirección, pendiente la ratificación de Producción (merma de corte): calcula, pero no valida.
  const tubD2 = insumos ? (componentes || []).filter((c) => c && !c.excluida && c.insumoId && esTubularD2(insumos[c.insumoId])) : [];
  if (tubD2.length) supuestos.push(`Tubular por fracción de tramo (D2): falta que Producción ratifique la merma de corte (${tubD2.slice(0, 3).map((c) => c.nombre).join(', ')}).`);
  // P1-01: confirmar el MATERIAL de una pieza no confirma que la pieza EXISTA. Una pieza que la IA infirió o supuso
  // (no la vio) necesita `pieza_confirmada` de una persona; mientras tanto el costo no puede quedar validado.
  const noObservadas = (componentes || []).filter((c) => c && !c.excluida && (c.procedencia === 'INFERIDO' || c.procedencia === 'SUPUESTO') && c.pieza_confirmada !== true);
  if (noObservadas.length) supuestos.push(`${noObservadas.length} pieza(s) que la IA infirió sin verla, sin confirmar que existen: ${noObservadas.slice(0, 4).map((c) => c.nombre).join(', ')}${noObservadas.length > 4 ? '…' : ''}`);
  if (porConfirmar.length) supuestos.push(`${porConfirmar.length} material(es) propuestos sin confirmar: ${porConfirmar.slice(0, 4).join(', ')}${porConfirmar.length > 4 ? '…' : ''}`);
  if (!srvVigente) supuestos.push('El servidor aún no validó este despiece.');
  else if (servidor.estado === 'preliminar') supuestos.push('El servidor lo calcula como "preliminar": hay precios sin certificar.');
  else if (servidor.aprobacionHumana !== true) supuestos.push('Hay precios aprobados sin firma humana verificada (p. ej. por la cuenta de prueba).');
  if (supuestos.length) return { estado: ESTADO_COSTO.PRELIMINAR, etiqueta: ETIQUETA_ESTADO.preliminar, motivos: supuestos };
  return { estado: ESTADO_COSTO.VALIDADO, etiqueta: ETIQUETA_ESTADO.validado, motivos: [] };
}
