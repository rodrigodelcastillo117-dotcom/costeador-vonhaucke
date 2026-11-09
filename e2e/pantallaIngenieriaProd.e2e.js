import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E PRODUCTIVO · Pantalla de Ingenieria DENTRO de COSTEAR autenticado, con
//  persistencia REAL en Supabase (no localStorage). Recorrido de UN usuario
//  sobre SU PROPIO expediente (no explota expedientes ajenos):
//    login (Direccion) -> menu Ingenieria -> GUARDAR BORRADOR (sin fabricar
//    datos) -> guardar_expediente_costeo (RPC 200) -> recargar -> REABRIR desde
//    Supabase (reabrir devuelve la fila guardada, no null).
//
//  El acceso cruzado entre DOS usuarios (B no puede leer/sobrescribir/reclamar
//  el expediente de A) se prueba en entorno AISLADO a nivel de contrato SQL en
//  supabase/tests/expedienteCosteoSeguridad.test.js (12 pruebas), sin tocar
//  expedientes productivos, como pidio la auditoria del P0.
//
//  Credenciales SOLO por env. Requiere TEST_EMAIL, TEST_PASSWORD (Direccion) e
//  INGENIERIA_QA=1. Si no, se SALTA (no se inventan credenciales).
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;

async function cerrarGuia(page) {
  const x = page.getByRole('button', { name: /Cerrar la gu.a/i });
  if (await x.isVisible().catch(() => false)) await x.click();
  await expect(page.locator('.modal-fondo')).toHaveCount(0);
}
async function abrirIngenieria(page) {
  await cerrarGuia(page);
  await page.locator('summary.btn-enc').click();
  await page.getByRole('menuitem', { name: /Ingenier.a \(costeo nuevo\)/i }).click();
  await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible({ timeout: 30000 });
}

test.describe('Pantalla de Ingenieria · PRODUCTIVO (auth + Supabase)', () => {
  test.skip(!(EMAIL && PASS && process.env.INGENIERIA_QA === '1'), 'Define TEST_EMAIL, TEST_PASSWORD e INGENIERIA_QA=1 (cuenta Direccion).');
  test.setTimeout(120000);

  test('login -> Ingenieria -> guardar borrador en Supabase -> reabrir', async ({ page }, testInfo) => {
    const rpc = []; const reabrirBodies = [];
    page.on('response', async (res) => {
      const u = res.url();
      if (/rpc\/guardar_expediente_costeo/.test(u)) rpc.push('guardar ' + res.status());
      if (/rpc\/reabrir_expediente_costeo/.test(u)) {
        rpc.push('reabrir ' + res.status());
        try { reabrirBodies.push(await res.json()); } catch (_e) { /* no json */ }
      }
    });

    await page.goto('/');
    await page.fill('#email-login', EMAIL);
    await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });

    await abrirIngenieria(page);

    // GUARDAR BORRADOR (persiste el expediente tal cual, sin fabricar geometria).
    await page.getByTestId('ing-guardar-borrador').click();
    await expect(page.getByTestId('aviso-confirmacion')).toContainText(/Borrador guardado/i, { timeout: 20000 });
    expect(rpc.some((x) => /guardar 200/.test(x)), 'guardado via RPC Supabase: ' + rpc.join(' | ')).toBe(true);

    await testInfo.attach('ingenieria-prod', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // RECARGAR -> REABRIR desde Supabase: la fila guardada existe (reabrir != null).
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
    await abrirIngenieria(page);
    const ultima = reabrirBodies[reabrirBodies.length - 1];
    expect(ultima, 'reabrir devolvio la fila desde Supabase: ' + JSON.stringify(reabrirBodies)).toBeTruthy();
    expect(ultima && ultima.clave).toBeTruthy();   // reabrio un expediente real, no null
  });
});
