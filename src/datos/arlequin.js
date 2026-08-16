// ============================================================================
//  GENERADOR ARLEQUÍN · guía GE (ESP-DCC-IDP-003). Serie de TABURETES,
//  CILINDROS y CUBOS (poufs) para sentarse un rato — NO es sofá ni sillón.
//  Base 400×400 mm, alto 300/400/600; formas cubo/cilindro/curvo, opción
//  rodante. Espuma + tapiz (tela/piel/ecopiel/pielette). Claves ARL / TTARQ.
//  ARL30 (400×400×300), ARL40 (×400), ARL60 (×600), ARLCUR (curvo),
//  ARLRO (rodante). FASE A: dims reales; MP estimada.
//  ⚠️ Es LÍNEA DISTINTA a Tetris (sofás) y Pac (sillón chico).
// ============================================================================
const ESPUMA = 'espuma';
const TAPIZ = { tela: 'tela', ecopiel: 'ecopiel', piel: 'piel-napa' };

export const ARLEQUIN_PRODUCTOS = [
  {
    id: 'pouf',
    nombre: 'Taburete / cubo Arlequín',
    selects: [
      { key: 'forma', label: 'Forma', opciones: [{ id: 'cubo', label: 'Cubo' }, { id: 'curvo', label: 'Curvo' }] },
      { key: 'alto', label: 'Alto', opciones: [{ id: '300', label: '0.30 m' }, { id: '400', label: '0.40 m' }, { id: '600', label: '0.60 m' }] },
    ],
    finishes: [{ id: 'tela', label: 'Tela' }, { id: 'ecopiel', label: 'Ecopiel' }, { id: 'piel', label: 'Piel' }],
    checks: [{ key: 'rodante', label: 'Rodante (con ruedas)' }],
  },
];

const num = (v, def) => parseInt(v) || def;

export function generarArlequin(config) {
  const c = { producto: 'pouf', forma: 'cubo', alto: '400', finish: 'tela', rodante: false, ...config };
  const alto = num(c.alto, 400) / 1000;   // m
  const lado = 0.40;                        // 400 mm
  const tap = TAPIZ[c.finish] || TAPIZ.tela;
  const comp = [];
  const claves = [];

  // Espuma: bloque (aprox por su área envolvente equivalente)
  const areaEnvolvente = 4 * (lado * alto) + lado * lado;   // 4 caras + tapa
  comp.push({ insumoId: ESPUMA, nombre: `Espuma ${c.forma} 40×40×${num(c.alto, 400)}`, cantidad: Math.max(0.5, areaEnvolvente * 0.9) });
  // Tapiz de las caras + tapa
  comp.push({ insumoId: tap, nombre: `Tapiz (${c.finish})`, cantidad: areaEnvolvente * 1.15 });
  // Base inferior (tabla) + tornillería
  comp.push({ insumoId: 'mdf', nombre: 'Base inferior (tabla)', cantidad: 1, largoMM: 400, anchoMM: 400 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería', cantidad: 1 });
  if (c.rodante) comp.push({ insumoId: 'rodaja', nombre: 'Ruedas', cantidad: 4 });

  // Clave real: conmuta por acabado. Piel/ecopiel de curvo/rodante/modular usan prefijo TTARQ.
  const n = num(c.alto, 400), code = n / 10;   // 30/40/60
  let cve;
  if (c.forma === 'curvo') {
    cve = c.rodante ? `ARLCURO${code}` : (c.finish === 'piel' ? `TTARQCU${code}P` : c.finish === 'ecopiel' ? `TTARQCU${code}EP` : `ARLCU${code}`);
  } else if (c.rodante) {
    cve = c.finish === 'ecopiel' ? `ARLRO${code}ECP` : `ARLRO${code}TE`;
  } else if (c.finish === 'piel') {
    cve = `TTARQ${code}P`;
  } else if (c.finish === 'ecopiel') {
    cve = `ARL${code}ECP`;
  } else {
    cve = n === 300 ? 'ARL30ETV' : `ARL${code}-ET`;
  }
  claves.push(cve);

  return {
    producto: c.producto,
    nombre: `Arlequín ${c.forma} 0.40×${(num(c.alto, 400) / 1000).toFixed(2)} m · ${c.finish}${c.rodante ? ' · rodante' : ''}`,
    componentes: comp, claves, electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 42, factorIndirecta: 12,
    nota: 'Arlequín (Fase A): pouf/taburete de espuma tapizada. MP estimada; falta rendimiento real de espuma/tapiz + tiempos de tapicería.',
  };
}
