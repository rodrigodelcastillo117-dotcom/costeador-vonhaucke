// ============================================================================
//  AUDITORÍA COCREAR / VONI (docs/auditoria/COCREAR_VONI_10.md).
//
//  Convención:
//   · `it(...)`        → defecto CORREGIDO en esta auditoría: la prueba protege la corrección.
//   · `it.fails(...)`  → defecto VIGENTE: el cuerpo afirma el REQUISITO y hoy truena, así que la
//                        prueba pasa. Cuando alguien corrija el defecto, vitest la marcará en rojo
//                        ("expected to fail"): conviértela en `it(...)` en ese mismo cambio.
//  Todo corre sobre el código real (cocrear.js, nucleo.js, proveedorReal.js, revisionEstructural.js).
//  Ninguna prueba toca red: sólo se usan las tools de proveedorReal que no consultan Supabase.
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  cocrearPayload, cocrearDeExpediente, construirProductSpec, extraerDNA, clasificarProducto,
  cocrearDesdeIntent, FAMILIA,
} from './cocrear.js';
import { prepararIntentCocrear, conceptosCocrear, aplicarConceptoCocrear } from './cocrearWow.js';
import { compileRenderPrompt, renderStale } from './renderPrompt.js';
import { visualRevisionHash } from './visualRevision.js';
import { revisarEstructura } from './revisionEstructural.js';
import { responder, construirContexto } from '../voni/nucleo.js';
import { proveedorReal } from '../voni/proveedorReal.js';
import { recomendar } from '../voni/conocimiento.js';
import { TOOLS } from '../voni/tools.js';

// El spec tal como lo arma CocrearV3 (rev = historia.length, BOM = intent._componentes).
const specDeEstudio = (intent, historia) => construirProductSpec(
  intent, extraerDNA(intent), clasificarProducto(intent, {}),
  { rev: historia.length || 1, componentes: intent._componentes || [] },
);

const BRIEF_RECEPCION = 'Recepción escultórica para lobby corporativo, curva, cálida, con iluminación y guardado oculto.';
const BRIEF_HUB = 'Hub colaborativo para 8 personas, vegetación viva, electrificación oculta, divisores acústicos desmontables y escalable a 12 puestos.';

function estudioConConcepto(brief, idx = 0) {
  const base = prepararIntentCocrear(brief);
  const c = conceptosCocrear(base)[idx];
  const intent = aplicarConceptoCocrear(base, c);
  const historia = [{ rev: 1, intent, label: `Concepto ${c.id}` }];
  return { intent, historia };
}

// Proveedor = funciones REALES de proveedorReal que no tocan red (sin get_costing_precedents ni
// search_products, que consultan Supabase de producción).
const PROV_SIN_RED = {
  get_project_context: proveedorReal.get_project_context,
  get_reconciliation: proveedorReal.get_reconciliation,
  get_quote: proveedorReal.get_quote,
  get_layout: proveedorReal.get_layout,
  get_render_status: proveedorReal.get_render_status,
  get_bom: proveedorReal.get_bom,
  get_costing: proveedorReal.get_costing,
  get_industrial_analysis: proveedorReal.get_industrial_analysis,
  get_cost_explanation: proveedorReal.get_cost_explanation,
  get_catalog_knowledge: proveedorReal.get_catalog_knowledge,
  get_material_technical: proveedorReal.get_material_technical,
};
const USER = { email: 'auditoria@vh.mx' };

describe('COCREAR · persistencia del expediente (D-07, D-08 corregidos)', () => {
  it('D-07: un render de la MISMA revisión sigue vigente tras guardar → reabrir', () => {
    const { intent, historia } = estudioConConcepto(BRIEF_RECEPCION);
    const spec = specDeEstudio(intent, historia);
    const c = compileRenderPrompt(spec, spec.dna);
    // Igual que CocrearV3.generarPara: specHash + visualRevisionHash + expected + version.
    const render = { dataUrl: 'https://x/render.png', specHash: spec.hash, visualRevisionHash: c.visualRevisionHash, expected: c.expected, version: c.version };
    expect(renderStale(render, spec)).toBe(false);

    const payload = cocrearPayload({ brief: BRIEF_RECEPCION, intent, historia, render });
    expect(JSON.stringify(payload)).not.toContain('https://x/render.png'); // no viaja la imagen
    const reabierto = cocrearDeExpediente({ cocrear: JSON.parse(JSON.stringify(payload)) });
    const spec2 = specDeEstudio(reabierto.intent, reabierto.historia);
    expect(spec2.hash).toBe(spec.hash);
    // CocrearV3.reabrir reconstruye el render con estas firmas; antes visualRevisionHash llegaba null
    // y renderStale lo marcaba VENCIDO siempre (falso positivo fail-closed).
    const recuperado = { dataUrl: 'https://x/render.png', ...reabierto.render };
    expect(recuperado.visualRevisionHash).toBe(visualRevisionHash(spec));
    expect(renderStale(recuperado, spec2)).toBe(false);
  });

  it('D-07: si la revisión reabierta cambió, el render guardado sí sale vencido', () => {
    const { intent, historia } = estudioConConcepto(BRIEF_RECEPCION);
    const spec = specDeEstudio(intent, historia);
    const c = compileRenderPrompt(spec, spec.dna);
    const payload = cocrearPayload({ intent, historia, render: { specHash: spec.hash, visualRevisionHash: c.visualRevisionHash } });
    const r = cocrearDeExpediente({ cocrear: payload });
    const otro = { ...r.intent, dimensiones: { ...r.intent.dimensiones, ancho_mm: r.intent.dimensiones.ancho_mm + 300 } };
    expect(renderStale(r.render, specDeEstudio(otro, r.historia))).toBe(true);
  });

  it('D-08: el payload expone el fondo como fondo_mm (lo que lee guardar_cocrear_seguro) sin mutar la intención', () => {
    const { intent, historia } = estudioConConcepto(BRIEF_RECEPCION);
    expect(intent.familia).toBe(FAMILIA.RECEPCION);
    expect(intent.dimensiones.prof_mm).toBe(700);
    expect(intent.dimensiones.fondo_mm).toBeUndefined();
    const payload = cocrearPayload({ intent, historia });
    expect(payload.spec.dimensiones.fondo_mm).toBe(700);
    expect(payload.spec.dimensiones.prof_mm).toBe(700);
    expect(payload.intent.dimensiones.fondo_mm).toBeUndefined();
    expect(intent.dimensiones.fondo_mm).toBeUndefined();
    // El spec hash no cambia por exponer el alias.
    expect(payload.specHash).toBe(specDeEstudio(intent, historia).hash);
  });
});

describe('COCREAR · de concepto a producto (defectos vigentes)', () => {
  it.fails('D-01 REQUISITO: algún concepto de Cocrear puede bajar a BOM y quedar costeable/cotizable', () => {
    // Recorre los briefs de ejemplo y los tres conceptos con las MISMAS funciones que usa la UI.
    // Ninguna operación de CocrearV3 (setDim/setFamilia/setCap/setMaterial/setTone/toggleFeature/
    // cambioCanonico) escribe intent._componentes: el BOM queda vacío para siempre.
    const resultados = [];
    for (const brief of [BRIEF_RECEPCION, BRIEF_HUB]) {
      for (let i = 0; i < 3; i++) {
        const { intent, historia } = estudioConConcepto(brief, i);
        const p = cocrearDesdeIntent(intent, { rev: historia.length, componentes: intent._componentes || [] });
        resultados.push({ bom: p.spec.componentes.length, costo: p.costo.official_cost, lista: p.lineaCotizacion.listaParaCotizar === true });
      }
    }
    const src = fs.readFileSync('src/componentes/CocrearV3.jsx', 'utf8');
    const escribeBom = /_componentes\s*:/.test(src) || /\._componentes\s*=/.test(src);
    expect(escribeBom).toBe(true);
    expect(resultados.some((r) => r.bom > 0 && r.costo != null)).toBe(true);
  });

  it.fails('D-05 REQUISITO: el core no acepta una validación de ingeniería firmada por un rol sin autoridad', () => {
    const insumos = { tablero: { id: 'tablero', nombre: 'Tablero melamina', seccion: 'cubiertas', clase: 'directa', unidad: 'hoja', precio: 600, formato: { medida: 2.9768 }, fraccion: true, mermaCorte: 0 } };
    const par = { aprovechamientoCorte: 80, margenObjetivo: 40, mermaProceso: 0, modeloCosteo: 'clasico' };
    const intent = { ...prepararIntentCocrear('mesa de trabajo de melamina 1.50 m'), caracteristicas: [] };
    const componentes = [{ nombre: 'Cubierta', insumoId: 'tablero', hojas: 1, piezas: 1, cantidad: 1 }];
    const p = cocrearDesdeIntent(intent, {
      insumos, par, componentes,
      engineering_validated: true,
      // Evidencia que viaja dentro de intent._engineering_validation (JSON del cliente): nadie
      // verifica que `rol` sea diseño/dirección ni que el validador exista en `permitidos`.
      engineering_validation: { validador: 'vendedor@vh.mx', rol: 'ventas', visual_hash: 'x' },
    });
    expect(p.costo.official_cost).not.toBeNull();
    expect(p.lineaCotizacion.listaParaCotizar).toBe(false);
  });
});

describe('VONI · respuestas sin evidencia (D-11, D-12 corregidos)', () => {
  it('D-11: una pregunta no reconocida ya no responde "Todo en orden": pide la información que falta', async () => {
    for (const query of ['¿qué regla de canto aplica?', '¿Esto ya existe en Von Haucke?', '¿por qué lleva pintura electrostática?']) {
      for (const role of ['ventas', 'direccion']) {
        const { respuesta, intent } = await responder({ query, ctx: { user: USER, role, route: 'cocrear' }, prov: PROV_SIN_RED });
        expect(intent).toBe('CONSULTA');
        expect(respuesta.estado).toBe('DESCONOCIDO');
        expect(respuesta.que_paso).not.toMatch(/Todo en orden/i);
        expect(respuesta.accion).toMatch(/Precisa/);
      }
    }
  });

  it('D-11: CONSULTA con un bloqueo real sigue reportándolo (no se silencia evidencia)', async () => {
    const { respuesta } = await responder({
      query: 'hola',
      ctx: { user: USER, role: 'ventas', partidasLocales: [{ nombre: 'Mesa', cantidad: 1, precioUnitario: 0, sinPrecioAutorizado: true }] },
      prov: PROV_SIN_RED,
    });
    expect(respuesta.estado).toBe('BLOQUEADO');
    expect(respuesta.bloqueos.some((b) => /sin precio/i.test(b.titulo))).toBe(true);
  });

  it('D-12: "¿Qué línea me sirve?" sin mueble no recomienda una línea al azar', () => {
    expect(recomendar('¿Qué línea me sirve?')).toEqual([]);
    expect(recomendar('¿Esto ya existe en Von Haucke?')).toEqual([]);
    // Las palabras del mueble siguen puntuando.
    const recep = recomendar('recepción curva para lobby').map((l) => l.ruta);
    expect(recep.length).toBeGreaterThan(0);
  });
});

describe('VONI · reglas de casa, validadores y contexto (defectos vigentes)', () => {
  it.fails('D-09 REQUISITO: VONI tiene una tool determinista para las reglas de casa (REGLAS_TALLER/autoInsumos)', () => {
    expect(TOOLS.some((t) => /regla|taller|casa/i.test(t.nombre))).toBe(true);
  });

  it.fails('D-10 REQUISITO: el análisis industrial de VONI incluye los bloqueos del validador estructural determinista', async () => {
    const bom = [{ nombre: 'Cubierta', insumoId: 'mdf18', largoMM: 2400, anchoMM: 1100, espesorMM: 18, piezas: 1 }];
    const validador = revisarEstructura({ componentes: bom, descripcion: 'Mesa de juntas para 10 personas' });
    expect(validador.observaciones.some((o) => o.nivel === 'blocker' && o.regla === 'sin_soporte')).toBe(true);
    const { respuesta, intent } = await responder({
      query: '¿Cómo lo harías fabricable?',
      ctx: { user: USER, role: 'diseno', route: 'costeador', bom, costing: null },
      prov: PROV_SIN_RED,
    });
    expect(intent).toBe('INDUSTRIAL_IMPROVEMENT');
    // revisarEstructura dice "cubierta sin soporte" (blocker); VONI no lo consulta.
    expect(JSON.stringify(respuesta)).toMatch(/soporte|patas|base del mueble/i);
  });

  it.fails('D-13 REQUISITO: en la ruta Cocrear, VONI recibe la identidad del producto co-creado', () => {
    // App.jsx arma el ctx de Voni2 con el BOM/costeo del COSTEADOR (costeo.componentes, voniCosting),
    // sin expediente_id/spec de Cocrear: "¿Cómo lo harías fabricable?" (chip de la ruta cocrear)
    // analiza otro mueble. construirContexto además descarta cualquier campo `cocrear`.
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    const i = app.indexOf('<Voni2');
    const bloque = app.slice(i, app.indexOf('onCerrar=', i));
    const ctx = construirContexto({ route: 'cocrear', cocrear: { specHash: 'h1' } });
    expect(bloque).toMatch(/expediente_id|cocrear/);
    expect(ctx.cocrear).toBeTruthy();
  });

  it.fails('D-18 REQUISITO: "¿cuánto cuesta este mueble?" sin costeo cargado no responde "Todo en orden"', async () => {
    // Dirección sin nada en el Costeador (App pasa costing=null, bom=null): get_costing devuelve
    // {disponible:false}, la lente costeador lo toma como dato presente y sintetiza OK.
    const { respuesta, intent } = await responder({
      query: '¿cuánto cuesta este mueble?',
      ctx: { user: USER, role: 'direccion', route: 'cocrear', bom: null, costing: null },
      prov: PROV_SIN_RED,
    });
    expect(intent).toBe('COSTING_ANALYSIS');
    expect(respuesta.estado).not.toBe('OK');
  });

  it.fails('D-14 REQUISITO: get_bom reporta contradicciones reales del BOM (hoy siempre [])', async () => {
    // Mismo costado capturado con dos medidas distintas: contradicción evidente.
    const bom = [
      { nombre: 'Costado izquierdo', insumoId: 'mdf18', largoMM: 720, anchoMM: 450, espesorMM: 18, piezas: 1 },
      { nombre: 'Costado izquierdo', insumoId: 'mdf18', largoMM: 900, anchoMM: 450, espesorMM: 18, piezas: 1 },
    ];
    const r = await proveedorReal.get_bom({ bom });
    expect(r.contradicciones.length).toBeGreaterThan(0);
  });
});
