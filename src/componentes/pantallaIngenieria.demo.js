// ============================================================================
//  ACCIONES DE DEMO de la Pantalla de Ingenieria — SOLO para el montaje de demo
//  (#ingenieria-demo) y el E2E. NUNCA lo importa el componente de produccion.
//  Aqui viven los datos de prueba (desarrollo CAD de ejemplo, intento de MO sin
//  autoria) que JAMAS deben poder aprobar datos reales. Son fixtures, no aprobaciones.
// ============================================================================

export function accionesDemo() {
  return [
    {
      // Geometria de CAD (entrada de Ingenieria, NO es una aprobacion economica): recalcula y saca a CUE de pendientes.
      id: 'confirmar-cad-cue',
      label: 'Confirmar desarrollo CAD del cuerpo (demo)',
      confirmacion: { tipo: 'desarrollo', clave: 'TELSVH120-CUE', desarrollo_mm: [2770, 865], fuente: 'CAD (DEMO)', version: 'cad-cue-demo' },
    },
    {
      // Intento de cargar MO SIN autoria autoritativa: debe ser RECHAZADO (auditoria p1/p3).
      id: 'intentar-estandares-sin-autoria',
      label: 'Intentar MO sin autoría (demo → se rechaza)',
      confirmacion: { tipo: 'estandares', estandares: [{ centro: 'metalmecánica', op: 'corte_lamina', tiempo_proceso_min: 2, tarifa_mxn_min: 8, lote_piezas: 1 }] },
    },
  ];
}
