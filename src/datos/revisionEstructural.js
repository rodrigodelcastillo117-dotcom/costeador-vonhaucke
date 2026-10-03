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
  ['cubierta', /\b(cubierta|tapa|top|sobre|superficie)\b/i],
  ['faldon', /\bfald[oó]n\b/i],
  ['lateral', /\b(lateral|costado|panel lateral)\b/i],
  ['gaveta', /\b(gaveta|caj[oó]n|cajonera)\b/i],
  ['pata', /\b(pata|base|estructura|bastidor|travesa[ñn]o|poste|soporte)\b/i],
  ['respaldo', /\brespaldo\b/i],
  ['asiento', /\b(asiento|banca|silla|plaza|butaca)\b/i],
  ['entrepano', /\b(entrepa[ñn]o|repisa|estante)\b/i],
  ['puerta', /\bpuerta\b/i],
  ['conector', /\b(conector|uni[oó]n|ensamble|acoplador)\b/i],
  ['espuma', /\b(espuma|hule espuma|poliuretano|acolchad)\b/i],
  ['tapiz', /\b(tapiz|tela|piel|vinil|ecopiel|tapizado)\b/i],
  ['herraje', /\b(herraje|tornill|bisagra|corredera|nivelador|jaladera)\b/i],
  ['cristal', /\b(cristal|vidrio|templado)\b/i],
];

function rolDe(nombre = '') {
  for (const [rol, re] of ROLES) if (re.test(nombre)) return rol;
  return 'otro';
}

// ¿La descripción sugiere un tipo de mueble? (para validar coherencia del conjunto)
function tipoIntencion(desc = '') {
  const t = String(desc).toLowerCase();
  if (/\b(banca|sillas?|butaca|espera|plazas?|asientos?|seating|lounge)\b/.test(t)) return 'asientos';
  if (/\b(credenza|gabinete|archivero|caj[oó]n|librero|alacena)\b/.test(t)) return 'gabinete';
  if (/\b(escritorio|mesa|mostrador|recepci[oó]n|cubierta)\b/.test(t)) return 'superficie';
  return null;
}

/**
 * Analiza el despiece como conjunto y devuelve observaciones accionables.
 * @param {{componentes?:Array, descripcion?:string, piezas?:number}} entrada
 * @returns {{roles: object, observaciones: Array<{nivel:string, mensaje:string, pieza?:string}>, resumen: object}}
 */
export function revisarEstructura({ componentes = [], descripcion = '' } = {}) {
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

  if (obs.length === 0) obs.push({ nivel: 'info', mensaje: 'La estructura se ve coherente con las piezas capturadas.' });
  return { roles, observaciones: obs, resumen: { piezas: comps.length, intencion, nAsiento, nRespaldo } };
}
