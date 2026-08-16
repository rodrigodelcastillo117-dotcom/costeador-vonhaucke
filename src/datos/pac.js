// ============================================================================
//  GENERADOR PAC · guía GE (ESP-DCC-IDP-003). Sillón PEQUEÑO y SIMPLE SIN
//  BRAZOS, de dimensiones mínimas, componible (se unen con placa inferior
//  para formar filas / sofás). Bastidor + espuma + tapiz + placa de unión.
//  Tapiz tela/pielette/ecopiel/piel. Claves PAC / TTSOFP.
//  FASE A: dims estimadas (~600×600×750); MP estimada.
//  ⚠️ Es LÍNEA DISTINTA a Tetris (sofás modulares) y Arlequín (poufs).
// ============================================================================
const ESPUMA = 'espuma';
const TAPIZ = { tela: 'tela', ecopiel: 'ecopiel', piel: 'piel-napa', pielette: 'ecopiel' };

export const PAC_PRODUCTOS = [
  {
    id: 'sillon',
    nombre: 'Sillón Pac (sin brazos)',
    selects: [
      { key: 'plazas', label: 'Plazas', opciones: [{ id: '1', label: '1 plaza' }, { id: '2', label: '2 plazas' }, { id: '3', label: '3 plazas (sofá)' }] },
    ],
    finishes: [{ id: 'tela', label: 'Tela' }, { id: 'pielette', label: 'Pielette' }, { id: 'ecopiel', label: 'Ecopiel' }, { id: 'piel', label: 'Piel' }],
    checks: [{ key: 'placa', label: 'Placa de unión (para formar filas)' }],
  },
];

const num = (v, def) => parseInt(v) || def;

export function generarPac(config) {
  const c = { producto: 'sillon', plazas: '1', finish: 'tela', placa: false, ...config };
  const asientos = num(c.plazas, 1);        // 1/2/3 plazas — sofá 3 plazas = 1800×600
  const tap = TAPIZ[c.finish] || TAPIZ.tela;
  const ancho = 0.60 * asientos;   // ~600 mm por asiento
  const fondo = 0.60, altoResp = 0.45;
  const comp = [];
  const claves = [];

  // Bastidor de madera (estructura interna) por asiento
  comp.push({ insumoId: 'bastidor-madera', nombre: 'Bastidor de madera', cantidad: asientos });
  // Espuma (asiento + respaldo)
  const areaEsp = ancho * fondo + ancho * altoResp;
  comp.push({ insumoId: ESPUMA, nombre: 'Espuma PU (asiento + respaldo)', cantidad: areaEsp });
  // Tapiz
  comp.push({ insumoId: tap, nombre: `Tapiz (${c.finish})`, cantidad: areaEsp * 1.7 });
  // Placa inferior de unión (opcional)
  if (c.placa) comp.push({ insumoId: 'lamina-20', nombre: 'Placa inferior de unión (lámina)', cantidad: 2 * asientos });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería', cantidad: 1 });

  // Clave real conmuta por acabado: tela→PACSOINT, pielette→TTSOFP22V, ecopiel→TTSOFP22EP, piel→TTSOFP22P.
  const sufFin = { tela: '', pielette: 'V', ecopiel: 'EP', piel: 'P' }[c.finish] ?? '';
  claves.push(c.finish === 'tela' ? 'PACSOINT' : `TTSOFP2${asientos}${sufFin}`);

  return {
    producto: c.producto,
    nombre: `Sillón Pac ${asientos} plaza${asientos > 1 ? 's' : ''} (${(ancho).toFixed(2)}×0.60 m) · ${c.finish}`,
    componentes: comp, claves, electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 42, factorIndirecta: 12,
    nota: 'Pac (Fase A): sillón chico sin brazos, componible. MP estimada; falta despiece real del bastidor + rendimiento de espuma/tapiz + tiempos de tapicería.',
  };
}
