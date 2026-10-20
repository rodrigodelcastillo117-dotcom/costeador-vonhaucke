// LABORATORIO · P1-REL-02 (cierre ChatGPT v3): control optimista (VH-148) CONTRA EL DEPLOYMENT (Vercel preview del
// FINAL_SHA + Supabase real, cuenta QA). NO prende la bandera por localStorage: si la preview no se construyó con
// VITE_CONTROL_OPTIMISTA=1, el primer guardado no manda p_actualizado_esperado y el caso FALLA (eso es lo que se certifica).
// Crea su propia cotización de laboratorio (cliente único) y recorre A–L; cada punto queda PASS/FAIL en resultado.json.
// Sólo con LAB_CONC_OPT=1 + TEST_EMAIL/TEST_PASSWORD (+ E2E_BASE_URL = la preview).
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';

const EMAIL = process.env.TEST_EMAIL; const PASS = process.env.TEST_PASSWORD;
const SALIDA = process.env.LAB_OUT || 'test-results-prod/lab-control-optimista';
const CLAVE = 'costeador-vonhaucke-v1';
const NOMBRE = `LAB CONC ${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
const PARTIDAS = [
  { id: 'p-labconc-1', nombre: 'App LT · Módulo operativo (4500 × 1200 mm)', origen: 'banco', deBanco: true, piezaId: 'p9-app-lt-modulo-operativo-36260', cantidad: 1, precioUnitario: 36260, margen: 54, precioReal: true },
  { id: 'p-labconc-2', nombre: 'App LT · Mesa de juntas (2400 × 1200 mm)', origen: 'banco', deBanco: true, piezaId: 'p9-app-lt-mesa-de-juntas-7870', cantidad: 1, precioUnitario: 7870, margen: 54, precioReal: true },
];
const MENSAJE = 'Existe una versión más reciente. Recarga o compara antes de guardar.';
const leerCot = (page) => page.evaluate((k) => { try { return JSON.parse(window.localStorage.getItem(k))?.cotizacion || null; } catch (_e) { return null; } }, CLAVE);
const inputCliente = (page) => page.locator('label.etiqueta', { hasText: /^Cliente$/ }).locator('xpath=following-sibling::input[1]');
const inputFolio = (page) => page.locator('label.etiqueta', { hasText: /^Folio de la propuesta$/ }).locator('xpath=following-sibling::div[1]//input');
const banner = (page) => page.getByTestId('conflicto-guardado');
const tarjetaRespaldo = (page) => page.getByTestId('respaldo-conflicto');
const leerRespaldo = (page, id) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), `costeador-vonhaucke-conflicto-${id}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function pestana(browser, { sembrar = false } = {}) {
  const context = await browser.newContext(); const page = await context.newPage();
  const red = { origen: null, apikey: null, guardados: [], cocrear: [] };
  page.on('request', (req) => {
    const u = req.url();
    if (/\/rest\/v1\//.test(u)) { try { red.origen = new URL(u).origin; red.apikey = req.headers().apikey || red.apikey; } catch (_e) {} }
    if (/rpc\/actualizar_cotizacion_segura/.test(u)) red.guardados.push({ body: req.postData() || '' });
    if (/rpc\/guardar_cocrear_seguro/.test(u)) red.cocrear.push({ body: req.postData() || '' });
  });
  page.on('response', async (r) => { const u = r.url(); if (/rpc\/(actualizar_cotizacion_segura|guardar_cocrear_seguro)/.test(u)) { const l = /cocrear/.test(u) ? red.cocrear : red.guardados; const x = l[l.length - 1]; if (x && x.status == null) x.status = r.status(); } });
  await page.addInitScript(([k, v]) => { try { if (!window.localStorage.getItem('__lab')) { window.localStorage.setItem(k, JSON.stringify(v)); window.localStorage.setItem('__lab', '1'); } } catch (_e) {} },
    [CLAVE, { onboardingVisto: true, cotizacion: sembrar ? { cliente: NOMBRE, partidas: PARTIDAS } : { partidas: [] } }]);
  await page.goto('/');
  await page.fill('#email-login', EMAIL); await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  const servidor = async (id) => page.evaluate(async ([o, k, idc]) => {
    const kk = Object.keys(window.localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
    const tok = kk ? (JSON.parse(window.localStorage.getItem(kk) || '{}').access_token || null) : null;
    const r = await fetch(`${o}/rest/v1/rpc/cotizacion_segura`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: k, authorization: `Bearer ${tok}` }, body: JSON.stringify({ p_id: idc }) });
    const j = await r.json().catch(() => null);
    return j ? { cliente: j.cliente ?? null, folio: j.folio ?? null, actualizado: j.actualizado ?? null, cantidades: (j.partidas || []).map((p) => p.cantidad) } : null;
  }, [red.origen, red.apikey, id]);
  return { context, page, red, servidor };
}
// "Inicio" sólo existe DENTRO de un flujo; en la pantalla de inicio no hay botón (un click sin él se colgaba 20 min).
async function irAInicio(page) {
  const b = page.getByRole('button', { name: /^Inicio$/ }).first();
  if (await b.isVisible().catch(() => false)) await b.click();
}
async function abrirDeLaLista(P) {
  await irAInicio(P.page);
  P.page.removeAllListeners('dialog'); P.page.once('dialog', (d) => d.accept());
  await P.page.getByText('Presupuestos anteriores', { exact: false }).first().click();
  const t = P.page.locator('.tarjeta:has(> .fila-botones)', { hasText: NOMBRE }).first();
  await expect(t).toBeVisible({ timeout: 20000 });
  await t.getByRole('button', { name: /^Abrir$/ }).click();
  await expect(inputCliente(P.page)).toBeVisible({ timeout: 20000 });
}
function dialogos(page) {
  const vistos = []; let r = () => true;
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => { vistos.push(d.message()); if (r(d.message())) await d.accept(); else await d.dismiss(); });
  return { vistos, responder(f) { r = f; } };
}

test.use({ actionTimeout: 20000 });   // un click que no encuentra su botón falla en 20 s, no a los 20 min

test('VH-148 contra el deployment: A–L', async ({ browser }) => {
  test.skip(!(EMAIL && PASS), 'Define TEST_EMAIL y TEST_PASSWORD.');
  test.setTimeout(20 * 60 * 1000); fs.mkdirSync(SALIDA, { recursive: true });
  const res = {}; const nota = {};
  // Diagnóstico por punto: en un FAIL se guardan las dos pantallas, la fila del servidor, el respaldo de B y los
  // guardados de B (status + versión esperada), para no adivinar la causa contra Supabase real.
  const diag = {};
  const punto = async (k, f) => {
    try { await f(); res[k] = 'PASS'; } catch (e) {
      res[k] = 'FAIL'; nota[k] = String(e?.message || e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 4).join(' | ').slice(0, 600);
      console.log(`[lab-conc-opt] ${k} FAIL`, nota[k]);
      try {
        const idx = (await leerCot(A.page))?.id;
        diag[k] = {
          servidor: idx ? await A.servidor(idx) : null,
          localB: await leerCot(B.page), respaldoB: idx ? await leerRespaldo(B.page, idx) : null,
          guardadosB: B.red.guardados.slice(-6).map((g) => ({ status: g.status, esperado: (g.body.match(/"p_actualizado_esperado":"([^"]*)"/) || [])[1] || null })),
        };
        await A.page.screenshot({ path: path.join(SALIDA, `fail-${k}-A.png`), fullPage: true }).catch(() => {});
        await B.page.screenshot({ path: path.join(SALIDA, `fail-${k}-B.png`), fullPage: true }).catch(() => {});
      } catch (_e) { /* el diagnóstico nunca tumba el lab */ }
    }
  };
  const A = await pestana(browser, { sembrar: true });
  // A crea la cotización de laboratorio (autosave → nube).
  await expect.poll(async () => (await leerCot(A.page))?.id || null, { timeout: 30000 }).not.toBeNull();
  const id = (await leerCot(A.page)).id;
  console.log('[lab-conc-opt] cotización', id, NOMBRE);
  await abrirDeLaLista(A);
  const B = await pestana(browser);
  await abrirDeLaLista(B);
  const bandera = await A.page.evaluate(() => localStorage.getItem('vh:controlOptimista'));

  await punto('A_dos_pestanas_misma_version', async () => {
    const [a, b] = [await leerCot(A.page), await leerCot(B.page)];
    expect(a.id).toBe(id); expect(b.id).toBe(id);
    expect(a.actualizado).toBeTruthy(); expect(b.actualizado).toBe(a.actualizado);
  });
  await punto('B_primera_guarda_con_version_esperada', async () => {
    const n = A.red.guardados.length;
    await inputFolio(A.page).fill('LAB-A1');
    await expect.poll(async () => (await A.servidor(id))?.folio, { timeout: 15000 }).toBe('LAB-A1');
    const g = A.red.guardados.slice(n).find((x) => x.status === 200 || x.status === 204) || A.red.guardados[n];
    expect(bandera, 'la bandera NO viene de localStorage: es del build de la preview').toBeNull();
    expect(g?.body || '', 'el build manda la versión esperada (VITE_CONTROL_OPTIMISTA=1)').toMatch(/p_actualizado_esperado/);
  });
  const trasA = await A.servidor(id);
  await punto('C_segunda_recibe_VERSION_CONFLICT', async () => {
    await inputCliente(B.page).fill(`${NOMBRE} B`);
    await expect(banner(B.page)).toBeVisible({ timeout: 15000 });
    await expect(B.page.getByTestId('conflicto-mensaje')).toHaveText(MENSAJE);
    expect(B.red.guardados.some((x) => x.status === 409)).toBe(true);
  });
  await punto('D_no_pisa_servidor', async () => {
    const n = B.red.guardados.length;
    await esperar(4000);
    expect(await A.servidor(id)).toEqual(trasA);
    expect(B.red.guardados.length, 'autosave en pausa').toBe(n);
  });
  await punto('E_respaldo_local', async () => {
    await banner(B.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
    await expect(tarjetaRespaldo(B.page)).toBeVisible({ timeout: 15000 });
    expect((await leerRespaldo(B.page, id))?.cotizacion?.cliente).toBe(`${NOMBRE} B`);
  });
  await punto('F_recargar_muestra_version_servidor', async () => {
    await B.page.reload();
    await expect(B.page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 45000 });
    await expect.poll(async () => (await leerCot(B.page))?.folio, { timeout: 15000 }).toBe('LAB-A1');
    expect((await leerCot(B.page)).cliente).toBe(NOMBRE);
    await expect(tarjetaRespaldo(B.page)).toBeVisible({ timeout: 15000 });
  });
  await punto('G_recuperar_requiere_decision_explicita', async () => {
    await esperar(3000);
    expect((await A.servidor(id)).cliente, 'nada se recupera solo').toBe(NOMBRE);
    const dl = dialogos(B.page);
    await tarjetaRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await expect.poll(async () => (await A.servidor(id))?.cliente, { timeout: 15000 }).toBe(`${NOMBRE} B`);
    expect((await A.servidor(id)).folio, 'lo de A sigue').toBe('LAB-A1');
    nota.G = `confirmaciones: ${dl.vistos.length}`;
  });
  // H · choque en PARTIDAS: A +1 en la 1, B +1 en la 2 (copia vieja) → B ve servidor → Recuperar pide confirmación.
  await punto('H_choque_partidas_no_fusiona_a_ciegas', async () => {
    await abrirDeLaLista(A); await abrirDeLaLista(B);
    await A.page.getByRole('button', { name: '+' }).first().click();
    await expect.poll(async () => (await A.servidor(id))?.cantidades?.[0], { timeout: 15000 }).toBe(2);
    await B.page.getByRole('button', { name: '+' }).nth(1).click();
    await expect(banner(B.page)).toBeVisible({ timeout: 15000 });
    await banner(B.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
    await expect(tarjetaRespaldo(B.page)).toBeVisible({ timeout: 15000 });
    const dl = dialogos(B.page); dl.responder(() => false);
    await tarjetaRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await expect.poll(() => dl.vistos.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(dl.vistos[0]).toMatch(/Partidas/);
    await esperar(2000);
    expect((await A.servidor(id)).cantidades, 'cancelar no toca nada').toEqual([2, 1]);
    dl.responder(() => true);
    await tarjetaRespaldo(B.page).getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await expect.poll(async () => JSON.stringify((await A.servidor(id))?.cantidades), { timeout: 15000 }).toBe(JSON.stringify([1, 2]));   // UN lado completo, no una mezcla renglón por renglón
  });
  await punto('I_descartar_respaldo_pide_confirmacion', async () => {
    await abrirDeLaLista(A); await abrirDeLaLista(B);
    await inputFolio(A.page).fill('LAB-A2');
    await expect.poll(async () => (await A.servidor(id))?.folio, { timeout: 15000 }).toBe('LAB-A2');
    await inputCliente(B.page).fill(`${NOMBRE} B2`);
    await expect(banner(B.page)).toBeVisible({ timeout: 15000 });
    await banner(B.page).getByRole('button', { name: 'Ver la versión del servidor' }).click();
    await expect(tarjetaRespaldo(B.page)).toBeVisible({ timeout: 15000 });
    const antes = await A.servidor(id);
    const dl = dialogos(B.page); dl.responder(() => false);
    await tarjetaRespaldo(B.page).getByRole('button', { name: 'Descartar mi respaldo' }).click();
    await expect.poll(() => dl.vistos.length).toBe(1);
    expect(await leerRespaldo(B.page, id), 'cancelar lo conserva').not.toBeNull();
    dl.responder(() => true);
    await tarjetaRespaldo(B.page).getByRole('button', { name: 'Descartar mi respaldo' }).click();
    await expect.poll(async () => leerRespaldo(B.page, id), { timeout: 10000 }).toBeNull();
    expect(await A.servidor(id)).toEqual(antes);
  });
  await punto('K_red_caida_y_recuperacion', async () => {
    await abrirDeLaLista(A); await abrirDeLaLista(B);
    await B.context.setOffline(true);
    await inputCliente(B.page).fill(`${NOMBRE} offline`);
    await expect(B.page.getByTestId('nube-estado')).toHaveAttribute('data-estado', 'sin-conexion', { timeout: 20000 });
    await inputFolio(A.page).fill('LAB-A3');
    await expect.poll(async () => (await A.servidor(id))?.folio, { timeout: 15000 }).toBe('LAB-A3');
    await B.context.setOffline(false);
    await expect(banner(B.page)).toBeVisible({ timeout: 30000 });
    expect((await A.servidor(id)).folio, 'lo de A intacto').toBe('LAB-A3');
    expect((await leerCot(B.page)).cliente, 'lo de B sigue en su computadora').toBe(`${NOMBRE} offline`);
  });
  await punto('L_doble_click_no_duplica', async () => {
    // Con el conflicto de K abierto: doble clic en "Volver a aplicar" (confirmado) = UN guardado exitoso, una sola fila.
    const dl = dialogos(B.page); dl.responder(() => true);
    const n = B.red.guardados.length;
    await banner(B.page).getByRole('button', { name: 'Volver a aplicar mis cambios' }).dblclick();
    await expect.poll(async () => (await A.servidor(id))?.cliente, { timeout: 15000 }).toBe(`${NOMBRE} offline`);
    await esperar(3000);
    const nuevos = B.red.guardados.slice(n).filter((x) => x.status === 200 || x.status === 204);
    expect(nuevos.length, 'un solo guardado exitoso').toBe(1);
    await irAInicio(B.page);
    await B.page.getByText('Presupuestos anteriores', { exact: false }).first().click();
    await expect(B.page.locator('.tarjeta:has(> .fila-botones)', { hasText: NOMBRE })).toHaveCount(1, { timeout: 15000 });
  });
  // J · Cocrear concurrente: dos pestañas reabren la MISMA co-creación; A guarda; B guarda con su revisión vieja → 409.
  await punto('J_cocrear_revision_esperada', async () => {
    for (const P of [A, B]) {
      await irAInicio(P.page);
      await P.page.getByTestId('home-cocrear').click();
      await expect(P.page.getByText('¿Qué quieres crear?')).toBeVisible({ timeout: 20000 });
      await P.page.locator('.coc3 button').filter({ hasText: 'reabrir' }).first().click();
      await expect(P.page.locator('.c3-studio')).toBeVisible({ timeout: 30000 });
    }
    const ancho = (P) => P.page.locator('label', { hasText: /^Ancho/ }).locator('input').first();
    const vA = Number(await ancho(A).inputValue());
    await ancho(A).fill(String(vA + 10)); await A.page.getByRole('button', { name: /^Guardar$/ }).first().click();
    await expect(A.page.getByTestId('cocrear-mensaje')).toContainText(/guardad/i, { timeout: 20000 });
    await ancho(B).fill(String(vA + 20)); await B.page.getByRole('button', { name: /^Guardar$/ }).first().click();
    await expect(B.page.getByTestId('cocrear-mensaje')).toContainText(/versión más reciente|otra persona|recarga/i, { timeout: 20000 });
    const g = B.red.cocrear.at(-1);
    expect(g?.body || '').toMatch(/p_revision_esperada/);
    expect(g?.status).toBe(409);
  });
  const resumen = { id, cliente: NOMBRE, baseURL: process.env.E2E_BASE_URL || null, banderaLocalStorage: bandera, resultado: res, notas: nota, diagnostico: diag };
  fs.writeFileSync(path.join(SALIDA, 'resultado.json'), JSON.stringify(resumen, null, 2));
  console.log('[lab-conc-opt]', JSON.stringify(resumen));
  await A.context.close(); await B.context.close();
  expect(Object.entries(res).filter(([, v]) => v !== 'PASS').map(([k]) => k), 'A–L todos PASS').toEqual([]);
});
