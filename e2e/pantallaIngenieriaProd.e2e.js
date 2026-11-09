import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E PRODUCTIVO (auditoria p5) · Pantalla de Ingenieria DENTRO de COSTEAR
//  autenticado, con persistencia REAL en Supabase (no localStorage).
//  Recorrido: login (Direccion) -> menu Ingenieria -> expediente piloto TELSVH120
//  -> CONFIRMAR desarrollo CAD -> RECALCULA + GUARDA en Supabase -> recargar ->
//  REABRIR desde Supabase (la decision persiste). Credenciales SOLO por env.
//  Requiere: TEST_EMAIL, TEST_PASSWORD (Direccion) e INGENIERIA_QA=1. Si no, se salta.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;

async function abrirIngenieria(page) {
  await page.locator('summary.btn-enc').click();
  await page.getByRole('menuitem', { name: /Ingenier.a \(costeo nuevo\)/i }).click();
  await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible({ timeout: 30000 });
}

test.describe('Pantalla de Ingenieria · PRODUCTIVO (auth + Supabase)', () => {
  test.skip(!(EMAIL && PASS && process.env.INGENIERIA_QA === '1'), 'Define TEST_EMAIL, TEST_PASSWORD e INGENIERIA_QA=1 (cuenta Direccion).');
  test.setTimeout(120000);

  test('login -> Ingenieria -> confirmar CAD -> guardar Supabase -> reabrir', async ({ page }, testInfo) => {
    const rpc = [];
    page.on('response', (res) => { const u = res.url(); if (/rpc\/(guardar|reabrir)_expediente_costeo/.test(u)) rpc.push(u.replace(/^.*\/rpc\//, '') + ' ' + res.status()); });

    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });

    await abrirIngenieria(page);
    // bootstrap del piloto: CUE pendiente de desarrollo
    await expect(page.getByTestId('pendientes-3d')).toContainText('TELSVH120-CUE');

    // CONFIRMAR desarrollo CAD -> recalcula y GUARDA en Supabase
    await page.getByTestId('ing-confirmar-cad-cue').click();
    await expect(page.getByTestId('pendientes-3d')).not.toContainText('TELSVH120-CUE', { timeout: 20000 });
    await expect(page.getByTestId('n-confirmaciones')).toContainText('1');
    expect(rpc.some((x) => /guardar_expediente_costeo 200/.test(x)), 'guardado via RPC Supabase: ' + rpc.join(' | ')).toBe(true);

    await testInfo.attach('ingenieria-prod', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // RECARGAR -> REABRIR desde Supabase (el contenedor NO usa localStorage): la decision persiste
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
    await abrirIngenieria(page);
    await expect(page.getByTestId('pendientes-3d')).not.toContainText('TELSVH120-CUE');
    await expect(page.getByTestId('n-confirmaciones')).toContainText('1');
  });
});
