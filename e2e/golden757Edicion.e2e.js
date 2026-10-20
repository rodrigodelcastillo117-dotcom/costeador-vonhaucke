import { test, expect } from '@playwright/test';
import fs from 'node:fs';

//  GOLDEN 757 · EDICIÓN MANUAL + PERSISTENCIA REAL (VH-109, prueba B.8 del despliegue controlado).
//  Reabre desde "Presupuestos anteriores" el presupuesto que dejó golden757 (GOLDEN_CLIENTE), gira UNA
//  pieza a mano en la planta, espera el guardado real (RPC `cotizacion_segura`), vacía el estado local,
//  recarga y reabre: la pieza girada sigue girada en la nube y al reabrir. Sólo con credenciales reales.
//  No crea ni desactiva registros: edita el presupuesto de prueba identificado y lo deja así.
//  Cierre GO (14-oct): corre en el proyecto `golden757-edicion`, que DEPENDE de `golden757` (playwright.config.js), y
//  abre EXACTAMENTE el presupuesto que golden757 acaba de dejar (test-results/golden757-ultimo.json). Antes buscaba "el
//  golden más reciente con acomodo" entre datos compartidos mientras golden757 corría en paralelo: flaky en CI 786 y 789
//  ("ningún presupuesto golden reciente tiene acomodo": las 6 tarjetas recientes estaban a medias).
const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
let CLIENTE = process.env.GOLDEN_CLIENTE || 'Torre Sur (golden)';
const CLAVE = 'costeador-vonhaucke-v1';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const firmaCol = (plan) => JSON.stringify((plan?.colocacion || []).map((c) => [c.id, c.area, c.x, c.y, c.rot || 0]).sort());

test.describe('GOLDEN 757 · edición manual del acomodo persiste de verdad', () => {
  test.skip(!(EMAIL && PASS), 'Define TEST_EMAIL y TEST_PASSWORD.');
  test.setTimeout(240000);

  test('girar una pieza a mano → nube → reabrir desde otra sesión', async ({ page }) => {
    const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
    let nubeOrigen = null; let nubeApikey = null;
    page.on('request', (req) => { const u = req.url(); if (/\/rest\/v1\/rpc\//.test(u)) { try { nubeOrigen = new URL(u).origin; nubeApikey = req.headers().apikey || nubeApikey; } catch (_e) {} } });
    await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, JSON.stringify(v)); } catch (_e) {} }, [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await page.goto('/');
    await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });

    // Abre EXACTAMENTE el presupuesto que dejó golden757 en esta corrida (por id): ni "el más reciente" ni datos ajenos.
    const golden = JSON.parse(fs.readFileSync('test-results/golden757-ultimo.json', 'utf8'));
    expect(golden.id, 'golden757 dejó el id de su presupuesto').toBeTruthy();
    if (golden.cliente) CLIENTE = golden.cliente;   // el nombre EXACTO con el que golden757 lo guardó
    const abrir = async (conPlan = true, idBuscado = golden.id) => {
      await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
      const total = await page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).count();
      await page.getByRole('button', { name: /^Inicio$/ }).click();
      for (let i = 0; i < Math.min(Math.max(total, 1), 30); i++) {
        await page.getByText('Presupuestos anteriores', { exact: false }).first().click();
        const tarjeta = page.locator('.tarjeta:has(> .fila-botones)', { hasText: CLIENTE }).nth(i);
        await expect(tarjeta).toBeVisible({ timeout: 20000 });
        await tarjeta.getByRole('button', { name: /^Abrir$/ }).click();
        await expect.poll(async () => (await leerCot(page))?.partidas?.length || 0, { timeout: 20000 }).toBeGreaterThan(0);
        const cot = await leerCot(page);
        const sirve = idBuscado != null ? String(cot?.id) === String(idBuscado) : (!conPlan || (cot?.acomodo?.plan?.colocacion || []).length > 0);
        if (sirve) return cot;
        console.log('[golden757-edicion] tarjeta', i, idBuscado != null ? `es ${cot?.id}, busco ${idBuscado}` : 'sin acomodo (corrida a medias)', '; pruebo la siguiente');
        await page.getByRole('button', { name: /^Inicio$/ }).click();
      }
      throw new Error(`el presupuesto ${idBuscado} que dejó golden757 no aparece en "Presupuestos anteriores"`);
    };
    const cot0 = await abrir();
    expect(String(cot0.id)).toBe(String(golden.id));
    const id = cot0.id; expect(id).toBeTruthy();
    const antes = firmaCol(cot0.acomodo?.plan);
    expect((cot0.acomodo?.plan?.colocacion || []).length).toBeGreaterThan(0);

    const leerNube = () => page.evaluate(async ([origen, apikey, idc]) => {
      const k = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
      const tok = k ? (JSON.parse(window.localStorage.getItem(k) || '{}').access_token || null) : null;
      const r = await fetch(`${origen}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: idc }) });
      const j = await r.json().catch(() => null);
      return { status: r.status, plan: j?.acomodo?.plan || null, partidas: j?.partidas?.length ?? null };
    }, [nubeOrigen, nubeApikey, id]);
    expect(firmaCol((await leerNube()).plan)).toBe(antes);

    // Abrir deja en "Mis cotizaciones": volver al inicio y entrar al acomodo (paso de Voni), planta,
    // "Acomodar a mano", tocar la primera pieza y girarla.
    await page.getByRole('button', { name: /^Inicio$/ }).click();
    await page.getByTestId('home-cotizar').click();
    await page.getByTestId('voni-paso-muebles').click();          // los pasos de Voni se abren en orden
    await page.getByTestId('voni-paso-acomodo').click();
    await page.getByRole('button', { name: /^Planta$/ }).click();
    await page.getByRole('button', { name: /Acomodar a mano/ }).click();
    const piezas = page.locator('svg.plano g[style*="grab"]');
    await expect(piezas.first()).toBeVisible({ timeout: 15000 });
    await piezas.first().click();
    const girar = page.locator('svg.plano text', { hasText: '⟳' }).first();
    await expect(girar).toBeVisible({ timeout: 5000 });
    // El botón es un <g> SVG que obedece onPointerDown (con guarda de 'recién apareció'): se espera y se
    // despacha pointerdown directo (un click real queda "inestable" por el re-render del menú).
    await page.waitForTimeout(700);
    await girar.dispatchEvent('pointerdown');
    await expect.poll(async () => firmaCol((await leerCot(page)).acomodo?.plan), { timeout: 10000 }).not.toBe(antes);
    const despues = firmaCol((await leerCot(page)).acomodo?.plan);
    const a = JSON.parse(antes), b = JSON.parse(despues);
    const cambiadas = b.filter((x, i) => JSON.stringify(x) !== JSON.stringify(a[i]));
    console.log('[golden757-edicion] piezas cambiadas:', JSON.stringify(cambiadas), 'antes:', JSON.stringify(a.filter((x) => cambiadas.some((c) => c[0] === x[0]))));
    expect(cambiadas).toHaveLength(1);
    expect(a.length).toBe(b.length);                       // nada se perdió ni se duplicó

    // Guardado REAL (autosave 1.5 s): la nube trae la pieza girada.
    await expect.poll(async () => firmaCol((await leerNube()).plan), { timeout: 30000, message: 'la edición manual llega a la nube' }).toBe(despues);
    console.log('[golden757-edicion] nube actualizada · id', id);
    if (process.env.GOLDEN_CAPTURA) await page.screenshot({ path: process.env.GOLDEN_CAPTURA, fullPage: false }).catch(() => {});

    // Otra "computadora": estado local vacío, recarga, reabrir desde el Archivo.
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [CLAVE, { onboardingVisto: true, cotizacion: { partidas: [] } }]);
    await page.reload();
    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 45000 });
    const cot2 = await abrir(true, id);                // el MISMO presupuesto, aunque otra corrida haya creado uno más nuevo
    expect(cot2.id).toBe(id);
    expect(cot2.partidas.length).toBe(cot0.partidas.length);
    expect(firmaCol(cot2.acomodo?.plan)).toBe(despues);
    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});
