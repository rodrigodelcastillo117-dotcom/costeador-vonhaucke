import { test, expect } from '@playwright/test';

//  RENDER POR CUARTO EN PRODUCCIÓN (certificación, Prioridad 6). Reabre el presupuesto de prueba
//  identificado (GOLDEN_CLIENTE), entra al acomodo y pide "Generar las N áreas". Registra cada
//  respuesta REAL de generar-render (ok, auditoría de fidelidad, campos fallidos, razones, ms).
//  No afirma que todas pasen: afirma que cada rechazo viene explicado y que ningún render
//  rechazado se guarda como válido. Gasta llamadas de IA: sólo con RENDER_PROD=1.
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLIENTE = process.env.GOLDEN_CLIENTE || 'Torre Sur (golden)';
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);

test.describe('renders por cuarto · producción', () => {
  test.skip(!(EMAIL && PASS && process.env.RENDER_PROD === '1'), 'Define TEST_EMAIL, TEST_PASSWORD y RENDER_PROD=1.');
  test.setTimeout(900000);

  test('cada cuarto: render aceptado o rechazo explicado por el auditor', async ({ page }) => {
    const respuestas = []; const t0 = Date.now();
    page.on('response', async (res) => {
      if (!/\/functions\/v1\/generar-render/.test(res.url())) return;
      const j = await res.json().catch(() => null);
      const a = j?.audit || null;
      const fallidos = a ? ['geometry_match', 'layout_match', 'environment_match', 'extra_objects', 'natural_camera'].filter((k) => a[k] === 'FAIL') : [];
      respuestas.push({ t: Math.round((Date.now() - t0) / 1000), http: res.status(), ok: !!j?.ok, code: j?.code || null, error: j?.error || null, fallidos, razones: a?.reasons || [], confianza: a?.confidence ?? null, model: j?.model || null, bytes: j?.bytes || null });
      console.log('[render]', JSON.stringify(respuestas[respuestas.length - 1]).slice(0, 500));
    });
    await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(v)); } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
    const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
    await expect(tarjeta).toBeVisible({ timeout: 20000 });
    await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
    await expect.poll(async () => (await leerCot(page))?.partidas?.length || 0, { timeout: 20000 }).toBeGreaterThan(0);
    await page.getByRole('button', { name: /^Inicio$/ }).click();
    await page.getByTestId('home-cotizar').click();
    await page.getByTestId('voni-paso-muebles').click();
    await page.getByTestId('voni-paso-acomodo').click();
    const boton = page.getByRole('button', { name: /Generar las \d+ áreas|Generar la imagen del área|Volver a generar/ });
    await expect(boton).toBeVisible({ timeout: 30000 });
    await boton.scrollIntoViewIfNeeded();
    const etiqueta = await boton.innerText();
    const nAreas = Number((etiqueta.match(/(\d+)/) || [])[1]) || 1;
    console.log('[render] áreas a generar:', nAreas, '·', etiqueta);
    await boton.click();
    await expect.poll(() => respuestas.length, { timeout: 840000, intervals: [5000] }).toBeGreaterThanOrEqual(nAreas);
    await page.waitForTimeout(1500);
    const imgs = await page.locator('.escenas-grid img').count();
    const err = await page.locator('.alerta.roja').last().innerText().catch(() => '');
    console.log('[render] resumen:', JSON.stringify({ respuestas: respuestas.length, ok: respuestas.filter((r) => r.ok).length, rechazados: respuestas.filter((r) => !r.ok).map((r) => ({ code: r.code, fallidos: r.fallidos, razones: r.razones })), imgs, err: err.slice(0, 300) }));
    if (process.env.GOLDEN_CAPTURA) await page.screenshot({ path: process.env.GOLDEN_CAPTURA, fullPage: true }).catch(() => {});
    // Contrato: ningún rechazo sin explicación; cada render aceptado llega como URL (no base64) y se ve.
    for (const r of respuestas) {
      if (!r.ok) expect(r.error, 'un rechazo trae error').toBeTruthy();
      if (!r.ok && r.code === 'RENDER_QA_FAILED') expect(r.fallidos.length + r.razones.length, 'la auditoría dice por qué').toBeGreaterThan(0);
    }
    expect(imgs).toBe(respuestas.filter((r) => r.ok).length);
    // P1 (orden nocturna 2026-10-13): "se rechaza con buena explicación" ≠ "se generó una imagen fiel y aceptada".
    // El contrato de arriba puede pasar con 0 aceptados; eso se reporta aparte y, si se exige
    // (RENDER_EXIGE_ACEPTADO=1), falla.
    const aceptados = respuestas.filter((r) => r.ok).length;
    test.info().annotations.push({ type: 'generacion', description: `${aceptados}/${respuestas.length} renders aceptados por el auditor` });
    console.log(`[render] GENERACIÓN: ${aceptados}/${respuestas.length} aceptados (0 aceptados NO es PASS de generación; sólo del contrato de rechazo explicado)`);
    if (process.env.RENDER_EXIGE_ACEPTADO === '1') expect(aceptados, 'generación: al menos un render aceptado').toBeGreaterThan(0);
  });
});
