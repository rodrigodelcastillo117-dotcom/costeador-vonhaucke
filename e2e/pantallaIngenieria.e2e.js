import { test, expect } from '@playwright/test';

// ============================================================================
//  E2E NAVEGADOR REAL (sin auth) · Pantalla de Ingenieria dentro de COSTEAR.
//  Ruta de demo #ingenieria-demo (main.jsx) monta el componente real con el
//  expediente TELSVH120 y acciones de un FIXTURE de demo aislado.
//  Prueba (auditoria): CONFIRMAR geometria CAD -> RECALCULAR -> PERSISTIR -> REABRIR,
//  y que un intento de cargar MO SIN AUTORIDAD se RECHAZA (no aprueba datos).
// ============================================================================
test.describe('Pantalla de Ingenieria · recalcular/persistir/reabrir + seguridad', () => {
  test('ciclo + rechazo de MO sin autoridad', async ({ page }, testInfo) => {
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e?.message || e)));

    await page.goto('/#ingenieria-demo');
    await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible();
    await page.evaluate(() => { try { localStorage.clear(); } catch (_e) {} });
    await page.reload();
    await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible();

    // inicial: PARCIAL, CUE pendiente, oficial NO PROCEDE, 0 confirmaciones
    await expect(page.getByTestId('estado-economico')).toContainText('PARCIAL');
    await expect(page.getByTestId('total-oficial')).toContainText('NO PROCEDE');
    await expect(page.getByTestId('pendientes-3d')).toContainText('TELSVH120-CUE');
    await expect(page.getByTestId('n-confirmaciones')).toContainText('0');
    const materialInicial = await page.getByTestId('material-incluido').textContent();

    // CONFIRMAR desarrollo CAD -> RECALCULA (geometria, no aprobacion economica)
    await page.getByTestId('confirmar-cad-cue').click();
    await expect(page.getByTestId('pendientes-3d')).not.toContainText('TELSVH120-CUE');
    await expect(page.getByTestId('n-confirmaciones')).toContainText('1');
    expect(await page.getByTestId('material-incluido').textContent()).not.toBe(materialInicial);

    // INTENTAR cargar MO SIN AUTORIDAD -> RECHAZADO (no aprueba; MO sigue PENDIENTE)
    await expect(page.getByTestId('mo-routing')).toContainText('PENDIENTE');
    await page.getByTestId('intentar-estandares-sin-autoria').click();
    await expect(page.getByTestId('aviso-confirmacion')).toContainText(/Rechazada|no autoriz/i);
    await expect(page.getByTestId('mo-routing')).toContainText('PENDIENTE');      // NO se aprobo
    await expect(page.getByTestId('n-confirmaciones')).toContainText('1');        // el rechazo no cuenta

    await testInfo.attach('pantalla-ingenieria', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // REABRIR (reload): la confirmacion CAD PERSISTE; el intento rechazado no dejo rastro
    await page.reload();
    await expect(page.getByTestId('pantalla-ingenieria')).toBeVisible();
    await expect(page.getByTestId('n-confirmaciones')).toContainText('1');
    await expect(page.getByTestId('pendientes-3d')).not.toContainText('TELSVH120-CUE');

    expect(errores, errores.join('\n')).toHaveLength(0);
  });
});
