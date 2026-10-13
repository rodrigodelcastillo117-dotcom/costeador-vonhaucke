// ============================================================================
//  REVISIÓN ESTRUCTURAL (determinista) — el "cerebro que RAZONA" del Costeador
//  avanzado. No inventa costo ni dimensiones: analiza el despiece como un CONJUNTO
//  y señala relaciones físicas que no cuadran, para que el usuario confirme/corrija.
//  Es la parte fiable del modelo estructural (IA propone/detecta; el motor costea).
//
//  Clasifica cada observación en: 'info' | 'warning' | 'blocker'.
//  Fuente de verdad: los componentes capturados (+ descripción libre opcional).
// ============================================================================

// Rol semántico de una pieza a partir de su nombre (heurística de taller, es-MX).
const ROLES = [
  ['herraje', /\b(herraje|tornill\w*|bisagras?|correderas?|niveladores?|jaladeras?|cerraduras?)\b/i],
  ['frente_cajon', /\bfrentes?\b/i],
  ['cubierta', /\b(cubierta|tapa|top|sobre|superficie)\b/i],
  ['faldon', /\bfald[oó]n\b/i],
  ['lateral', /\b(lateral|laterales|costados?|panel lateral)\b/i],
  ['gaveta', /\b(gaveta|caj[oó]n|cajonera)\b/i],
  // VH-163b (2026-10-13, mesa de trabajo V5): sólo reconocía singulares; "Patas PTR", "Travesaños", "Postes"
  // caían en 'otro' → falso bloqueo "cubierta sin soporte" y la regla de niveladores no se disparaba.
  ['pata', /\b(patas?|bases?|estructuras?|bastidor(es)?|travesa[ñn]os?|postes?|soportes?|largueros?|pedestal(es)?|zoclos?|z[oó]calos?)\b/i],
  ['respaldo', /\brespaldo\b/i],
  ['asiento', /\b(asiento|banca|silla|plaza|butaca)\b/i],
  ['entrepano', /\b(entrepa[ñn]os?|repisas?|estantes?|anaquel)\b/i],
  ['fondo', /\b(fondo|trasero|panel trasero)\b/i],
  ['puerta', /\bpuertas?\b/i],
  ['conector', /\b(conector|uni[oó]n|ensamble|acoplador)\b/i],
  ['espuma', /\b(espuma|hule espuma|poliuretano|acolchad)\b/i],
  ['tapiz', /\b(tapiz|tela|piel|vinil|ecopiel|tapizado)\b/i],
  ['cristal', /\b(cristal|vidrio|templado)\b/i],
];

import { familiaDeMaterial, espesoresDe } from './materialMatch.js';
import { REGLAS_TALLER } from './reglasTaller.js';

// STRUCTURAL_LINT: etiqueta interna. Esto es un guardrail determinista (regex/heurística),
// NO el motor de comprensión del mueble (ese es analizar-mueble → structuralGraph).
export const TIPO = 'STRUCTURAL_LINT';

// Rol semántico de una pieza por su nombre. Exportado para que `structuralGraph.js`
// reuse la MISMA detección (una sola fuente de roles, sin duplicar).
export function rolDe(nombre = '') {
  for (const [rol, re] of ROLES) if (re.test(nombre)) return rol;
  return 'otro';
}

// ¿La descripción sugiere un tipo de mueble? (para validar coherencia del conjunto)
function tipoIntencion(desc = '') {
  const t = String(desc).toLowerCase();
  if (/\b(banca|sillas?|butaca|espera|plazas?|asientos?|seating|lounge)\b/.test(t)) return 'asientos';
  if (/\b(credenza|gabinete|archivero|caj[oó]n|librero|alacena)\b/.test(t)) return 'gabinete';
  if (/\b(escritorio|mesa|mostrador|recepci[oó]n|cubierta|table|desk)\b/.test(t)) return 'superficie';
  return null;
}

/**
 * Analiza el despiece como conjunto y devuelve observaciones accionables.
 * @param {{componentes?:Array, descripcion?:string, piezas?:number}} entrada
 * @returns {{roles: object, observaciones: Array<{nivel:string, mensaje:string, pieza?:string}>, resumen: object}}
 */
export function revisarEstructura({ componentes = [], descripcion = '', insumos = null } = {}) {
  const comps = Array.isArray(componentes) ? componentes.filter((c) => c && (c.nombre || c.insumoId)) : [];
  const conRol = comps.map((c) => ({ ...c, _rol: rolDe(c.nombre || c.insumoId || '') }));
  const roles = {};
  for (const c of conRol) roles[c._rol] = (roles[c._rol] || 0) + 1;
  const hay = (r) => (roles[r] || 0) > 0;
  const obs = [];
  const intencion = tipoIntencion(descripcion);

  if (comps.length === 0) {
    obs.push({ nivel: 'info', mensaje: 'Aún no hay piezas. Describe el mueble o agrega su primera pieza.' });
    return { roles, observaciones: obs, resumen: { piezas: 0, intencion } };
  }

  // 1) Gaveta/cajón sin cuerpo que la contenga.
  if (hay('gaveta') && !hay('lateral') && !hay('puerta') && !hay('entrepano')) {
    obs.push({ nivel: 'warning', pieza: conRol.find((c) => c._rol === 'gaveta')?.nombre,
      mensaje: 'Tienes una gaveta/cajón pero no veo un cuerpo que la contenga (costados, puertas o entrepaños). ¿Falta el gabinete, o la gaveta pertenece a otra sección?' });
  }

  // 2) Faldón vertical: su "ancho" suele ser la ALTURA. Confirmar.
  const faldon = conRol.find((c) => c._rol === 'faldon' && c.anchoMM);
  if (faldon) {
    obs.push({ nivel: 'info', pieza: faldon.nombre,
      mensaje: `Capturaste un faldón de ${faldon.largoMM}×${faldon.anchoMM} mm. Si es vertical, ${faldon.anchoMM} mm sería su ALTURA. ¿Correcto?` });
  }

  // 3) Asientos/respaldos sin estructura de soporte.
  const nAsiento = roles['asiento'] || 0;
  const nRespaldo = roles['respaldo'] || 0;
  if ((intencion === 'asientos' || nAsiento > 0 || nRespaldo > 0) && !hay('pata')) {
    obs.push({ nivel: 'warning',
      mensaje: 'Parece mobiliario de asiento, pero no veo estructura de soporte (patas, travesaño o base). Para uso público (aeropuerto) necesitas la estructura que los sostiene.' });
  }

  // 4) Espuma/tapizado sin asiento ni respaldo al que pertenezcan.
  if ((hay('espuma') || hay('tapiz')) && nAsiento === 0 && nRespaldo === 0) {
    obs.push({ nivel: 'info',
      mensaje: 'Hay espuma/tapizado pero no una pieza de asiento o respaldo a la que pertenezcan. ¿Falta nombrarlos?' });
  }

  // 5) Conector mencionado en la descripción pero no capturado.
  if (/\bconector(es)?\b/i.test(descripcion) && !hay('conector')) {
    obs.push({ nivel: 'info',
      mensaje: 'Mencionas conectores entre módulos, pero no hay una pieza "conector" en el despiece. ¿La agregamos?' });
  }

  // 6) Mueble de superficie sin cubierta.
  if (intencion === 'superficie' && !hay('cubierta')) {
    obs.push({ nivel: 'info', mensaje: 'Describes una superficie (mesa/escritorio/mostrador) pero no hay una cubierta en el despiece.' });
  }

  // 7) Coherencia de intención: la descripción dice asientos pero el despiece parece superficie.
  if (intencion === 'asientos' && hay('cubierta') && nAsiento === 0 && nRespaldo === 0) {
    obs.push({ nivel: 'warning',
      mensaje: 'La descripción habla de asientos, pero el despiece parece una superficie (cubierta) sin asientos/respaldos. Revisa si es el mueble correcto.' });
  }

  // 9) VH-163 · MUEBLE DE PISO SIN SOPORTE (bloqueo). Corrida V3 de la mesa de centro: la IA devolvió sólo la
  //    cubierta de cristal (confianza "alta", sin verificación) y el costo de $870 se transfirió a Cotizar sin la base
  //    tubular ni el cromado. Una cubierta no se sostiene sola: si el mueble es una mesa/escritorio/credenza/gabinete y
  //    no hay patas, base, estructura ni laterales, el despiece está INCOMPLETO y no se da el costo por bueno.
  //    (Una cubierta de reposición sola es legítima: por eso sólo aplica cuando la intención es el mueble completo.)
  const muebleCompleto = /\b(mesa|escritorio|mostrador|recepci[oó]n|credenza|gabinete|archivero|librero|alacena|table|desk)\b/i.test(descripcion)
    && !/reposici[oó]n|refacci[oó]n|repuesto|s[oó]lo (la )?cubierta|cubierta suelta/i.test(descripcion);
  if (muebleCompleto && hay('cubierta') && !hay('pata') && !hay('lateral')) {
    obs.push({ nivel: 'blocker', regla: 'sin_soporte',
      mensaje: 'El despiece tiene la cubierta pero ningún soporte (patas, base, estructura o laterales). Una cubierta no se sostiene sola: falta la base del mueble. Agrégala o vuelve a analizar antes de dar el costo por bueno.' });
  }

  // ---- REGLAS DE CASA (2026-10-12) · consistencia de materiales. Deterministas; avisan, no cambian solas.
  const nombreMat = (c) => (insumos && c.insumoId && insumos[c.insumoId] && insumos[c.insumoId].nombre) || c.material_solicitado || '';
  const fam = (c) => familiaDeMaterial(nombreMat(c));
  const PANEL_VISIBLE = new Set(['cubierta', 'lateral', 'entrepano', 'puerta', 'faldon', 'frente_cajon']);
  const PANELES = new Set(['melamina', 'laminado_hpl', 'chapa_madera', 'madera_solida']);
  const hayAcabadoTablero = conRol.some((c) => PANEL_VISIBLE.has(c._rol) && PANELES.has(fam(c)));
  // Laca/pintura PARA TABLERO (la electrostática del acero no cuenta: va en el metal).
  const hayLaca = conRol.some((c) => /\blaca|lacad|barniz|pintura.*(mdf|madera|tablero|repisa|panel)/i.test(`${c.nombre || ''} ${c.material_solicitado || ''}`));
  // 8) Pieza VISIBLE en MDF crudo mientras el resto va en melamina/laminado y no hay laca.
  if (hayAcabadoTablero && !hayLaca) {
    for (const c of conRol) {
      if (PANEL_VISIBLE.has(c._rol) && fam(c) === 'mdf') {
        obs.push({ nivel: 'warning', pieza: c.nombre, regla: 'acabado_consistente',
          mensaje: `«${c.nombre}» va en MDF crudo mientras el resto lleva melamina/laminado. O lleva laca (línea aparte) o cámbiala a melamina del mismo acabado; si no, se ve distinta.` });
      }
    }
  }
  // 9) Respaldo/fondo con sobre-espesor (> 12 mm): normalmente 9–12 mm; se avisa, no se cambia.
  for (const c of conRol) {
    if (c._rol !== 'respaldo' && c._rol !== 'fondo') continue;
    const esp = espesoresDe(nombreMat(c)).filter((x) => x <= 60);
    if (esp.length && Math.min(...esp) > REGLAS_TALLER.respaldo.espesorMaxMM) {
      obs.push({ nivel: 'info', pieza: c.nombre, regla: 'respaldo_espesor',
        mensaje: `«${c.nombre}» en ${Math.min(...esp)} mm: un respaldo/fondo suele ir en 9–12 mm (más barato y ligero). Déjalo si es portante o visible por detrás.` });
    }
  }
  // 10) Entrepaño/repisa con claro ≥ 800 mm: recomendar travesaño según la carga (no se agrega solo).
  for (const c of conRol) {
    if (c._rol !== 'entrepano') continue;
    const claro = Math.max(Number(c.largoMM) || 0, Number(c.anchoMM) || 0);
    if (claro >= REGLAS_TALLER.refuerzo.claroMM) {
      obs.push({ nivel: 'info', pieza: c.nombre, regla: 'refuerzo_claro',
        mensaje: `«${c.nombre}» tiene ${claro} mm de claro: si cargará productos pesados (≥ 15 kg), agrega un travesaño trasero o un canto grueso para que no pandee.` });
    }
  }

  if (obs.length === 0) obs.push({ nivel: 'info', mensaje: 'La estructura se ve coherente con las piezas capturadas.' });
  return { roles, observaciones: obs, resumen: { piezas: comps.length, intencion, nAsiento, nRespaldo } };
}
