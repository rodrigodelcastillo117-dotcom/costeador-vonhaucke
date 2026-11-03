// ============================================================================
//  CONTRATO DE SUBSISTEMAS DE FABRICACIÓN (COSTEAR 100 · FASE 4 / B)
//  --------------------------------------------------------------------------
//  "NO TODO MUEBLE ES UN ESCRITORIO." En lugar de asumir cubierta/costados/cajones,
//  se descompone cualquier mueble en SUBSISTEMAS de fabricación. Cada subsistema
//  tiene una UBICACIÓN ECONÓMICA INEQUÍVOCA para impedir omisiones y dobles cargos
//  (directiva FASE 4: "No mezcles costos de fábrica con costos logísticos o
//  partidas comerciales. Cada concepto debe tener una ubicación económica
//  inequívoca."). Permite agregar familias nuevas sin reescribir el motor.
//
//  Este módulo CLASIFICA (determinista) y documenta DÓNDE vive el costo; NO calcula
//  dinero (eso es del motor). Es consistente con el motor: 'herrajes' es compra-venta
//  (decisión Dirección 2026-11-03), estructura/panelería son fabricados, el embalaje
//  y la logística/montaje en sitio son partida de PROYECTO (no costo de fábrica).
// ============================================================================

import { rolDe } from './revisionEstructural.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Ubicación económica: dónde vive el costo del subsistema.
//  'fabrica'      = fabricado por VH: material + MO de fabricación + GIF.
//  'compra_venta' = comprado e instalado: material íntegro + MO/GIF mínimos (traslado).
//  'proyecto'     = partida comercial a nivel proyecto (NO costo de fábrica): embalaje, logística, montaje en sitio, maniobras.
//  'confirmar'    = depende de la decisión (equipos: fabricado / comprado e instalado / subcontratado / suministrado por cliente / excluido).
export const UBICACION = { FABRICA: 'fabrica', COMPRA_VENTA: 'compra_venta', PROYECTO: 'proyecto', CONFIRMAR: 'confirmar' };

// Subsistemas en ORDEN DE PRIORIDAD de clasificación (más específico primero).
// Cada uno: clave, nombre, ubicación económica, roles que lo delatan, y palabras clave.
export const SUBSISTEMAS = [
  {
    clave: 'equipos', nombre: 'Equipos integrados', ubicacion: UBICACION.CONFIRMAR,
    nota: 'Depende: fabricado por VH, comprado e instalado, subcontratado, suministrado por el cliente o excluido. Confirmar.',
    roles: new Set(), palabras: /refrigerador|nevera|pantalla|monitor|display|televis|equipo integrado|dispensador|ventilador|compresor|microondas/,
  },
  {
    clave: 'electrico', nombre: 'Electricidad e iluminación', ubicacion: UBICACION.COMPRA_VENTA,
    nota: 'LED/driver/transformador se compran; la instalación y pruebas llevan MO. No mezclar con estructura.',
    roles: new Set(), palabras: /\bled\b|driver|transformador|balastr|cablead|interruptor|pasacable|\btoma\b|luminari|ilumina|tira de luz|electric|eliminador|contactos?/,
  },
  {
    clave: 'transparentes', nombre: 'Componentes transparentes', ubicacion: UBICACION.COMPRA_VENTA,
    nota: 'Vidrio/acrílico normalmente se compran y cortan (posible tercero) y se instalan.',
    roles: new Set(['cristal']), palabras: /cristal|vidrio|templado|acrilico|policarbonato|espejo/,
  },
  {
    clave: 'herrajes', nombre: 'Herrajes y accesorios', ubicacion: UBICACION.COMPRA_VENTA,
    nota: 'Compra-venta (decisión Dirección 2026-11-03): se compran ya hechos y se instalan (MO 1% / GI 5%).',
    roles: new Set(['herraje']), palabras: /bisagra|corredera|jaladera|cerradura|nivelador|tornill|\briel\b|escuadra|minifix|regaton|conector|acoplador/,
  },
  {
    clave: 'acabados', nombre: 'Acabados y recubrimientos', ubicacion: UBICACION.FABRICA,
    nota: 'Procesos sobre la pieza (pintura, laca, canto). Gráfica/vinil pueden ir a tercero: confirmar en ese caso.',
    roles: new Set(), palabras: /pintura|electrostatic|\bpph\b|polvo|\blaca\b|barniz|recubrimiento|laminad|vinil|serigraf|grafic|adhesivo|\bcanto\b|tapacanto|sellador|esmalte|enchapad/,
  },
  {
    clave: 'estructura', nombre: 'Estructura', ubicacion: UBICACION.FABRICA,
    nota: 'Metal/soporte fabricado: lámina, tubular, PTR, perfil, solera, ángulo, bastidor, refuerzos, patas.',
    roles: new Set(['pata']), palabras: /\blamina\b|tubular|\bptr\b|perfil|solera|angulo|placa|acero|bastidor|refuerzo|omega|travesa|larguero|poste|zoclo|zocalo|pedestal/,
  },
  {
    clave: 'paneleria', nombre: 'Panelería y carpintería', ubicacion: UBICACION.FABRICA,
    nota: 'Tableros fabricados: melamina, MDF, MDP, triplay, HPL, chapa; cubiertas, costados, puertas, cajones, entrepaños.',
    roles: new Set(['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'fondo', 'respaldo', 'gaveta', 'frente_cajon']),
    palabras: /melamina|\bmdf\b|\bmdp\b|aglomerad|triplay|contrachapad|\bhpl\b|chapa|tablero|cubierta|entrepano|respaldo|\bfondo\b|puerta|caj[oó]n|gaveta|tira de madera|madera de pino|madera maciza|madera solida|\bduela\b|\btabl[oó]n\b/,
  },
  {
    clave: 'embalaje_logistica', nombre: 'Embalaje, logística y montaje', ubicacion: UBICACION.PROYECTO,
    nota: 'Partida de PROYECTO, no costo de fábrica: embalaje, maniobras, transporte, instalación en sitio.',
    roles: new Set(), palabras: /embalaj|empaque|emplay|carton|esquiner|flejad|burbuja|estiba|tarima|maniobra|instalacion en sitio|montaje en sitio|transporte|\bflete\b/,
  },
];

/** Subsistema de una pieza (por rol semántico + palabras del nombre/material). null si no se puede clasificar. */
export function subsistemaDePieza(pieza = {}, insumos = null) {
  const nombreInsumo = insumos && pieza.insumoId && insumos[pieza.insumoId] ? insumos[pieza.insumoId].nombre : '';
  const texto = sinAcentos(`${pieza.nombre || ''} ${pieza.material_solicitado || ''} ${nombreInsumo}`);
  const rol = pieza.semantic_role && String(pieza.semantic_role).trim()
    ? String(pieza.semantic_role).trim().toLowerCase()
    : rolDe(pieza.nombre || pieza.insumoId || '');
  // El ROL semántico es señal más fuerte que una palabra suelta: primero rol (una
  // "cubierta" es panelería aunque su texto diga "laminado"), luego palabras.
  for (const s of SUBSISTEMAS) if (s.roles.has(rol)) return s.clave;
  for (const s of SUBSISTEMAS) if (s.palabras.test(texto)) return s.clave;
  return null;
}

/**
 * Clasifica el despiece por subsistema y resume la UBICACIÓN ECONÓMICA de cada uno.
 * Sirve a la vista "ASÍ LO FABRICARÍA" (FASE 14) y a evitar mezclar costo de fábrica
 * con partidas de proyecto. NO calcula dinero.
 */
export function clasificarPorSubsistema(entrada = {}) {
  const piezasIn = Array.isArray(entrada.piezas) ? entrada.piezas
    : Array.isArray(entrada.componentes) ? entrada.componentes : [];
  const insumos = entrada.insumos || null;
  const defPorClave = Object.fromEntries(SUBSISTEMAS.map((s) => [s.clave, s]));
  const grupos = {};
  let sinClasificar = 0;
  for (const p of piezasIn) {
    if (!p || p.excluida) continue;
    const clave = subsistemaDePieza(p, insumos);
    if (!clave) { sinClasificar += 1; continue; }
    if (!grupos[clave]) {
      const d = defPorClave[clave];
      grupos[clave] = { clave, nombre: d.nombre, ubicacion: d.ubicacion, nota: d.nota, piezas: [], n: 0 };
    }
    grupos[clave].piezas.push(p.nombre || p.insumoId || '(pieza)');
    grupos[clave].n += 1;
  }
  const presentes = Object.keys(grupos);
  const porUbicacion = { fabrica: [], compra_venta: [], proyecto: [], confirmar: [] };
  for (const g of Object.values(grupos)) porUbicacion[g.ubicacion].push(g.clave);
  return {
    grupos,
    presentes,
    sinClasificar,
    resumen: {
      fabrica: porUbicacion.fabrica,
      compra_venta: porUbicacion.compra_venta,
      proyecto: porUbicacion.proyecto,
      confirmar: porUbicacion.confirmar,
      // ¿Hay algún subsistema cuya ubicación económica aún debe confirmarse (equipos)?
      requiere_decision_economica: porUbicacion.confirmar.length > 0,
    },
  };
}

/** Catálogo de subsistemas (para UI/documentación). */
export function catalogoSubsistemas() {
  return SUBSISTEMAS.map((s) => ({ clave: s.clave, nombre: s.nombre, ubicacion: s.ubicacion, nota: s.nota }));
}
