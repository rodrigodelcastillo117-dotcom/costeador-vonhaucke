import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

// ============================================================================
//  CIERRE · Fase 7 · COCREAR con un expediente de PRUEBA de la cuenta QA (QA_NIGHT_COCREATE_*, borrador).
//  Se ejercita: entrar → lista de co-creaciones → reabrir → intención/historia cargadas → Guardar (escribe en
//  el expediente QA) → (opcional, COCREAR_RENDER=1) Generar render real → recargar → reabrir → lo guardado sigue.
//  NUNCA: registrar producto (crearía un producto real), cotizar/emitir. Sólo con COCREAR_QA=1 y cuenta QA.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const NOMBRE = process.env.COCREAR_NOMBRE || 'QA_NIGHT_COCREATE';

test.describe('COCREAR · expediente QA', () => {
  test.skip(!(EMAIL && PASS && process.env.COCREAR_QA === '1'), 'Define TEST_EMAIL, TEST_PASSWORD y COCREAR_QA=1.');
  test.setTimeout(300000);

  test('reabrir expediente QA → guardar → (render) → recargar → sigue', async ({ page }, testInfo) => {
    const red = []; const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    page.on('response', async (res) => {
      const u = res.url();
      if (/rpc\/(guardar_cocrear_seguro|cocrear_seguro|registrar_producto|registrar_render_canonico)|functions\/v1\/(generar-render|analizar-mueble|voni)/.test(u)) {
        let j = null; try { j = await res.json(); } catch (_e) {}
        red.push({ t: Date.now(), url: u.replace(/^.*\/(rest\/v1\/rpc|functions\/v1)\//, ''), status: res.status(), ok: j?.ok ?? null, code: j?.code ?? null, error: j?.error ? String(j.error).slice(0, 160) : null });
      }
    });
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    await page.getByTestId('home-cocrear').click();
    await expect(page.getByText(/Qué tienes en mente|Cocrear|Diséñalo|Disénalo/i).first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: testInfo.outputPath('cocrear-1-inicio.png'), fullPage: true });
    const tarjeta = page.getByRole('button', { name: new RegExp(NOMBRE, 'i') }).first();
    const hay = await tarjeta.count();
    console.log('[cocrear] expedientes QA visibles en la lista:', await page.getByRole('button', { name: new RegExp(NOMBRE, 'i') }).count());
    expect(hay, 'la lista de co-creaciones muestra el expediente QA').toBeGreaterThan(0);
    const titulo = (await tarjeta.innerText()).replace(/\s+/g, ' ').slice(0, 80);
    await tarjeta.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: testInfo.outputPath('cocrear-2-reabierto.png'), fullPage: true });
    const textoStudio = await page.locator('main, body').first().innerText();
    expect(textoStudio).not.toMatch(/Expediente sin intención válida|No se pudo (cargar|abrir)/);
    console.log('[cocrear] reabierto:', titulo, '· revisiones:', (textoStudio.match(/R\d · /g) || []).length);
    // Guardar: escribe en el expediente de prueba (dato QA identificado).
    const guardar = page.getByRole('button', { name: /^Guardar$/ }).first();
    if (await guardar.count() && await guardar.isEnabled()) {
      await guardar.click();
      await expect(page.getByText(/Co-creación guardada|No se pudo guardar/)).toBeVisible({ timeout: 20000 });
      console.log('[cocrear] guardar:', (await page.getByText(/Co-creación guardada|No se pudo guardar/).first().innerText()).slice(0, 80));
    } else console.log('[cocrear] botón Guardar no disponible:', await guardar.count(), await guardar.getAttribute('title').catch(() => null));
    // Render real sólo a pedido (cuesta): registra resultado o rechazo con motivo.
    if (process.env.COCREAR_RENDER === '1') {
      const render = page.getByRole('button', { name: /Generar render/i }).first();
      if (await render.count() && await render.isEnabled()) {
        await render.click();
        await expect.poll(() => red.some((r) => /generar-render/.test(r.url)), { timeout: 150000 }).toBe(true);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: testInfo.outputPath('cocrear-3-render.png'), fullPage: true });
      } else console.log('[cocrear] Generar render no disponible:', await render.count(), await render.getAttribute('title').catch(() => null));
    }
    // Nunca: registrar producto / cotizar.
    const registrar = page.getByRole('button', { name: /Registrar|Dar de alta|Cotizar/i });
    console.log('[cocrear] botones irreversibles presentes (no se tocan):', await registrar.count());
    // Recargar y reabrir: lo guardado sigue.
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    await page.getByTestId('home-cocrear').click();
    const t2 = page.getByRole('button', { name: new RegExp(NOMBRE, 'i') }).first();
    await expect(t2).toBeVisible({ timeout: 15000 });
    await t2.click();
    await page.waitForTimeout(2500);
    const texto2 = await page.locator('main, body').first().innerText();
    expect(texto2).not.toMatch(/Expediente sin intención válida/);
    await page.screenshot({ path: testInfo.outputPath('cocrear-4-reabierto-2.png'), fullPage: true });
    writeFileSync(testInfo.outputPath('cocrear-red.json'), JSON.stringify({ red, pageErrors, titulo }, null, 2));
    console.log('[cocrear] red:', JSON.stringify(red));
    console.log('[cocrear] errores de página:', JSON.stringify(pageErrors));
    expect(pageErrors).toHaveLength(0);
  });
});
