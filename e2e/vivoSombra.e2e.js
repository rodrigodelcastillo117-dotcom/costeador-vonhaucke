// ============================================================================
//  PASADA EN VIVO · comparación SOMBRA cliente↔servidor (VH-036/073).
//  Sólo con VIVO=1 + TEST_EMAIL/TEST_PASSWORD. Gasta 1 llamada de IA (analizar-mueble)
//  y dispara costear-servidor (sombra). Verifica que la sombra se registre con motivo.
// ============================================================================
import { test, expect } from '@playwright/test';

const VIVO = process.env.VIVO === '1' && process.env.TEST_EMAIL && process.env.TEST_PASSWORD;
test.skip(!VIVO, 'Pasada en vivo: define VIVO=1, TEST_EMAIL y TEST_PASSWORD.');
test.setTimeout(400_000);

test('Costear con IA → despiece real → sombra contra costear-servidor', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const edges = [];
  page.on('response', async (res) => {
    const u = res.url(); if (!/\/functions\/v1\//.test(u)) return;
    let cuerpo = null; try { cuerpo = JSON.stringify(await res.json()).slice(0, 600); } catch {}
    edges.push({ edge: u.split('/functions/v1/')[1], status: res.status(), cuerpo });
    console.log(`[edge] ${res.status()} ${u.split('/functions/v1/')[1]} ${(cuerpo || '').slice(0, 300)}`);
  });
  await page.goto('/');
  await page.fill('#email-login', process.env.TEST_EMAIL); await page.fill('#pass-login', process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 30000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /¿Cuánto nos cuesta fabricarlo\?/ }).first().click();
  await page.getByRole('button', { name: /^Costear con IA/ }).first().click();
  const caja = page.locator('textarea[placeholder^="Ej. Sillas de espera"]');
  await expect(caja).toBeVisible({ timeout: 15000 });
  await caja.fill('Escritorio ejecutivo 1800 x 800 x 750 mm, cubierta de MDF 19 mm con chapa de nogal, faldón frontal, base de acero pintado en negro');
  const esperaAn = page.waitForResponse((r) => r.url().includes('/functions/v1/analizar-mueble'), { timeout: 150000 });
  let srvRes = null;
  const esperaSrv = page.waitForResponse((r) => r.url().includes('/functions/v1/costear-servidor'), { timeout: 60000 }).then((r) => { srvRes = r; }).catch(() => {});
  await page.getByRole('button', { name: /Analizar con Voni/ }).click();
  const an = await esperaAn; console.log('[vivo] analizar-mueble', an.status());
  await page.waitForTimeout(4000);
  // La sombra SÓLO corre con costo completo y precio (AsistenteEspecial: `resultado.costoUnitario > 0 && precio != null`).
  // Un despiece con materiales del servidor sin precio certificado queda INCOMPLETO y no se compara: es correcto.
  const pendientes = await page.getByText(/sin precio certificado/).count();
  await esperaSrv;
  if (srvRes) {
    const cuerpoSrv = await srvRes.json().catch(() => null);
    console.log('[vivo] costear-servidor', srvRes.status(), JSON.stringify(cuerpoSrv).slice(0, 400));
    expect([200, 400]).toContain(srvRes.status());
    await page.waitForTimeout(2500);   // registrarSombra es fire-and-forget: dar tiempo al insert
  } else {
    console.log(`[vivo] sombra NO aplica: despiece incompleto (${pendientes} material(es) sin precio certificado) → sin precio → sin comparación (por diseño)`);
    expect(pendientes).toBeGreaterThan(0);   // si no hubo sombra, debe haber una razón visible
  }
  await context.close();
});
