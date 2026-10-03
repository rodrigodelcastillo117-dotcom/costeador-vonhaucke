// ============================================================================
//  E2E DE DOMINIO (determinista, sin LLM): simula la propuesta semántica que
//  devuelve analizar-mueble para los 7 casos obligatorios + el ejemplo que FALLÓ,
//  y la pasa por el pipeline REAL del cliente:
//     SemanticProposal → graphFromPropuesta → StructuralGraph → RenderSpecV1
//     y la POLÍTICA DE MATERIAL sobre cada pieza.
//  Prueba las invariantes que Dirección va a ver, sin depender del modelo vivo.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { graphFromPropuesta } from './structuralGraph.js';
import { renderSpecFromGraph } from './renderSpec.js';
import { aplicarPoliticaMaterial, MATCH } from './materialMatch.js';

// Catálogo de cliente simulado (lo que existe para costear). Incluye solid surface
// azul (alta reciente), inox, lámina, PET, portamonitor; y mdf/laminado para probar
// que NUNCA se usan como sustituto silencioso de otra familia.
const INSUMOS = {
  'solid-surface-azul': { id: 'solid-surface-azul', nombre: 'Superficie sólida 12 mm AZUL mineral', seccion: 'cubiertas' },
  'inoxidable': { id: 'inoxidable', nombre: 'Acero inoxidable 304 cal. 20', seccion: 'metal' },
  'lamina-14': { id: 'lamina-14', nombre: 'Lamina de acero cal. 14', seccion: 'metal' },
  'cristal-satinado': { id: 'cristal-satinado', nombre: 'Cristal satinado 9 mm', seccion: 'cubiertas' },
  'pet-acustico': { id: 'pet-acustico', nombre: 'PET acustico 9 mm', seccion: 'mamparas' },
  'portamonitor-loktec-d7a': { id: 'portamonitor-loktec-d7a', nombre: 'Portamonitor Loktec D7A', seccion: 'electrico' },
  'mdf': { id: 'mdf', nombre: 'MDF 19 mm', seccion: 'cubiertas' },
  'laminado': { id: 'laminado', nombre: 'Laminado plastico HPL', seccion: 'cubiertas' },
};
const resolver = (id) => INSUMOS[id];
const aplicar = (piezas) => piezas.map((z) => aplicarPoliticaMaterial({ ...z, material_solicitado: z.material_solicitado || z.nombre }, resolver));

describe('E2E dominio — CASO 1: banca aeropuerto 4 plazas tapizada + conector cada 2', () => {
  const prop = {
    producto: 'Banca de aeropuerto 4 plazas',
    descripcionCliente: 'Banca de espera de aeropuerto, 4 plazas tapizadas, con conector cada 2 asientos.',
    design_intent: { product_type: 'banca de aeropuerto 4 plazas', module_count: 4, seat_count: 4, user_capacity: 4, assumptions: [], missing_critical_data: [] },
    piezas: [
      { nombre: 'Asiento', semantic_role: 'asiento', insumoId: '', material_solicitado: 'espuma tapizada', cantidad: 4 },
      { nombre: 'Respaldo', semantic_role: 'respaldo', insumoId: '', material_solicitado: 'espuma tapizada', cantidad: 4 },
      { nombre: 'Estructura', semantic_role: 'estructura', insumoId: 'lamina-14', material_solicitado: 'lámina de acero', cantidad: 1 },
      { nombre: 'Conector', semantic_role: 'conector', insumoId: 'lamina-14', material_solicitado: 'lámina de acero', cantidad: 2 },
    ],
  };
  it('capacidad/asientos correctos y perfil aeropuerto', () => {
    const g = graphFromPropuesta(prop);
    const spec = renderSpecFromGraph(g, { descripcion: prop.descripcionCliente });
    expect(spec.counts.seat_count).toBe(4);
    expect(spec.counts.user_capacity).toBe(4);
    expect(spec.visual_profile).toBe('airport_checkin');
  });
});

describe('E2E dominio — CASO 2: counter CHECK-IN solid surface azul + inox + cristal + eléctrico', () => {
  const prop = {
    producto: 'Counter de check-in',
    descripcionCliente: 'Mostrador de documentación / check-in de aeropuerto con cubierta de superficie sólida azul, estructura de acero inoxidable, mampara de cristal y módulo eléctrico.',
    design_intent: { product_type: 'counter de check-in', module_count: 1, seat_count: 0, user_capacity: 0, assumptions: [], missing_critical_data: [] },
    piezas: [
      { nombre: 'Cubierta', semantic_role: 'cubierta', insumoId: 'solid-surface-azul', material_solicitado: 'superficie sólida azul', cantidad: 1, forma: 'area', largoMM: 2400, anchoMM: 700 },
      { nombre: 'Estructura', semantic_role: 'estructura', insumoId: 'inoxidable', material_solicitado: 'acero inoxidable', cantidad: 1 },
      { nombre: 'Mampara', semantic_role: 'mampara', insumoId: 'cristal-satinado', material_solicitado: 'cristal', cantidad: 1 },
      { nombre: 'Módulo eléctrico/USB', semantic_role: 'herraje', insumoId: 'portamonitor-loktec-d7a', material_solicitado: 'módulo eléctrico', cantidad: 2 },
    ],
  };
  it('solid surface azul se conserva (EXACT), no se sustituye', () => {
    const comps = aplicar(prop.piezas);
    const cubierta = comps.find((c) => c.nombre === 'Cubierta');
    expect(cubierta.insumoId).toBe('solid-surface-azul');
    expect(cubierta._match.clase).toBe(MATCH.EXACT);
  });
  it('render: mineral azul, perfil aeropuerto, geometría bloqueada', () => {
    const g = graphFromPropuesta(prop);
    const spec = renderSpecFromGraph(g, { materiales: ['Superficie sólida 12 mm AZUL mineral', 'Acero inoxidable 304'], descripcion: prop.descripcionCliente });
    expect(spec.visual_profile).toBe('airport_checkin');
    expect(spec.material_families).toEqual(expect.arrayContaining(['superficie_solida', 'acero_inoxidable']));
    expect(spec.finishes.join(' ')).toMatch(/mineral matte seamless/);
    expect(spec.finishes.join(' ')).toMatch(/no wood grain/);
    expect(spec.locked_geometry).toBe(true);
  });
});

describe('E2E dominio — CASO 3: armero/gobierno (NO es escritorio)', () => {
  const prop = {
    producto: 'Armero',
    descripcionCliente: 'Armero / rack de armas para gobierno, estructura de metal, puertas con seguridad.',
    design_intent: { product_type: 'armero', module_count: 1, seat_count: 0, user_capacity: 0, assumptions: [], missing_critical_data: [] },
    piezas: [
      { nombre: 'Estructura', semantic_role: 'estructura', insumoId: 'lamina-14', material_solicitado: 'lámina de acero', cantidad: 1 },
      { nombre: 'Puerta', semantic_role: 'puerta', insumoId: 'lamina-14', material_solicitado: 'lámina de acero', cantidad: 4 },
    ],
  };
  it('perfil militar, sin asientos, cuenta puertas', () => {
    const g = graphFromPropuesta(prop);
    const spec = renderSpecFromGraph(g, { descripcion: prop.descripcionCliente });
    expect(spec.visual_profile).toBe('military');
    expect(spec.counts.seat_count).toBe(0);
    expect(spec.counts.door_count).toBe(4);
    expect(spec.product_type).not.toMatch(/escritorio|desk/i);
  });
});

describe('E2E dominio — CASO 4 y 5: retail/kiosko y farmacia', () => {
  it('kiosko retail → perfil retail/kiosk', () => {
    const g = graphFromPropuesta({ design_intent: { product_type: 'kiosko retail', module_count: 1, seat_count: 0, user_capacity: 0 }, piezas: [{ nombre: 'Cuerpo', semantic_role: 'estructura', insumoId: 'mdf', cantidad: 1 }] });
    const spec = renderSpecFromGraph(g, { descripcion: 'kiosko de retail Viveroo' });
    expect(['retail', 'kiosk']).toContain(spec.visual_profile);
  });
  it('farmacia → perfil pharmacy', () => {
    const g = graphFromPropuesta({ design_intent: { product_type: 'mostrador de farmacia', module_count: 1, seat_count: 0, user_capacity: 0 }, piezas: [{ nombre: 'Mostrador', semantic_role: 'cubierta', insumoId: 'mdf', cantidad: 1 }] });
    const spec = renderSpecFromGraph(g, { descripcion: 'mostrador y góndola de farmacia' });
    expect(spec.visual_profile).toBe('pharmacy');
  });
});

describe('E2E dominio — CASO 6: PET Sonara ≠ MDF', () => {
  it('PET pedido y disponible → EXACT; si el modelo intentara MDF → se bloquea', () => {
    const ok = aplicarPoliticaMaterial({ nombre: 'Mampara', insumoId: 'pet-acustico', material_solicitado: 'PET acústico Sonara', cantidad: 1 }, resolver);
    expect(ok.insumoId).toBe('pet-acustico');
    expect(ok._match.clase).toBe(MATCH.EXACT);
    const malo = aplicarPoliticaMaterial({ nombre: 'Mampara', insumoId: 'mdf', material_solicitado: 'PET acústico Sonara', cantidad: 1 }, resolver);
    expect(malo.insumoId).toBe(''); // NUNCA PET → MDF
    expect(malo._match.clase).toBe(MATCH.SUBSTITUTE_REQUIRES_CONFIRMATION);
  });
});

describe('E2E dominio — CASO 7: portamonitores (componente comprado)', () => {
  it('se mapea al insumo comprado, no se fabrica', () => {
    const c = aplicarPoliticaMaterial({ nombre: 'Portamonitor', insumoId: 'portamonitor-loktec-d7a', material_solicitado: 'portamonitor Loktec', cantidad: 2 }, resolver);
    expect(c.insumoId).toBe('portamonitor-loktec-d7a');
    expect(c._match.clase).toBe(MATCH.EXACT);
  });
});

describe('E2E — EL EJEMPLO QUE FALLÓ: barra comunal 6 personas, solid surface azul, base lámina, 4 módulos eléctricos', () => {
  const prop = {
    producto: 'Barra alta comunal',
    descripcionCliente: 'Banca alta comunal tipo barra para 6 personas, 3 por lado, cubierta de superficie sólida azul 3600x750, altura 1050, base de lámina de acero doblada y pintada, viga central, niveladores, 4 módulos eléctricos/USB, cableado oculto. No incluye bancos.',
    design_intent: { product_type: 'barra alta comunal', module_count: 1, seat_count: 0, user_capacity: 6, overall_dimensions: '3600x750x1050', assumptions: [], missing_critical_data: [] },
    piezas: [
      { nombre: 'Cubierta', semantic_role: 'cubierta', insumoId: 'solid-surface-azul', material_solicitado: 'superficie sólida azul', cantidad: 1, forma: 'area', largoMM: 3600, anchoMM: 750 },
      { nombre: 'Base', semantic_role: 'estructura', insumoId: 'lamina-14', material_solicitado: 'lámina de acero doblada', cantidad: 1 },
      { nombre: 'Módulo eléctrico/USB', semantic_role: 'herraje', insumoId: 'modulo-usb-byrne', material_solicitado: 'módulo eléctrico USB', cantidad: 4 },
    ],
  };
  it('6 personas NO se vuelven 6 módulos; es 1 módulo monolítico, capacidad 6, sin asientos', () => {
    const g = graphFromPropuesta(prop);
    const spec = renderSpecFromGraph(g, { materiales: ['Superficie sólida 12 mm AZUL mineral', 'Lamina de acero'], descripcion: prop.descripcionCliente });
    expect(spec.counts.module_count).toBe(1);
    expect(spec.counts.user_capacity).toBe(6);
    expect(spec.counts.seat_count).toBe(0);
    expect(spec.counts.electrical_module_count).toBe(4);
  });
  it('superficie sólida azul permanece superficie sólida (no MDF/HPL)', () => {
    const comps = aplicar(prop.piezas);
    const cubierta = comps.find((c) => c.nombre === 'Cubierta');
    expect(cubierta.insumoId).toBe('solid-surface-azul');
    expect(cubierta._match.clase).toBe(MATCH.EXACT);
  });
  it('si el catálogo NO tuviera solid surface, se marca pendiente (no se inventa, no MDF)', () => {
    const sinSS = (id) => (id === 'solid-surface-azul' ? undefined : INSUMOS[id]);
    const comp = aplicarPoliticaMaterial({ nombre: 'Cubierta', insumoId: 'solid-surface-azul', material_solicitado: 'superficie sólida azul', cantidad: 1 }, sinSS);
    expect(comp.insumoId).toBe('');
    expect(comp._match.clase).toBe(MATCH.NOT_AVAILABLE);
  });
});
