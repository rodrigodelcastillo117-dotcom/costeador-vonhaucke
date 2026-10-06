import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION, validateStructuralGraph, graphFromBom, graphFromPropuesta, structuralGraphToBom } from './structuralGraph.js';

describe('validateStructuralGraph', () => {
  const base = () => ({
    schema_version: SCHEMA_VERSION,
    design_intent: { product_type: 'escritorio', description: '', overall_dimensions: {}, quantity: 1 },
    nodes: [
      { id: 'a', semantic_role: 'cubierta', parent_id: null, quantity: 1, geometry: { type: 'panel', length_mm: 1500, width_mm: 600 }, source: 'ai', confidence: 0.6, insumo_id: 'melamina-28' },
      { id: 'b', semantic_role: 'pata', parent_id: null, quantity: 2, source: 'ai', insumo_id: 'ptr' },
    ],
    relations: [{ type: 'supports', from: 'b', to: 'a' }],
  });
  it('grafo válido → ok', () => { expect(validateStructuralGraph(base()).ok).toBe(true); });
  it('schema_version malo → inválido', () => { const g = base(); g.schema_version = 'x'; expect(validateStructuralGraph(g).ok).toBe(false); });
  it('id duplicado → inválido', () => { const g = base(); g.nodes[1].id = 'a'; const r = validateStructuralGraph(g); expect(r.ok).toBe(false); expect(r.code).toBe('STRUCTURAL_GRAPH_INVALID'); });
  it('parent inexistente → inválido', () => { const g = base(); g.nodes[0].parent_id = 'zzz'; expect(validateStructuralGraph(g).ok).toBe(false); });
  it('ciclo en parent → inválido', () => { const g = base(); g.nodes[0].parent_id = 'b'; g.nodes[1].parent_id = 'a'; expect(validateStructuralGraph(g).ok).toBe(false); });
  it('quantity 0 → inválido', () => { const g = base(); g.nodes[0].quantity = 0; expect(validateStructuralGraph(g).ok).toBe(false); });
  it('dimensión negativa → inválido', () => { const g = base(); g.nodes[0].geometry.length_mm = -5; expect(validateStructuralGraph(g).ok).toBe(false); });
  it('relación a nodo inexistente → inválido', () => { const g = base(); g.relations[0].to = 'nope'; expect(validateStructuralGraph(g).ok).toBe(false); });
  it('insumo_id vacío (no null) → inválido', () => { const g = base(); g.nodes[0].insumo_id = ''; expect(validateStructuralGraph(g).ok).toBe(false); });
});

describe('graphFromBom — levanta el BOM a grafo (sin LLM)', () => {
  it('banca de aeropuerto: asientos, respaldos y estructura con relación de soporte', () => {
    const piezas = [
      { nombre: 'Asiento', insumoId: 'espuma', piezas: 4, largoMM: 500, anchoMM: 450 },
      { nombre: 'Respaldo', insumoId: 'espuma', piezas: 4, largoMM: 500, anchoMM: 400 },
      { nombre: 'Travesaño estructural', insumoId: 'ptr', piezas: 1, largoMM: 2200 },
      { nombre: 'Conector', insumoId: 'escuadra', piezas: 2 },
    ];
    const g = graphFromBom(piezas, { tipo: 'banca', descripcion: 'banca de aeropuerto 4 plazas' });
    expect(validateStructuralGraph(g).ok).toBe(true);
    const roles = g.nodes.map((n) => n.semantic_role);
    expect(g.nodes.find((n) => n.semantic_role === 'asiento').quantity).toBe(4);
    expect(roles).toContain('respaldo');
    expect(roles).toContain('pata');
    expect(g.relations.some((r) => r.type === 'supports')).toBe(true);
    expect(g.design_intent.product_type).toBe('banca');
  });

  it('caso ambiguo: cubierta+faldón+lateral+gaveta sin descripción → unknown + warning', () => {
    const piezas = [
      { nombre: 'Cubierta', insumoId: 'marmol', largoMM: 1500, anchoMM: 600 },
      { nombre: 'Faldón', insumoId: 'mdf-16', largoMM: 1500, anchoMM: 600 },
      { nombre: 'Lateral', insumoId: 'mdf-16', largoMM: 240, anchoMM: 900 },
      { nombre: 'gaveta', insumoId: 'lamina-18' },
    ];
    const g = graphFromBom(piezas, {});
    expect(g.design_intent.product_type).toBe('unknown');
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.relations.some((r) => r.type === 'contains')).toBe(true);
    expect(validateStructuralGraph(g).ok).toBe(true);
  });

  it('round-trip graphFromBom → structuralGraphToBom conserva trazabilidad (legacy)', () => {
    const piezas = [{ nombre: 'Cubierta', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600, piezas: 1 }];
    const g = graphFromBom(piezas, { tipo: 'escritorio', descripcion: 'escritorio' });
    const r = structuralGraphToBom(g);
    expect(r.ok).toBe(true);
    expect(r.filas[0].insumoId).toBe('melamina-28');
    expect(r.filas[0].graph_node_id).toBe(g.nodes[0].id);
    expect(r.filas[0].semantic_role).toBe('cubierta');
  });
});

describe('graphFromPropuesta — camino ideal: usa la semántica del LLM, no regex', () => {
  const bancaAeropuerto = {
    producto: 'Banca de aeropuerto 4 plazas',
    descripcionCliente: 'Banca de espera de 4 plazas en aluminio con asientos y respaldos tapizados.',
    design_intent: { product_type: 'banca de aeropuerto 4 plazas', module_count: 4, overall_dimensions: '2200x600x800', assumptions: ['aluminio estructural'], missing_critical_data: ['calibre del tubo'] },
    piezas: [
      { nombre: 'Travesaño estructural', insumoId: 'ptr', cantidad: 1, largoMM: 2200, anchoMM: 60, confianza: 'alta', semantic_role: 'estructura', parent: '', relacion: '', relacion_con: '' },
      { nombre: 'Asiento', insumoId: 'espuma', cantidad: 4, largoMM: 500, anchoMM: 450, confianza: 'media', semantic_role: 'asiento', parent: '', relacion: 'soporta', relacion_con: '' },
      { nombre: 'Respaldo', insumoId: 'espuma', cantidad: 4, largoMM: 500, anchoMM: 400, confianza: 'media', semantic_role: 'respaldo', parent: '', relacion: '', relacion_con: '' },
      { nombre: 'Pata', insumoId: 'ptr', cantidad: 2, confianza: 'alta', semantic_role: 'pata', parent: '', relacion: 'soporta', relacion_con: 'Travesaño estructural' },
    ],
  };

  it('usa semantic_role del LLM (no rolDe) y conserva design_intent', () => {
    const g = graphFromPropuesta(bancaAeropuerto);
    expect(validateStructuralGraph(g).ok).toBe(true);
    expect(g.design_intent.product_type).toBe('banca de aeropuerto 4 plazas');
    expect(g.design_intent.quantity).toBe(4);
    expect(g.nodes.find((n) => n.semantic_role === 'asiento').quantity).toBe(4);
    expect(g.nodes.find((n) => n.semantic_role === 'estructura')).toBeTruthy();
  });

  it('resuelve relacion_con por NOMBRE → relación válida en el grafo', () => {
    const g = graphFromPropuesta(bancaAeropuerto);
    const pata = g.nodes.find((n) => n.semantic_role === 'pata');
    const trav = g.nodes.find((n) => n.semantic_role === 'estructura');
    expect(g.relations.some((r) => r.type === 'supports' && r.from === pata.id && r.to === trav.id)).toBe(true);
  });

  it('confianza baja o sin material → requires_confirmation', () => {
    const g = graphFromPropuesta({ design_intent: {}, piezas: [
      { nombre: 'Cubierta', insumoId: '', largoMM: 1500, anchoMM: 600, confianza: 'baja', semantic_role: 'cubierta' },
    ] });
    expect(g.nodes[0].requires_confirmation).toBe(true);
  });

  it('pieza SIN semantic_role → cae a rolDe() (fallback)', () => {
    const g = graphFromPropuesta({ design_intent: { product_type: 'escritorio' }, piezas: [
      { nombre: 'Cubierta principal', insumoId: 'melamina-28', largoMM: 1500, anchoMM: 600, cantidad: 1, confianza: 'alta' },
    ] });
    expect(g.nodes[0].semantic_role).toBe('cubierta');
    expect(validateStructuralGraph(g).ok).toBe(true);
  });

  it("product_type 'desconocido' → unknown + warning", () => {
    const g = graphFromPropuesta({ design_intent: { product_type: 'desconocido' }, piezas: [{ nombre: 'x', insumoId: 'y', semantic_role: 'otro' }] });
    expect(g.design_intent.product_type).toBe('unknown');
    expect(g.warnings.length).toBeGreaterThan(0);
  });
});


describe('StructuralGraph · trazabilidad de evidencia', () => {
  it('preserva procedencia/evidencia/página desde propuesta hasta BOM', () => {
    const propuesta = {
      design_intent: { product_type:'escritorio', module_count:1, seat_count:0, user_capacity:1, overall_dimensions:'1200x600x750', assumptions:[], missing_critical_data:[] },
      piezas: [{
        nombre:'Cubierta', insumoId:'mdf18', cantidad:1, largoMM:1200, anchoMM:600,
        semantic_role:'cubierta', confianza:'alta',
        procedencia:'MEASURED', evidencia:'cota frontal 1200', pagina:2,
      }],
    };
    const g = graphFromPropuesta(propuesta);
    expect(g.nodes[0].evidence_state).toBe('MEASURED');
    expect(g.nodes[0].evidence).toContain('1200');
    expect(g.nodes[0].evidence_page).toBe(2);
    const bom = structuralGraphToBom(g);
    expect(bom.ok).toBe(true);
    expect(bom.filas[0].procedencia).toBe('MEASURED');
    expect(bom.filas[0].pagina).toBe(2);
  });
});
