import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E NAVEGADOR REAL (sin auth) · Pantalla de Ingenieria dentro de COSTEAR.
//  Ruta de demo #ingenieria-demo (main.jsx) monta el componente real con el
//  expediente TELSVH120. Prueba el ciclo que pidio la auditoria (punto 5):
//  CONFIRMAR -> RECALCULAR (motor) -> PERSISTIR -> REABRIR (reload) sin perder decisiones.
//  No toca login, Supabase, ni datos oficiales.
// ============================================================================
test.describe('Pantalla de Ingenieria · confirmar/recalcular/persistir/reabrir', () => {
  test('ciclo completo en navegador real', async ({ page }, testInfo) => {
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e?.message || e)));

    await page.goto('/#ingenieria-demo');
    const pant = page.getByTestId('pantalla-ingenieria');
    await expect(pant).toBeVisible();
    // estado limpio: borra cualquier persistencia previa y recarga
    await page.evaluate(() => { try { localStorage.clear(); } catch (_e) {} });
    await page.reload();
    await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible();

    // --- estado inicial: PARCIAL, CUE pendiente, oficial NO PROCEDE, 0 confirmaciones ---
    await expect(page.getByTestId('estado-economico')).toContainText('PARCIAL');
    await expect(page.getByTestId('total-oficial')).toContainText('NO PROCEDE');
    await expect(page.getByTestId('pendientes-3d')).toContainText('TELSVH120-CUE');
    await expect(page.getByTestId('n-confirmaciones')).toContainText('0');
    const materialInicial = await page.getByTestId('material-incluido').textContent();

    // --- CONFIRMAR desarrollo CAD del cuerpo -> RECALCULA ---
    await page.getByTestId('confirmar-cad-cue').click();
    await expect(page.getByTestId('pendientes-3d')).not.toContainText('TELSVH120-CUE'); // CUE sale de pendientes
    await expect(page.getByTestId('n-confirmaciones')).toContainText('1');
    const materialTrasCAD = await page.getByTestId('material-incluido').textContent();
    expect(materialTrasCAD).not.toBe(materialInicial);                                   // el total recalculo

    // --- CONFIRMAR estandares de MO -> la MO por routing deja de ser PENDIENTE ---
    await expect(page.getByTestId('mo-routing')).toContainText('PENDIENTE');
    await page.getByTestId('confirmar-estandares').click();
    await expect(page.getByTestId('mo-routing')).not.toContainText('PENDIENTE');

    await testInfo.attach('pantalla-ingenieria', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // --- REABRIR (reload): las confirmaciones PERSISTEN, no se pierde ninguna decision ---
    await page.reload();
    await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible();
    await expect(page.getByTestId('n-confirmaciones')).toContainText('2');               // CAD + estandares persistidas
    await expect(page.getByTestId('pendientes-3d')).not.toContainText('TELSVH120-CUE');  // sigue resuelto
    await expect(page.getByTestId('mo-routing')).not.toContainText('PENDIENTE');

    expect(errores, errores.join('\n')).toHaveLength(0);
  });
});
