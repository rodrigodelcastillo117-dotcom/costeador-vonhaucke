import { test, expect, devices } from '@playwright/test';
import { construirRespuestaAcomodo } from '../supabase/functions/acomodar-espacio-recovery/recoveryPipeline.js';

// ============================================================================
//  CIERRE · Fase 6 · verificación en navegador de lo que el cliente ve.
//   · móvil (390×844) en las pantallas críticas: sin scroll horizontal, pasos y botones visibles
//   · autosave sin loops: tras acomodar y quedarse quieto, el guardado a la nube no se repite
//   · botones muertos / avisos engañosos: todo botón deshabilitado dice por qué (title); ningún aviso
//     dice "invariantes" sin falla ni "no devolvió validación"; la salida del acomodo lleva a la propuesta
//   · puerta: los avisos de barrido se etiquetan "Puerta:" / "Por verificar:", nunca "Se sale del área"
//  Solver = pipeline REAL del edge en Node (mismo código que el RC servido con Deno).
// ============================================================================
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const CLAVE = 'costeador-vonhaucke-v1';
const SEMILLA = {
  onboardingVisto: true,
  cotizacion: {
    cliente: 'PRUEBA cierre · navegador',
    partidas: [
      { id: 'd', piezaId: 'linea-escritorio', nombre: 'Escritorio APP LT 1.50 × 0.75', cantidad: 2, precioUnitario: 9800, origen: 'ia', productoId: 'escritorio', w: 1500, d: 750, confianza: 'alta', precioReal: true },
      { id: 's', piezaId: 'p9-silla-operativa-win-5210', nombre: 'Silla operativa · WIN', cantidad: 2, precioUnitario: 5210, origen: 'banco', deBanco: true },
    ],
    acomodo: {
      planReal: true,
      areasM: [
        { nombre: 'ÁREA OPERATIVA', tipo: 'open', ancho: 6, largo: 7, x: 0, y: 0, puestos: 2, puertas: [{ x: 0.3, y: 0, ancho: 0.9 }] },
        { nombre: 'OFICINA DIRECCIÓN', tipo: 'privado', ancho: 6, largo: 3.5, x: 7, y: 4 },
      ],
    },
  },
};
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);

async function entrarYAcomodar(page, guardados) {
  await page.route('**/functions/v1/acomodar-espacio-recovery', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const body = route.request().postDataJSON();
    const r = construirRespuestaAcomodo(body.areas || [], body.piezas || []);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(r) });
  });
  page.on('request', (req) => { if (/\/rest\/v1\/rpc\/(actualizar|crear)_cotizacion_segura/.test(req.url()) && req.method() === 'POST') guardados.push(Date.now()); });
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(v)); } catch (_e) {} }, [CLAVE, SEMILLA]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
  await page.getByTestId('home-cotizar').click();
  await page.getByTestId('voni-paso-muebles').click();
  await page.getByTestId('voni-paso-acomodo').click();
  const acomodar = page.getByTestId('acomodo-acomodar');
  await expect(acomodar).toBeVisible({ timeout: 20000 });
  await acomodar.click();
  await expect.poll(async () => (await leerCot(page))?.acomodo?.plan?.colocacion?.length || 0, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
}

// Botones visibles y deshabilitados sin explicación (title) = botón "muerto" para la persona.
async function botonesMuertos(page) {
  return page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.disabled && b.offsetParent !== null && !(b.getAttribute('title') || '').trim() && !(b.getAttribute('aria-label') || '').trim())
    .map((b) => (b.innerText || b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean));
}
const sinScrollHorizontal = (page) => page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));

test.describe('CIERRE · navegador', () => {
  test.skip(!(EMAIL && PASS), 'Define TEST_EMAIL y TEST_PASSWORD.');
  test.setTimeout(180000);

  test('escritorio: autosave sin loops, avisos honestos, puerta etiquetada, botones deshabilitados explicados, salida a la propuesta', async ({ page }) => {
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    const guardados = [];
    await entrarYAcomodar(page, guardados);
    // Quieto 12 s: el autosave debe asentarse (≤ 3 guardados en la ventana, nunca uno cada ~700 ms).
    const n0 = guardados.length; await page.waitForTimeout(12000);
    const enVentana = guardados.length - n0;
    console.log('[cierre] guardados a la nube en 12 s de reposo:', enVentana, '· total', guardados.length);
    expect(enVentana, 'autosave en loop').toBeLessThanOrEqual(3);
    const texto = await page.locator('main').innerText();
    expect(texto).not.toMatch(/requiere revisión: invariantes/);
    expect(texto).not.toMatch(/no devolvió validación/);
    expect(texto).not.toMatch(/Se sale del área: Barrido/);
    if (/Barrido de puerta/.test(texto)) expect(texto).toMatch(/Puerta:|Por verificar:/);
    await expect(page.getByTestId('veredicto-acomodo')).toBeVisible();
    const muertos = await botonesMuertos(page);
    console.log('[cierre] botones deshabilitados sin motivo (acomodo):', JSON.stringify(muertos));
    expect(muertos, 'botones deshabilitados sin explicación').toEqual([]);
    await expect(page.getByTestId('acomodo-salida')).toHaveText(/Continuar a la propuesta/);
    await page.getByTestId('voni-continuar-propuesta').click();
    await expect(page.getByTestId('voni-paso-propuesta')).toHaveClass(/voni-paso-activo/, { timeout: 10000 });
    await expect(page.getByText(/FOLIO DE LA PROPUESTA/i)).toBeVisible({ timeout: 10000 });
    const muertos2 = await botonesMuertos(page);
    console.log('[cierre] botones deshabilitados sin motivo (propuesta):', JSON.stringify(muertos2));
    expect(muertos2).toEqual([]);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });

  test.describe('móvil', () => {
    // Viewport/touch de un Pixel 5 (sin defaultBrowserType/launchOptions: eso lo decide la config).
    test.use({ viewport: devices['Pixel 5'].viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75, userAgent: devices['Pixel 5'].userAgent });
    test('pantallas críticas en 393×851: sin scroll horizontal, pasos y acciones visibles', async ({ page }) => {
      const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
      const guardados = [];
      await entrarYAcomodar(page, guardados);
      for (const paso of ['espacio', 'muebles', 'acomodo']) {
        await page.getByTestId(`voni-paso-${paso}`).click();
        await page.waitForTimeout(400);
        const { scrollW, innerW } = await sinScrollHorizontal(page);
        console.log(`[cierre·móvil] paso ${paso}: scrollWidth ${scrollW} / innerWidth ${innerW}`);
        expect(scrollW, `scroll horizontal en ${paso}`).toBeLessThanOrEqual(innerW + 1);
      }
      await expect(page.getByTestId('veredicto-acomodo')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('acomodo-acomodar')).toBeVisible();
      const salida = page.getByTestId('voni-continuar-propuesta');
      await salida.scrollIntoViewIfNeeded(); await expect(salida).toBeVisible();
      await salida.click();
      await expect(page.getByText(/FOLIO DE LA PROPUESTA/i)).toBeVisible({ timeout: 10000 });
      const { scrollW, innerW } = await sinScrollHorizontal(page);
      console.log(`[cierre·móvil] propuesta: scrollWidth ${scrollW} / innerWidth ${innerW}`);
      expect(scrollW).toBeLessThanOrEqual(innerW + 1);
      const muertos = await botonesMuertos(page);
      console.log('[cierre·móvil] botones deshabilitados sin motivo:', JSON.stringify(muertos));
      expect(muertos).toEqual([]);
      expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
    });
  });
});
