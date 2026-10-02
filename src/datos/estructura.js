// ============================================================================
//  ANÁLISIS ESTRUCTURAL — N3. Capa PURA, SEPARADA del BOM certificado.
//  Lista los componentes que un mueble "debería" tener y con qué evidencia se
//  conocen. NO toca ALBA ni el BOM certificado: si lo que se analiza difiere del
//  BOM, se emite un PROPUESTA_DIFF para que un humano lo acepte o rechace
//  (nunca se modifica el BOM en silencio).
// ============================================================================
import { FUENTES, evidencia, confianzaDeFuente } from './evidencia.js';

// Vocabulario de componentes (el que pidió Rodrigo para N3).
export const COMPONENTES = Object.freeze([
  'carcasa', 'laterales', 'tapas', 'fondos', 'respaldos', 'frentes', 'cajones',
  'puertas', 'bisagras', 'correderas', 'soportes', 'refuerzos', 'zoclos', 'marcos',
  'listonados', 'metal', 'cristal', 'piedra', 'tapiceria', 'electricos',
  'iluminacion', 'herrajes', 'tapacantos', 'fijaciones', 'instalacion',
]);

// Componentes típicos esperados por familia de mueble (checklist estructural).
// Son SUPUESTOS razonables; se marcan como SUPUESTO hasta que haya evidencia.
const ESPERADOS = {
  escritorio: ['carcasa', 'laterales', 'tapas', 'soportes', 'tapacantos', 'fijaciones'],
  cajonera: ['carcasa', 'laterales', 'fondos', 'frentes', 'cajones', 'correderas', 'herrajes', 'tapacantos'],
  credenza: ['carcasa', 'laterales', 'tapas', 'fondos', 'puertas', 'bisagras', 'herrajes', 'tapacantos', 'zoclos'],
  archivero: ['carcasa', 'laterales', 'fondos', 'frentes', 'cajones', 'correderas', 'herrajes', 'fijaciones'],
  mesa: ['tapas', 'soportes', 'refuerzos', 'tapacantos', 'fijaciones'],
  mampara: ['marcos', 'tapiceria', 'metal', 'fijaciones'],
  generico: ['carcasa', 'laterales', 'tapas', 'tapacantos', 'fijaciones'],
};

export function esperadosDe(tipo) {
  return ESPERADOS[tipo] || ESPERADOS.generico;
}

function normComp(c) {
  return String(c || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

/**
 * Analiza la estructura de un mueble. Combina el checklist esperado por tipo con
 * las observaciones (p.ej. de un plano/render), cada una con su FUENTE. Lo no
 * observado queda SUPUESTO. NO inventa cantidades ni toca el BOM.
 * @param {{tipo?:string, observados?:Array<{componente:string,fuente:string,cantidad?:number,origen?:string}>}} mueble
 */
export function analizarEstructura(mueble = {}) {
  const tipo = mueble.tipo || 'generico';
  const observadosPorComp = new Map();
  for (const o of (mueble.observados || [])) {
    const k = normComp(o.componente);
    if (!k) continue;
    // Si hay varias observaciones del mismo componente, gana la de mayor confianza.
    const prev = observadosPorComp.get(k);
    if (!prev || confianzaDeFuente(o.fuente) > confianzaDeFuente(prev.fuente)) observadosPorComp.set(k, o);
  }

  const esperados = esperadosDe(tipo).map(normComp);
  const universo = Array.from(new Set([...esperados, ...observadosPorComp.keys()]));

  const componentes = universo.map((comp) => {
    const obs = observadosPorComp.get(comp);
    if (obs) {
      return {
        componente: comp,
        cantidad: obs.cantidad ?? null,
        evidencia: evidencia(true, obs.fuente, { origen: obs.origen, nota: obs.nota }),
        esperado: esperados.includes(comp),
      };
    }
    // Esperado pero no observado → SUPUESTO (hay que confirmarlo).
    return {
      componente: comp,
      cantidad: null,
      evidencia: evidencia(true, FUENTES.SUPUESTO, { nota: 'Esperado por tipo de mueble; sin evidencia directa.' }),
      esperado: true,
    };
  });

  const confianza = componentes.length
    ? Math.round((componentes.reduce((s, c) => s + c.evidencia.confianza, 0) / componentes.length) * 100) / 100
    : 0;

  return {
    tipo,
    componentes,
    supuestos: componentes.filter((c) => c.evidencia.fuente === FUENTES.SUPUESTO).map((c) => c.componente),
    confianza,
    requiereConfirmacion: componentes.some((c) => c.evidencia.fuente === FUENTES.SUPUESTO),
  };
}

/**
 * Compara la estructura analizada contra el BOM certificado y produce un
 * PROPUESTA_DIFF. NO muta el BOM: sólo describe qué cambiaría si se aceptara.
 * @param {object} estructura  resultado de analizarEstructura
 * @param {Array<{componente:string,cantidad?:number}>} bom  BOM certificado
 * @returns {{agregados:string[], eliminados:string[], cambiados:Array, sinCambios:boolean}}
 */
export function diffContraBOM(estructura, bom = []) {
  const enBom = new Map((bom || []).map((b) => [normComp(b.componente), b]));
  const enEst = new Map((estructura?.componentes || []).map((c) => [normComp(c.componente), c]));

  const agregados = [];   // en estructura, no en BOM
  const eliminados = [];  // en BOM, no en estructura
  const cambiados = [];   // en ambos con cantidad distinta

  for (const [k, c] of enEst) {
    if (!enBom.has(k)) { agregados.push(k); continue; }
    const b = enBom.get(k);
    if (c.cantidad != null && b.cantidad != null && Number(c.cantidad) !== Number(b.cantidad)) {
      cambiados.push({ componente: k, bom: Number(b.cantidad), propuesto: Number(c.cantidad) });
    }
  }
  for (const k of enBom.keys()) if (!enEst.has(k)) eliminados.push(k);

  return {
    agregados, eliminados, cambiados,
    sinCambios: agregados.length === 0 && eliminados.length === 0 && cambiados.length === 0,
  };
}
