// ============================================================================
//  GENERADOR TEAMSPACE II · guía GE_TeamSpace II (ESP-DCC-IDP-003).
//  Soporte METÁLICO para pantallas de 48"–55" (no es mueble con cubierta).
//  Modelo único, 2 variantes: FIJO a mesa (clave TSPTP48CF, porta 800×803×336)
//  y MÓVIL con ruedas (TSPTP48M, 913×1409×913). Estructura de lámina + guías
//  izq/der + (móvil) base con rodajas + pintura electrostática. La caja
//  eléctrica START + HDMI se cotiza APARTE. Colores blanco/negro (costo igual).
//  FASE A: dims reales de la guía; lámina estimada en kg (falta desarrollo real).
// ============================================================================
const LAMINA = 'lamina-20';

export const TEAMSPACE2_PRODUCTOS = [
  {
    id: 'soporte',
    nombre: 'Soporte de pantalla (48"–55")',
    selects: [
      { key: 'variante', label: 'Tipo', opciones: [{ id: 'fijo', label: 'Fijo a mesa' }, { id: 'movil', label: 'Móvil (con ruedas)' }] },
      { key: 'color', label: 'Color', opciones: [{ id: 'blanco', label: 'Blanco' }, { id: 'negro', label: 'Negro' }] },
    ],
    checks: [{ key: 'electrico', label: 'Caja eléctrica START 2.2 + HDMI' }],
  },
];

export function generarTeamspace2(config) {
  const c = { producto: 'soporte', variante: 'fijo', color: 'blanco', electrico: false, ...config };
  const movil = c.variante === 'movil';
  const comp = [];
  const claves = [];

  // Porta pantalla (estructura metálica principal). Lámina estimada por kg.
  comp.push({ insumoId: LAMINA, nombre: `Porta pantalla ${movil ? '913×1409×913' : '800×803×336'} mm (lámina)`, cantidad: movil ? 32 : 18 });
  // Guías izquierda / derecha para la pantalla (2 piezas)
  comp.push({ insumoId: LAMINA, nombre: 'Guías izq/der para pantalla', cantidad: 2 });

  if (movil) {
    // El TSPTP48M ya integra la base/columna en el porta pantalla (32 kg arriba); NO va base aparte.
    comp.push({ insumoId: 'rodaja', nombre: 'Rodajas (ROSPCFTBPM)', cantidad: 4 });
    claves.push('TSPTP48M', 'ROSPCFTBPM');
  } else {
    claves.push('TSPTP48CF');
  }
  comp.push({ insumoId: 'tornilleria', nombre: 'Imán IM175 + tornillería base', cantidad: 1 });

  // Acabado y tornillería
  comp.push({ insumoId: 'pintura-electrostatica', nombre: `Pintura electrostática (${c.color})`, cantidad: movil ? 5 : 3 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería (RO14GA / PI1225G / TOM8X20)', cantidad: 1 });

  // Eléctrico OPCIONAL (comprado, se cotiza aparte según la guía)
  if (c.electrico) {
    comp.push({ insumoId: 'caja-electrica', nombre: 'Caja eléctrica START 2.2 (BESMSTRT)', cantidad: 1 });
    comp.push({ insumoId: 'usb-hdmi', nombre: 'Conector HDMI (COBEZE18)', cantidad: 1 });
    claves.push('BESMSTRT22', 'COBEZE18');
  }

  return {
    producto: c.producto,
    nombre: `Soporte de pantalla TeamSpace II ${movil ? 'móvil' : 'fijo'} · ${c.color}`,
    componentes: comp,
    claves,
    electricos: c.electrico ? ['Caja START 2.2 + HDMI (se cotiza aparte)'] : [],
    modoManoObra: 'porcentaje', factorDirecta: 40, factorIndirecta: 12,
    nota: 'TeamSpace II (Fase A): soporte metálico de pantalla 48"–55". Lámina estimada por kg; falta el desarrollo real de lámina por clave + tiempos de metal (corte/doblez/soldadura/pintura). La caja eléctrica se cotiza aparte.',
  };
}
