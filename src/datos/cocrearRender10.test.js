// ============================================================================
//  COCREAR 10 · D-06 (render que sobrevive a guardar/reabrir), N-04 (imagen de referencia) y
//  D-02 lado cliente (el navegador ya no manda importes). Sobre el código real de cocrear.js.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { cocrearPayload, cocrearDeExpediente, specDeCocreacion } from './cocrear.js';
import { prepararIntentCocrear, conceptosCocrear, aplicarConceptoCocrear } from './cocrearWow.js';
import { compileRenderPrompt, renderStale } from './renderPrompt.js';
import { bajarLineaABom } from './cocrearPuente.js';
import { INSUMOS_SEMILLA, mapaInsumos } from './insumos.js';

const BRIEF = 'Recepción escultórica para lobby corporativo, curva, cálida, con iluminación y guardado oculto.';
function estudio() {
  const base = prepararIntentCocrear(BRIEF);
  const intent = aplicarConceptoCocrear(base, conceptosCocrear(base)[0]);
  return { intent, historia: [{ rev: 1, intent, label: 'Concepto A' }] };
}

describe('D-06 · el render sobrevive a guardar y reabrir', () => {
  it('la URL pública viaja con su firma y, al reabrir la MISMA revisión, el render sigue vigente', () => {
    const { intent, historia } = estudio();
    const spec = specDeCocreacion(intent, historia);
    const c = compileRenderPrompt(spec, spec.dna);
    const render = { dataUrl: 'https://storage.vh/renders/cocrear/1/a.png', specHash: spec.hash, visualRevisionHash: c.visualRevisionHash, expected: c.expected, version: c.version };
    const payload = JSON.parse(JSON.stringify(cocrearPayload({ brief: BRIEF, intent, historia, render })));
    const r = cocrearDeExpediente({ cocrear: payload });
    expect(r.render.url).toBe('https://storage.vh/renders/cocrear/1/a.png');
    const recuperado = { dataUrl: r.render.url, ...r.render };
    expect(renderStale(recuperado, specDeCocreacion(r.intent, r.historia))).toBe(false);
  });

  it('un render que sólo existe en base64 NO se persiste (la UI lo sube a Storage antes de guardar)', () => {
    const { intent, historia } = estudio();
    const spec = specDeCocreacion(intent, historia);
    const payload = cocrearPayload({ intent, historia, render: { dataUrl: 'data:image/png;base64,AAAA', specHash: spec.hash, visualRevisionHash: 'v' } });
    expect(payload.render.url).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('base64');
  });

  it('si la revisión reabierta ya no es la del render, sale VENCIDO (fail-closed)', () => {
    const { intent, historia } = estudio();
    const spec = specDeCocreacion(intent, historia);
    const c = compileRenderPrompt(spec, spec.dna);
    const payload = cocrearPayload({ intent, historia, render: { url: 'https://storage.vh/r.png', specHash: spec.hash, visualRevisionHash: c.visualRevisionHash } });
    const r = cocrearDeExpediente({ cocrear: payload });
    const otro = { ...r.intent, dimensiones: { ...r.intent.dimensiones, ancho_mm: 2700 } };
    expect(renderStale({ dataUrl: r.render.url, ...r.render }, specDeCocreacion(otro, r.historia))).toBe(true);
  });
});

describe('N-04 · imagen de referencia', () => {
  it('se guarda sólo su URL de Storage y regresa al reabrir', () => {
    const { intent, historia } = estudio();
    const payload = cocrearPayload({ intent, historia, referencia: { url: 'https://storage.vh/renders/cocrear/ref/x.jpg', mediaType: 'image/jpeg', nombre: 'foto-cliente.jpg', base64: 'AAAA' } });
    expect(payload.referencia).toEqual({ url: 'https://storage.vh/renders/cocrear/ref/x.jpg', mediaType: 'image/jpeg', nombre: 'foto-cliente.jpg' });
    expect(cocrearDeExpediente({ cocrear: payload }).referencia.url).toBe('https://storage.vh/renders/cocrear/ref/x.jpg');
  });

  it('una referencia sin URL pública (sólo base64) no se persiste', () => {
    const { intent, historia } = estudio();
    expect(cocrearPayload({ intent, historia, referencia: { base64: 'AAAA', mediaType: 'image/jpeg' } }).referencia).toBeUndefined();
  });
});

describe('D-02 (cliente) · el navegador ya no manda importes en el payload', () => {
  it('con BOM y costo local completo, el costSnapshot sólo lleva estado y fuente no autoritativa', () => {
    const insumos = mapaInsumos(INSUMOS_SEMILLA);
    const { intent } = estudio();
    const r = bajarLineaABom({ ...intent, familia: 'MESA', caracteristicas: [], dimensiones: { ancho_mm: 1350, prof_mm: 1200, alto_mm: 740 } }, { ruta: 'applt', productoId: 'mesa_juntas' }, { insumos });
    const payload = cocrearPayload({ intent: r.intent, historia: [{}, {}], insumos, par: {} });
    expect(payload.costSnapshot).toEqual({ status: 'KNOWN', fuente: 'navegador_no_autoritativo' });
    expect(payload.costSnapshot.official_cost).toBeUndefined();
    expect(payload.costSnapshot.known_cost).toBeUndefined();
    // El servidor reconstruye el spec desde la intención: el hash del payload es ése.
    expect(payload.specHash).toBe(specDeCocreacion(r.intent, [{}, {}]).hash);
    expect(payload.spec.componentes.length).toBeGreaterThan(0);
  });
});
