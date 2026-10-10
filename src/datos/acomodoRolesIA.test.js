import { describe, it, expect, beforeAll } from 'vitest';
import { construirPayloadAcomodo } from './acomodoPayload.js';
import { construirRespuestaAcomodo } from '../../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';
import { BANCO } from './banco.js';

// ============================================================================
//  COT-P0-025 · El solver recibe las partidas de Voni/IA SIN rol funcional.
//  Evidencia E2E real (Torre Sur 13:52Z, e2e/evidence/torre-sur-acomodo.json):
//  acomodar-espacio-recovery → ok:true, metodo kit-solver-multi-v1, 23 piezas,
//  status QUALITY_REVIEW_REQUIRED, **0 colocadas**, pantalla "faltan 23 por colocar"
//  sin explicar por qué. Causa en código: kit-solver sólo arma kits con piezas cuyo
//  relation_role empieza por ANCHOR_ (kit-solver.js:402-407); las partidas que crea
//  CotizadorIA (líneas y banco) no traen relation_role → 0 anclas → 0 kits.
// ============================================================================
const AREAS_MM = [   // del lector (torre-sur-leer-plano.json), sin puertas (geometría mínima)
  { nombre: 'OFICINA CEO', tipo: 'privado', ancho: 4000, largo: 3200 },
  { nombre: 'SALA DE CONSEJO', tipo: 'juntas', ancho: 7000, largo: 3200 },
  { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 8000, largo: 3200 },
  { nombre: 'RECEPCIÓN', tipo: 'recepcion', ancho: 4000, largo: 2400 },
];
const AREAS_M = AREAS_MM.map((a) => ({ ...a, ancho: a.ancho / 1000, largo: a.largo / 1000 }));

describe('COT-P0-025 · partidas de Voni/IA → solver con rol funcional', () => {
  let partidas;
  beforeAll(async () => {
    const ln = await import('./lineas.js');
    const ins = await import('./insumos.js');
    const mc = await import('../motor/calculo.js');
    const estado = { insumos: ins.mapaInsumos(ins.INSUMOS_SEMILLA), parametros: mc.PARAMETROS_DEFAULT, piezas: {} };
    // Exactamente lo que la IA pidió en la corrida 13:29Z (ruta fusionada incluida).
    const linea = (it) => { const c = ln.costearItem(estado, it); expect(c, it.etiqueta).toBeTruthy(); return { id: `p-${it.etiqueta}`, piezaId: `linea-${c.producto}`, nombre: c.nombre, cantidad: c.cantidad, ruta: c.ruta, productoId: c.producto, w: c.w, d: c.d, precioUnitario: c.precioUnitario, config: c.config }; };
    const banco = (id, cantidad) => { const b = BANCO.find((x) => x.id === id); expect(b, id).toBeTruthy(); return { id: `b-${id}`, piezaId: id, nombre: b.medidas ? `${b.nombre} (${b.medidas})` : b.nombre, cantidad, precioUnitario: b.precio, deBanco: true }; };
    partidas = [
      linea({ ruta: 'applt/banca_doble', producto: 'Banca doble App LT 8 usuarios', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '1500' }, { clave: 'usuarios', valor: '8' }, { clave: 'biombo', valor: 'melamina' }, { clave: 'color', valor: 'ivory' }], etiqueta: 'bench' }),
      linea({ ruta: 'eclipse/escritorio', producto: 'Escritorio Directivo Eclipse', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '2100' }, { clave: 'mano', valor: 'D' }, { clave: 'finish', valor: 'chapa' }], etiqueta: 'eclipse' }),
      linea({ ruta: 'eclipse/credenza', producto: 'Credenza (baja) Eclipse', cantidad: 1, seleccion: [{ clave: 'largoMM', valor: '2100' }, { clave: 'mano', valor: 'D' }, { clave: 'finish', valor: 'chapa' }], etiqueta: 'credenza' }),
      banco('p9-silla-operativa-win-5210', 8), banco('silla-alpha', 1), banco('p9-silla-de-visita-concerto-5470', 2),
      banco('mj-1200x1200-melamina', 1), banco('p9-silla-sonata-2420-144', 4), banco('p9-recepcion-29920', 1),
      banco('p9-mox-gaveta-pedestal-3780', 8), banco('arch-modulor-2p-900', 1),
    ];
  });

  it('RED→GREEN: el payload lleva rol funcional (anclas/sillas/gavetas) y el solver vendorizado coloca las anclas', () => {
    const payload = construirPayloadAcomodo({ partidas, areasM: AREAS_M, floorSpecEstado: 'PASS' });
    expect(payload.ok).toBe(true);
    const sinRol = payload.piezas.filter((p) => !p.relation_role);
    expect(sinRol.length, `piezas sin relation_role: ${sinRol.map((p) => p.nombre || p.id).join(' | ')}`).toBe(0);
    const anclas = payload.piezas.filter((p) => String(p.relation_role || '').startsWith('ANCHOR_'));
    // 4 anclas físicas (bench, Eclipse, mesa, recepción) + 2 de guardado libre (credenza, archivero)
    expect(anclas.map((a) => a.relation_role).sort()).toEqual(['ANCHOR_DESK', 'ANCHOR_MEETING', 'ANCHOR_RECEPTION', 'ANCHOR_STORAGE', 'ANCHOR_STORAGE', 'ANCHOR_WORKSTATION']);
    expect(payload.piezas.filter((p) => p.relation_role === 'WORK_SEAT')).toHaveLength(8);
    expect(payload.piezas.filter((p) => p.relation_role === 'MEETING_SEAT')).toHaveLength(4);
    expect(payload.piezas.filter((p) => p.relation_role === 'VISITOR_SEAT')).toHaveLength(2);
    expect(payload.piezas.filter((p) => p.relation_role === 'EXECUTIVE_SEAT')).toHaveLength(1);
    // Las gavetas bajo cubierta NO viajan al solver por diseño (expandirPiezas omite
    // vaBajoEscritorio): van debajo del puesto, no ocupan piso. 8 partidas → 0 piezas.
    expect(payload.piezas.filter((p) => p.relation_role === 'UNDERDESK_STORAGE')).toHaveLength(0);
    // E2E real 14:2xZ: como "gavetas" del escritorio se encimaban (OVERLAP). Van como anclas
    // libres en el cuarto del privado.
    const storage = payload.piezas.filter((p) => p.relation_role === 'ANCHOR_STORAGE');
    expect(storage).toHaveLength(2);
    for (const s of storage) expect(s.zone_id, s.nombre).toBe('OFICINA CEO');
    // el bench inferido lleva su capacidad real (8), no 6000/1500 = 4
    const bench = anclas.find((a) => a.relation_role === 'ANCHOR_WORKSTATION');
    expect(bench.user_capacity).toBe(8);
    expect(anclas.find((a) => a.relation_role === 'ANCHOR_DESK').user_capacity).toBe(3);        // ALPHA + 2 CONCERTO
    // El solver (mismo código que la edge) coloca las 6 anclas, sin dependientes sin dueño y
    // SIN issues duros (antes: OVERLAP credenza/archivero bajo el escritorio).
    // El bench de línea lleva topología de catálogo (antes UNKNOWN → revisión del juez).
    expect(bench.placement_profile).toMatchObject({ topology: 'DOUBLE_FACE', provenance: 'CATALOG' });
    const r = construirRespuestaAcomodo(payload.areas, payload.piezas);
    const colocadas = new Set((r.plan?.colocacion || []).map((c) => String(c.id)));
    const fisicas = anclas.filter((a) => a.relation_role !== 'ANCHOR_STORAGE');
    const fisicasColocadas = fisicas.filter((a) => colocadas.has(String(a.id)));
    expect(fisicasColocadas.length, `status=${r.status} colocadas=${colocadas.size}/${payload.piezas.length} no_cupieron=${JSON.stringify((r.layoutSpec?.no_cupieron || []).map((u) => u.anchorId))}`).toBe(fisicas.length);
    expect(r.layoutSpec?.unassigned || [], 'dependientes sin dueño').toEqual([]);
    const duros = (r.layoutSpec?.validation?.issues || []).filter((i) => i.severity === 'fail');
    expect(duros, 'issues duros (OVERLAP/puerta/obstáculo)').toEqual([]);
    // Guardado de apoyo en el CEO (4×3.2 m) junto al kit del escritorio con 3 sillas y el
    // pasillo de 1 m entre kits: el multi-candidato puede preferir un layout REVIEW de 19
    // piezas a uno FAIL de 21 (GAP18). Es dato, no PASS: queda registrado (COT-P0-027b).
    const guardado = anclas.filter((a) => a.relation_role === 'ANCHOR_STORAGE');
    const guardadoColocado = guardado.filter((a) => colocadas.has(String(a.id))).length;
    // eslint-disable-next-line no-console
    console.log(`[acomodoRolesIA] status=${r.status} colocadas=${colocadas.size}/${payload.piezas.length} guardado=${guardadoColocado}/${guardado.length} sem=${JSON.stringify(r.layoutSpec?.validation?.semantic_gate)}`);
    expect(colocadas.size).toBeGreaterThanOrEqual(payload.piezas.length - guardado.length);
  });

  it('el rol inferido queda MARCADO como inferido (no se confunde con rol confirmado del programa)', () => {
    const payload = construirPayloadAcomodo({ partidas, areasM: AREAS_M, floorSpecEstado: 'PASS' });
    for (const p of payload.piezas) expect(p.rol_inferido, p.nombre || p.id).toBe(true);
    // una partida que YA trae rol del programa no se pisa
    const conRol = [{ ...partidas[0], relation_role: 'ANCHOR_WORKSTATION', functional_group_id: 'g1' }];
    const p2 = construirPayloadAcomodo({ partidas: conRol, areasM: AREAS_M, floorSpecEstado: 'PASS' });
    expect(p2.piezas.every((p) => p.relation_role === 'ANCHOR_WORKSTATION' && !p.rol_inferido)).toBe(true);
  });
});
