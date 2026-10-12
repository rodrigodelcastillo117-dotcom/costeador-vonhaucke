import { test, expect } from '@playwright/test';
import { construirRespuestaAcomodo } from '../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';

// ============================================================================
//  VH-110 / VH-111 · El veredicto del acomodo se explica por bloques y sobrevive la reapertura.
//  Caso real de producción (12-oct, `vivo`): 2 escritorios APP LT en 3 cuartos leídos. El solver
//  coloca 2/2 sin fallas geométricas y el juez semántico pide revisión (topología desconocida).
//  Antes: "requiere revisión: invariantes" (ninguna invariante falló) y, al reabrir, "el servidor
//  no devolvió validación del acomodo". Ahora: geometría ✓, colisiones ✓, semántica ⚠ con texto,
//  y el mismo veredicto tras recargar. Solver = pipeline REAL del edge ejecutado en Node.
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLAVE = 'costeador-vonhaucke-v1';
const SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    cliente: 'PRUEBA VH-110 · veredicto del acomodo',
    partidas: [
      { id: 'd', piezaId: 'linea-escritorio', nombre: 'Escritorio APP LT 1.50 × 0.75', cantidad: 2, precioUnitario: 9800, origen: 'ia', productoId: 'escritorio', w: 1500, d: 750, confianza: 'alta', precioReal: true },
    ],
    acomodo: {
      planReal: true,
      areasM: [
        { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 6, largo: 7, x: 0, y: 0, puestos: 2 },
        { nombre: 'SALA DE JUNTAS', tipo: 'juntas', ancho: 6, largo: 3.5, x: 7, y: 0 },
        { nombre: 'OFICINA DIRECCIÓN', tipo: 'privado', ancho: 6, largo: 3.5, x: 7, y: 4 },
      ],
    },
  },
};
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);

test.describe('VH-110/111 · veredicto del acomodo', () => {
  test.skip(!(EMAIL && PASS), 'Define TEST_EMAIL y TEST_PASSWORD.');
  test.setTimeout(150000);

  test('geometría válida + revisión semántica: se dice qué falta, nunca "invariantes"; igual al reabrir', async ({ page }) => {
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    let ultimaRespuesta = null;
    await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const body = route.request().postDataJSON();
      ultimaRespuesta = construirRespuestaAcomodo(body.areas || [], body.piezas || []);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ultimaRespuesta) });
    });
    await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(v)); } catch (_e) {} }, [CLAVE, SEMILLA]);
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

    await page.getByTestId('home-cotizar').click();
    await page.getByTestId('voni-paso-muebles').click();
    await page.getByTestId('voni-paso-acomodo').click();
    const acomodar = page.getByTestId('acomodo-acomodar');
    await expect(acomodar).toBeVisible({ timeout: 20000 });
    await acomodar.click();
    await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length || 0, { timeout: 30000 }).toBe(2);

    // El edge real (en Node) dejó el caso en revisión semántica sin fallas duras.
    expect(ultimaRespuesta.layoutSpec.status).toBe('NEEDS_SEMANTIC_REVIEW');
    expect((ultimaRespuesta.layoutSpec.validation.issues || []).filter((i) => i.severity === 'fail')).toHaveLength(0);

    const veredicto = page.getByTestId('veredicto-acomodo');
    await expect(veredicto).toBeVisible();
    await expect(veredicto).toHaveAttribute('data-estado', 'REVISION');
    const bloque = (k) => veredicto.locator(`[data-bloque="${k}"]`);
    await expect(bloque('geometria')).toHaveAttribute('data-ok', 'true');
    await expect(bloque('colisiones')).toHaveAttribute('data-ok', 'true');
    await expect(bloque('anclas')).toHaveAttribute('data-ok', 'true');
    await expect(bloque('semantica')).toHaveAttribute('data-ok', 'false');
    await expect(bloque('publicable')).toHaveAttribute('data-ok', 'false');
    const semTexto = await bloque('semantica').innerText();
    expect(semTexto).toMatch(/topología|orientación|asientos/);
    const texto = await page.locator('main').innerText();
    expect(texto).not.toMatch(/requiere revisión: invariantes/);
    expect(texto).not.toMatch(/no devolvió validación/);
    expect(texto).toMatch(/revisión semántica/i);
    console.log('[vh110] semántica:', semTexto.replace(/\s+/g, ' ').slice(0, 220));

    // VH-111: tras recargar, el mismo veredicto y la misma validación del servidor.
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
    await page.getByTestId('home-cotizar').click();
    await page.getByTestId('voni-paso-muebles').click();
    await page.getByTestId('voni-paso-acomodo').click();
    await expect(page.getByTestId('veredicto-acomodo')).toHaveAttribute('data-estado', 'REVISION', { timeout: 20000 });
    const texto2 = await page.locator('main').innerText();
    expect(texto2).not.toMatch(/no devolvió validación/);
    expect(texto2).toMatch(/falta la revisión semántica|revisión semántica/i);
    expect((await leerCot(page)).acomodo.plan.colocacion).toHaveLength(2);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
