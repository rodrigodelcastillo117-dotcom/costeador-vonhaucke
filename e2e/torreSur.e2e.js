import { test, expect } from '@playwright/test';
import path from 'node:path';
import { hayCreds, login, armarYVerificar, verificarAcomodo, evidencia, TORRE_SUR } from './lib/torreSur.js';

// ============================================================================
//  E2E REAL · TORRE SUR · RUTA 1/3: "Subir el plano del cliente" (PDF real ARQ-01).
//  Login → Cotizar → PDF → lector (evidencia) → Muebles → Armar → cotización sin
//  pérdidas → refresh → Acomodo real. Requiere TEST_EMAIL / TEST_PASSWORD.
// ============================================================================
const PDF = path.resolve(process.cwd(), 'e2e/fixtures/plano-torre-sur-arq01.pdf');

test.describe('E2E TORRE SUR · ruta PDF', () => {
  test.skip(!hayCreds, 'Define TEST_EMAIL y TEST_PASSWORD para correr el recorrido real.');
  test.setTimeout(300000);

  test('PDF real → lector → Voni arma → cotización sin pérdidas → acomodo real', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    const warnsCotizar = [];
    page.on('console', (m) => { if (m.type() === 'warning' && /\[Cotizar\]|costearItem/.test(m.text())) warnsCotizar.push(m.text()); });

    await login(page);
    await page.getByTestId('home-cotizar').click();

    // 1) LECTURA DEL PLANO por el input oculto de Voni.
    const lecturaResp = page.waitForResponse((r) => /leer-plano/.test(r.url()) && r.request().method() === 'POST', { timeout: 120000 });
    await page.getByTestId('cotizar-plano').setInputFiles(PDF);
    const lectura = await lecturaResp;
    expect(lectura.status(), 'leer-plano debe responder 200').toBe(200);
    const lecturaJson = await lectura.json().catch(() => null);
    expect(lecturaJson?.ok, `leer-plano ok=false: ${JSON.stringify(lecturaJson?.error || '')}`).toBe(true);
    evidencia('torre-sur-pdf-leer-plano.json', {
      fecha: new Date().toISOString(), request_id: lecturaJson?.request_id ?? null,
      envolvente: lecturaJson?.lectura?.envolvente ?? null,
      areas: (lecturaJson?.lectura?.areas || []).map((a) => ({ nombre: a.nombre, tipo: a.tipo, puestos: a.puestos ?? null, confianza: a.confianza ?? null, dentroDe: a.dentroDe ?? null, puntos: (a.puntos || []).length })),
      puertas: (lecturaJson?.lectura?.puertas || []).length,
      floorSpec_state: lecturaJson?.floorSpec?.validation?.state ?? null,
      observed_validation: lecturaJson?.floorSpec?.observed_validation ?? null,
      observed_program: (lecturaJson?.floorSpec?.observed_program || lecturaJson?.observed_program || []).map((o) => ({ source_ref: o.source_ref, type: o.type, role: o.role, zone: o.zone, quantity: o.quantity, capacity_per_unit: o.capacity_per_unit, capacity_total: o.capacity_total, dimensions: o.dimensions, confidence: o.confidence, origin: o.origin, review_required: o.review_required, issues: o.issues })),
      notas: lecturaJson?.lectura?.notas ?? [],
    });
    // Puestos contados por el lector en áreas abiertas (COT-P0-003): el texto debe pedir ESE número.
    const opLector = (lecturaJson?.lectura?.areas || []).filter((a) => a.tipo === 'open' && Number(a.puestos) > 0).reduce((s, a) => s + Number(a.puestos), 0);

    // 2-6) Muebles → Armar → verificación común (sin corregir contadores: el lector manda).
    // El lector cuenta puestos pero NO islas: la persona dice en cuántas bancas (el plano dibuja 2 de 4).
    await armarYVerificar(page, { ruta: 'pdf', puestos: opLector > 0 ? opLector : null, bancas: TORRE_SUR.bancas, warnsCotizar });

    // 7) Acomodo real; con plano en revisión (puertas sin barrido) sólo borrador.
    await verificarAcomodo(page, { ruta: 'pdf', estadoFS: lecturaJson?.floorSpec?.validation?.state ?? null });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
