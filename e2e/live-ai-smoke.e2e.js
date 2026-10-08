import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;

// Input SINTÉTICO de prueba (único permitido para esta captura).
const DESC = 'Escritorio recto de 1200 x 600 x 750 mm, cubierta de melamina de 19 mm, dos patas metálicas PTR y faldón. Una pieza.';

// Sanitiza lo que se persiste al artifact: SÓLO datos del BOM, nunca secretos.
// Elimina recursivamente cualquier clave sensible (auth/token/jwt/cookie/email/apikey/
// request_id) por si el modelo las reflejara; el artifact guarda únicamente `propuesta`.
const SENSIBLE = /authorization|cookie|token|jwt|api[_-]?key|password|email|secret|request_id|requestid/i;
function sanitizar(v) {
  if (Array.isArray(v)) return v.map(sanitizar);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) { if (SENSIBLE.test(k)) continue; out[k] = sanitizar(val); }
    return out;
  }
  return v;
}

test('LIVE AI smoke · Costear llama analizar-mueble real y devuelve BOM', async ({ page }) => {
  test.skip(!(EMAIL && PASS), 'Requiere cuenta de prueba autenticada.');
  test.setTimeout(140000);

  // Determinista (#9): marca onboarding visto ANTES de montar para que el modal
  // de guía nunca intercepte los clicks del flujo.
  await page.addInitScript(() => {
    try {
      const k = 'costeador-vonhaucke-v1';
      const s = JSON.parse(window.localStorage.getItem(k) || '{}');
      s.onboardingVisto = true;
      window.localStorage.setItem(k, JSON.stringify(s));
    } catch (_e) { /* modo privado */ }
  });
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

  await page.getByTestId('home-costear').click();
  await expect(page.getByText(/Qué vas a costear/i)).toBeVisible({ timeout: 15000 });

  const desc = page.getByLabel(/Descríbelo para que la IA lo entienda/i);
  await desc.fill(DESC);

  // Captura la RESPUESTA REAL de analizar-mueble asociada al click (P0.COSTEO · validación
  // de CALIDAD del BOM del commit informe-diferido). NO toca la función ni la DB.
  const t0 = Date.now();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/functions/v1/analizar-mueble') && r.request().method() === 'POST', { timeout: 120000 }),
    page.getByRole('button', { name: /Analizar con Voni/i }).click(),
  ]);
  const duration_ms = Date.now() - t0;
  const body = await resp.json();
  const propuesta = body && body.propuesta ? body.propuesta : {};

  // Persiste SÓLO el BOM sanitizado (sin headers/auth/request). Para inspección humana.
  try {
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/live-ai-bom.json', JSON.stringify({ ok: body?.ok === true, duration_ms, propuesta: sanitizar(propuesta) }, null, 2));
  } catch (_e) { /* no romper el test por el artifact */ }

  // La UI avanzó (presencia) y sin error de proveedor.
  await expect(page.getByText(/¿De qué está hecho\?/i)).toBeVisible({ timeout: 100000 });
  await expect(page.getByText(/No se pudo analizar el archivo con IA|No se pudo llamar a Claude/i)).toHaveCount(0);

  // ----------------------------------------------------------------------------
  //  ASSERTIONS DE CALIDAD (no sólo presencia). Semántica/cantidad/material/dimensión,
  //  tolerante a sinónimos — NO exige nombres exactos.
  // ----------------------------------------------------------------------------
  const piezas = Array.isArray(propuesta.piezas) ? propuesta.piezas : [];
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const txt = (p) => `${p?.nombre || ''} ${p?.material_solicitado || ''} ${p?.semantic_role || ''} ${p?.nota || ''} ${p?.insumoId || ''}`.toLowerCase();
  const any = (re) => piezas.some((p) => re.test(txt(p)));
  const sumCant = (re) => piezas.filter((p) => re.test(txt(p))).reduce((a, p) => a + Math.max(1, Math.round(n(p.cantidad))), 0);
  const near = (v, target, tol) => Math.abs(v - target) <= tol;

  // ok + contrato + no truncado (truncado ⇒ ok=false).
  expect(body?.ok, 'ok').toBe(true);
  expect(piezas.length, 'piezas no vacío').toBeGreaterThan(0);
  expect(typeof propuesta.informe, 'informe es string').toBe('string');
  expect(propuesta.informe_pendiente, 'informe_pendiente true (1ª pasada texto diferida)').toBe(true);

  // Dimensiones coherentes con 1200×600×750: por overall_dimensions O por la cubierta.
  const dimStr = String(propuesta?.design_intent?.overall_dimensions || '');
  const dimsEnTexto = /1200/.test(dimStr) && /600/.test(dimStr) && /750/.test(dimStr);
  const cubiertaDim = piezas.some((p) => {
    const l = n(p.largoMM), a = n(p.anchoMM); const mx = Math.max(l, a), mn = Math.min(l, a);
    return near(mx, 1200, 150) && near(mn, 600, 150);   // cubierta ~1200×600
  });
  expect(dimsEnTexto || cubiertaDim, `dimensiones 1200×600×750 coherentes (overall='${dimStr}')`).toBe(true);

  // Cubierta de melamina 19 mm representada (familia melamina/tablero + 19).
  const melamina19 = piezas.some((p) => /melamina|cubierta|tablero|mdf/.test(txt(p)) && /19/.test(txt(p)));
  expect(melamina19, 'cubierta melamina 19mm representada').toBe(true);

  // 2 patas PTR (1 pieza x2 o 2 piezas). Tolerante: metal/ptr/pata.
  expect(sumCant(/pata|ptr/), 'dos patas PTR representadas').toBeGreaterThanOrEqual(2);

  // Faldón presente.
  expect(any(/fald/), 'faldón presente').toBe(true);

  // Cantidades coherentes (ninguna absurda) y despiece acotado (no explotó un escritorio simple).
  for (const p of piezas) expect(n(p.cantidad), `cantidad coherente en ${p?.nombre}`).toBeGreaterThanOrEqual(0);
  expect(piezas.length, 'despiece acotado para escritorio simple').toBeLessThanOrEqual(15);
  // Cada pieza tiene rol estructural (no "flotando") → señal anti-invención.
  expect(piezas.every((p) => String(p?.semantic_role || '').trim().length > 0), 'cada pieza con semantic_role').toBe(true);

  // CERO precio/costo generado por la IA (el MOTOR costea, no la IA).
  const PRECIO = /^(precio|costo|price|cost|importe|total)/i;
  expect(piezas.some((p) => Object.keys(p || {}).some((k) => PRECIO.test(k))), 'ninguna pieza con precio/costo de IA').toBe(false);
  expect(Object.keys(propuesta).some((k) => PRECIO.test(k)), 'propuesta sin precio/costo de IA').toBe(false);
});
