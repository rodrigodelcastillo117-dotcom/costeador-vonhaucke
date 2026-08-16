// ============================================================================
//  GENERADOR TETRIS · guía GE_Tetris (ESP-DCC-IDP-003). Sistema de SILLONES /
//  SOFÁS MODULARES tapizados. Subfamilia "Tetris 123": sofá individual, doble
//  (2 plazas) y triple (3 plazas). Base METÁLICA + espuma de poliuretano +
//  tapiz (tela/ecopiel/piel). Claves prefijo TES / TE.
//  Individual: base TESTIEM 736×613×655, asiento TESIAT 600×600×150,
//  respaldo TESIRT 600×300×120, brazos TESDBLTT 440×330. Doble TESTDPEM 1336,
//  triple TESTTPEM 1936. FASE A: dims reales de la guía; MP estimada.
//  ⚠️ Es LÍNEA DISTINTA a Arlequín (poufs) y Pac (sillón chico).
// ============================================================================
const LAMINA = 'lamina-20', ESPUMA = 'espuma';
const TAPIZ = { tela: 'tela', ecopiel: 'ecopiel', piel: 'piel-napa' };

export const TETRIS_PRODUCTOS = [
  {
    id: 'sofa',
    nombre: 'Sofá Tetris 123',
    selects: [
      { key: 'plazas', label: 'Plazas', opciones: [{ id: '1', label: 'Individual' }, { id: '2', label: '2 plazas' }, { id: '3', label: '3 plazas' }] },
    ],
    finishes: [{ id: 'tela', label: 'Tela' }, { id: 'ecopiel', label: 'Ecopiel' }, { id: 'piel', label: 'Piel' }],
    checks: [{ key: 'ruedas', label: 'Base con ruedas' }],
  },
];

const num = (v, def) => parseInt(v) || def;

export function generarTetris(config) {
  const c = { producto: 'sofa', plazas: '1', finish: 'tela', ruedas: false, ...config };
  const n = num(c.plazas, 1);
  const tap = TAPIZ[c.finish] || TAPIZ.tela;
  const largoAsiento = 600 * n;       // 600 / 1200 / 1800 mm
  const fondo = 600;
  const baseLargo = 736 + (n - 1) * 600; // 736 / 1336 / 1936 mm
  const comp = [];
  const claves = [];

  // Base metálica (estructura + panel de lámina; estimada por kg)
  comp.push({ insumoId: LAMINA, nombre: `Base metálica ${baseLargo}×613×655 mm`, cantidad: 10 + n * 6 });
  comp.push({ insumoId: 'pintura-electrostatica', nombre: 'Pintura electrostática (base)', cantidad: 1.5 * n });
  // Restricción de la guía: SOLO el individual puede llevar ruedas (doble y triple no).
  const ruedas = c.ruedas && n === 1;
  if (ruedas) comp.push({ insumoId: 'rodaja', nombre: 'Ruedas', cantidad: 4 });

  // Asiento: espuma + tapiz (área largo×fondo)
  const areaAsiento = (largoAsiento / 1000) * (fondo / 1000);
  comp.push({ insumoId: ESPUMA, nombre: `Asiento espuma PU (${largoAsiento}×600×150)`, cantidad: areaAsiento });
  comp.push({ insumoId: tap, nombre: `Asiento tapiz (${c.finish})`, cantidad: areaAsiento * 1.6 });

  // Respaldo: espuma + tapiz (área largo×0.30)
  const areaResp = (largoAsiento / 1000) * 0.30;
  comp.push({ insumoId: ESPUMA, nombre: 'Respaldo espuma PU', cantidad: areaResp });
  comp.push({ insumoId: tap, nombre: `Respaldo tapiz (${c.finish})`, cantidad: areaResp * 1.6 });

  // Descansabrazos (2): espuma + tapiz (0.44×0.33 c/u)
  const areaBrazos = 2 * 0.44 * 0.33;
  comp.push({ insumoId: ESPUMA, nombre: 'Descansabrazos espuma (2)', cantidad: areaBrazos });
  comp.push({ insumoId: tap, nombre: `Descansabrazos tapiz (${c.finish})`, cantidad: areaBrazos * 1.6 });

  // Niveladores + tornillería
  comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería (incluida)', cantidad: 1 });

  // Claves reales por plaza: base + asiento + respaldo cambian con n.
  const base = ['TESTIEM', 'TESTDPEM', 'TESTTPEM'][n - 1] || 'TESTIEM';
  const asiento = ['TESIAT', 'TESDPAT', 'TESTPAT'][n - 1] || 'TESIAT';
  const respaldo = ['TESIRT', 'TESDPRT', 'TESTPRT'][n - 1] || 'TESIRT';
  claves.push(base, asiento, respaldo, 'TESDBLTT');

  return {
    producto: c.producto,
    nombre: `Sofá Tetris ${['individual', '2 plazas', '3 plazas'][n - 1]} · ${c.finish}`,
    componentes: comp, claves, electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 45, factorIndirecta: 12,
    nota: 'Tetris (Fase A): sofá modular tapizado (base metálica + espuma PU + tapiz). MP estimada; falta desarrollo real de lámina + rendimiento de espuma/tapiz + tiempos de tapicería. Complementos (paleta, mamparas, worklounge) por cargar.',
  };
}
