// LABORATORIO · P1 concurrencia del autosave: dos pestañas (misma cuenta QA) sobre la MISMA cotización
// de laboratorio. A cambia la cantidad de la partida 1; B, con su copia vieja, cambia la partida 2.
// Registra lo que queda en la nube tras cada guardado. Si el cambio de A desaparece tras guardar B,
// el último escribe gana y nadie se entera (VH-148). Al final B deshace su cambio para dejar el
// registro como estaba. Sólo con LAB_CLIENTE + TEST_EMAIL/TEST_PASSWORD.
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD; const CLIENTE = process.env.LAB_CLIENTE;
const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-concurrencia';
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);

async function abrir(browser, nombreTab) {
  const context = await browser.newContext(); const page = await context.newPage();
  let origen = null, apikey = null;
  page.on('request', (req) => { const u = req.url(); if (/\/rest\/v1\//.test(u)) { try { origen = new URL(u).origin; apikey = req.headers().apikey || apikey; } catch (_e) {} } });
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
  await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
  const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first();
  await expect(tarjeta).toBeVisible({ timeout: 20000 });
  await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
  await expect.poll(async () => (await leerCot(page))?.id || null, { timeout: 20000 }).not.toBeNull();
  await expect(page.getByRole('button', { name: '+' }).first()).toBeVisible({ timeout: 20000 });
  console.log(`[lab-conc] ${nombreTab} abrió id`, (await leerCot(page)).id);
  const nube = async () => {
    const id = (await leerCot(page)).id;
    return page.evaluate(async ([o, k, idc]) => {
      const kk = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
      const tok = kk ? (JSON.parse(window.localStorage.getItem(kk) || '{}').access_token || null) : null;
      const r = await fetch(`${o}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: k, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: idc }) });
      const j = await r.json().catch(() => null);
      return { id: idc, cantidades: (j?.partidas || []).map((p) => [p.nombre, p.cantidad]) };
    }, [origen, apikey, id]);
  };
  return { context, page, nube };
}

test('dos pestañas editan la misma cotización: ¿se pisan?', async ({ browser }) => {
  test.skip(!(EMAIL && PASS && CLIENTE), 'Define TEST_EMAIL, TEST_PASSWORD y LAB_CLIENTE.');
  test.setTimeout(6 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });
  const A = await abrir(browser, 'A'); const B = await abrir(browser, 'B');
  const antes = await A.nube(); console.log('[lab-conc] antes', JSON.stringify(antes.cantidades));
  expect(antes.cantidades.length).toBeGreaterThan(1);
  // A: +1 en la partida 1 → autosave (1.5 s) → nube.
  await A.page.getByRole('button', { name: '+' }).first().click();
  await A.page.waitForTimeout(4000);
  const trasA = await A.nube(); console.log('[lab-conc] tras A', JSON.stringify(trasA.cantidades));
  // B (copia vieja): +1 en la partida 2 → autosave → nube.
  await B.page.getByRole('button', { name: '+' }).nth(1).click();
  await B.page.waitForTimeout(4000);
  const trasB = await B.nube(); console.log('[lab-conc] tras B', JSON.stringify(trasB.cantidades));
  const cambioAConservado = trasB.cantidades[0]?.[1] === trasA.cantidades[0]?.[1];
  const resumen = { id: antes.id, antes: antes.cantidades, trasA: trasA.cantidades, trasB: trasB.cantidades, cambioAConservado, veredicto: cambioAConservado ? 'los dos cambios conviven' : 'ÚLTIMO ESCRIBE GANA: B borró el cambio de A sin aviso (VH-148)' };
  fs.writeFileSync(path.join(SALIDA, 'resumen.json'), JSON.stringify(resumen, null, 2));
  console.log('[lab-conc]', JSON.stringify(resumen));
  // Deshacer: B regresa la partida 2; A recarga y regresa la partida 1 si quedó.
  await B.page.getByRole('button', { name: '−' }).nth(1).click(); await B.page.waitForTimeout(4000);
  await A.page.reload(); await expect(A.page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
  const final = await B.nube(); console.log('[lab-conc] final', JSON.stringify(final.cantidades));
  if (final.cantidades[0]?.[1] !== antes.cantidades[0]?.[1]) {
    await A.page.getByText('Presupuestos anteriores', { exact: false }).first().click();
    const t = A.page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).first(); await t.getByRole('button', { name: /^Abrir$/ }).click();
    await expect(A.page.getByRole('button', { name: '−' }).first()).toBeVisible({ timeout: 20000 });
    await A.page.getByRole('button', { name: '−' }).first().click(); await A.page.waitForTimeout(4000);
    console.log('[lab-conc] restaurado', JSON.stringify((await A.nube()).cantidades));
  }
  await A.context.close(); await B.context.close();
});
