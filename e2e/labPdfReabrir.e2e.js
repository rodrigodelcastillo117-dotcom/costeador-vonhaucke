// LABORATORIO · reabrir un presupuesto por cliente y descargar su PDF (verifica VH-138 en el papel real).
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLIENTE = process.env.LAB_CLIENTE; const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-pdf';
const CLAVE = 'costeador-vonhaucke-v1';
test('reabrir y descargar PDF', async ({ page }) => {
  test.skip(!(EMAIL && PASS && CLIENTE), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_CLIENTE.');
  test.setTimeout(240000); fs.mkdirSync(SALIDA, { recursive: true });
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
  await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
  const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
  await expect(tarjeta).toBeVisible({ timeout: 20000 });
  await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
  const btnPdf = page.getByRole('button', { name: /Descargar PDF|Descargar BORRADOR/ });
  await expect(btnPdf).toBeVisible({ timeout: 30000 });
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), btnPdf.click()]);
  const out = path.join(SALIDA, 'propuesta.pdf'); await descarga.saveAs(out);
  console.log('[lab-pdf]', await btnPdf.innerText(), fs.statSync(out).size, 'bytes');
});
