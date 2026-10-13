// LABORATORIO · reabrir un presupuesto con acomodo y generar los renders por área contra la edge
// configurada (producción o `generar-render-rc` vía VITE_GENERAR_RENDER_FN). Registra, no afirma:
// cuántas llamadas, cuántas pasaron el auditor, qué falló y si llegaron las referencias de producto.
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLIENTE = process.env.LAB_CLIENTE; const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-render';
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
test('reabrir y generar renders por área', async ({ page }) => {
  test.skip(!(EMAIL && PASS && CLIENTE), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_CLIENTE.');
  test.setTimeout(15 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });
  const edges = []; const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', async (res) => {
    const m = res.url().match(/\/functions\/v1\/([a-z0-9-]+)/); if (!m || !/render/.test(m[1])) return;
    const txt = await res.text().catch(() => ''); let j = null; try { j = JSON.parse(txt); } catch (_e) {}
    edges.push({ fn: m[1], status: res.status(), ok: j?.ok ?? null, code: j?.code ?? null, error: j?.error ?? null, audit: j?.audit ?? null, referencias: j?.referencias ?? null, con_dibujo: j?.con_dibujo ?? null, conteo: j?.conteo ?? null, conteoTexto: j?.conteoTexto ?? null, model: j?.model ?? null, bytes: j?.bytes ?? null });
    console.log('[lab-render] edge', m[1], res.status(), JSON.stringify({ ok: j?.ok, code: j?.code, referencias: j?.referencias, con_dibujo: j?.con_dibujo, conteoTexto: j?.conteoTexto, audit: j?.audit && { pass: j.audit.pass, layout: j.audit.layout_match, extra: j.audit.extra_objects, reasons: j.audit.reasons } }));
  });
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
  const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
  await expect(tarjeta).toBeVisible({ timeout: 20000 });
  await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
  await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length ?? 0, { timeout: 30000 }).toBeGreaterThan(0);
  const stepAcomodo = page.getByTestId('voni-paso-acomodo');
  await expect(stepAcomodo).toBeEnabled({ timeout: 15000 }); await stepAcomodo.click();
  const btnRender = page.getByRole('button', { name: /Generar las \d+ áreas|Generar la imagen del área/ });
  await expect(btnRender.first()).toBeVisible({ timeout: 20000 });
  const etiqueta = await btnRender.first().innerText();
  const tr = Date.now(); await btnRender.first().click();
  await expect(page.getByRole('button', { name: /Volver a generar|Generar las \d+ áreas|Generar la imagen del área/ })).toBeEnabled({ timeout: 10 * 60 * 1000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const cot = await leerCot(page);
  const resumen = {
    cliente: CLIENTE, boton: etiqueta, segundos: Math.round((Date.now() - tr) / 1000),
    fn: [...new Set(edges.map((e) => e.fn))], llamadas: edges.length, validas: edges.filter((e) => e.ok === true).length,
    fallas: edges.filter((e) => e.ok !== true).map((e) => e.code || (e.error || '').slice(0, 80)),
    referencias: edges.map((e) => e.referencias), con_dibujo: edges.map((e) => e.con_dibujo),
    imagenes: await page.locator('img[alt*="área"], img[alt*="area"], figure img').count(),
    escenasGuardadas: (cot?.acomodo?.escenas || []).length, pageErrors: pageErrors.length,
  };
  fs.writeFileSync(path.join(SALIDA, 'edges.json'), JSON.stringify(edges, null, 2));
  fs.writeFileSync(path.join(SALIDA, 'resumen.json'), JSON.stringify(resumen, null, 2));
  await page.screenshot({ path: path.join(SALIDA, 'render.png'), fullPage: true });
  console.log('[lab-render]', JSON.stringify(resumen));
});
