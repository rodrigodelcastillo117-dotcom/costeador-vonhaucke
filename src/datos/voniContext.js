// ============================================================================
//  VONI CONTEXT — contexto READ-ONLY y FILTRADO POR ROL que se le da a Voni, más las
//  "herramientas canónicas" deterministas que responden preguntas de negocio SIN que el
//  LLM invente nada (los bloqueos y el dinero son determinismo, no alucinación).
//
//  Regla de oro: el VENDEDOR nunca ve costo/margen/proveedores internos. Eso se filtra
//  AQUÍ, antes de que cualquier texto llegue al modelo.
// ============================================================================
import { bloqueosDeEmision } from './senales.js';

const ROLES_RENDER = new Set(['direccion', 'diseno', 'vendedor']);

/**
 * Arma el contexto que Voni puede usar/ver, ya filtrado por rol.
 * @param {{ruta?:string, pantalla?:string, usuario?:{rol?:string,email?:string}|null,
 *          cotizacion?:object|null, costeo?:object|null}} entrada
 */
export function construirVoniContext({ ruta = '', pantalla = '', usuario = null, cotizacion = null, costeo = null } = {}) {
  const rol = String(usuario?.rol || '').toLowerCase();
  const veInterno = rol === 'direccion'; // sólo Dirección ve costo/margen/desglose
  const partidas = Array.isArray(cotizacion?.partidas) ? cotizacion.partidas : [];
  const bloqueos = bloqueosDeEmision(partidas);
  return {
    ruta,
    pantalla,
    rol: rol || 'desconocido',
    capacidades: {
      ve_costo: veInterno,
      ve_margen: veInterno,
      puede_emitir: partidas.length > 0 && bloqueos.length === 0,
      puede_generar_render: ROLES_RENDER.has(rol),
    },
    cotizacion: cotizacion ? {
      id: cotizacion.id ?? null,
      revision_id: cotizacion.revisionId ?? cotizacion.revision_id ?? null,
      cliente: cotizacion.cliente ?? cotizacion.cliente_nombre ?? null,
      proyecto: cotizacion.proyecto ?? cotizacion.proyecto_nombre ?? null,
      partidas: partidas.length,
      bloqueos_n: bloqueos.length,
    } : null,
    // La lista cruda de bloqueos es neutra (qué corregir); no expone costo interno.
    bloqueos,
  };
}

/**
 * Herramienta canónica: "¿Por qué no puedo emitir esta cotización?" — respuesta
 * DETERMINISTA (qué / por qué / qué corregir), lista para mostrar o para que Voni la
 * verbalice. No inventa: sale de `bloqueosDeEmision`.
 * @param {{cotizacion?:{partidas?:Array}|null}} entrada
 * @returns {{puedeEmitir:boolean, resumen:string, bloqueos:Array}}
 */
export function porQueNoPuedoEmitir({ cotizacion = null } = {}) {
  const partidas = Array.isArray(cotizacion?.partidas) ? cotizacion.partidas : [];
  if (!partidas.length) {
    return { puedeEmitir: false, resumen: 'La cotización no tiene partidas todavía. Agrega al menos una para poder emitir.', bloqueos: [] };
  }
  const bloqueos = bloqueosDeEmision(partidas);
  if (bloqueos.length === 0) {
    return { puedeEmitir: true, resumen: 'Lista para emitir: todas las partidas tienen cantidad, precio y material.', bloqueos: [] };
  }
  const n = bloqueos.length;
  return {
    puedeEmitir: false,
    resumen: `No se puede emitir todavía: ${n} ${n === 1 ? 'cosa necesita' : 'cosas necesitan'} corregirse antes de mandar la cotización al cliente.`,
    bloqueos,
  };
}
