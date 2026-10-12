// ============================================================================
//  PASADA EN VIVO (servidor real) · los cinco caminos con una cuenta de prueba.
//  Sólo corre con VIVO=1 y TEST_EMAIL/TEST_PASSWORD; en CI se salta. Gasta cuota
//  real de IA (≈6 llamadas). Deja un reporte JSON con cada respuesta de edge en
//  REPORTE_VIVO (ruta) para la evidencia del mandato.
// ============================================================================
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const VIVO = process.env.VIVO === '1' && process.env.TEST_EMAIL && process.env.TEST_PASSWORD;
test.skip(!VIVO, 'Pasada en vivo: define VIVO=1, TEST_EMAIL y TEST_PASSWORD.');
test.setTimeout(900_000);

const reporte = { inicio: new Date().toISOString(), pasos: [], edges: [] };
const anota = (paso, ok, detalle) => { reporte.pasos.push({ paso, ok, detalle }); console.log(`[vivo] ${ok ? 'OK ' : 'FALLA'} ${paso} · ${detalle}`); };
const guardar = () => { if (process.env.REPORTE_VIVO) writeFileSync(process.env.REPORTE_VIVO, JSON.stringify(reporte, null, 2)); };

async function planoPNG(page) {
  // Un plano sencillo pero legible: tres cuartos con nombre y cotas en mm.
  await page.setContent(`<html><body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" font-family="Arial">
  <rect x="100" y="100" width="1200" height="700" fill="none" stroke="#000" stroke-width="6"/>
  <line x1="700" y1="100" x2="700" y2="800" stroke="#000" stroke-width="5"/>
  <line x1="700" y1="450" x2="1300" y2="450" stroke="#000" stroke-width="5"/>
  <text x="330" y="430" font-size="34" text-anchor="middle">ÁREA OPERATIVA</text>
  <text x="330" y="475" font-size="26" text-anchor="middle">6000 x 7000</text>
  <text x="1000" y="260" font-size="34" text-anchor="middle">SALA DE JUNTAS</text>
  <text x="1000" y="305" font-size="26" text-anchor="middle">6000 x 3500</text>
  <text x="1000" y="610" font-size="34" text-anchor="middle">OFICINA DIRECCIÓN</text>
  <text x="1000" y="655" font-size="26" text-anchor="middle">6000 x 3500</text>
  <line x1="100" y1="860" x2="1300" y2="860" stroke="#000" stroke-width="2"/><text x="700" y="895" font-size="26" text-anchor="middle">12000</text>
  <line x1="60" y1="100" x2="60" y2="800" stroke="#000" stroke-width="2"/><text x="40" y="460" font-size="26" text-anchor="middle" transform="rotate(-90 40 460)">7000</text>
  <rect x="640" y="760" width="120" height="12" fill="#000"/><text x="700" y="750" font-size="20" text-anchor="middle">puerta 1000</text>
  <text x="700" y="60" font-size="28" text-anchor="middle">PLANTA OFICINAS · ESC 1:100 · cotas en mm</text>
  </svg></body></html>`);
  return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1400, height: 900 } });
}

test('cinco caminos contra el servidor real', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // VH-096: marcar la guía como vista ANTES de montar (igual que auth.e2e.js); el modal
  // "Guía de uso" interceptaba el clic y la pasada en vivo se colgaba 15 min.
  await page.addInitScript(() => {
    try { const k = 'costeador-vonhaucke-v1'; const s = JSON.parse(window.localStorage.getItem(k) || '{}'); s.onboardingVisto = true; window.localStorage.setItem(k, JSON.stringify(s)); } catch (_e) {}
  });
  // Registro de TODAS las respuestas de edges reales (sin cuerpos de imagen).
  page.on('response', async (res) => {
    const u = res.url();
    if (!/\/functions\/v1\//.test(u)) return;
    let cuerpo = null;
    try { const j = await res.json(); cuerpo = JSON.stringify(j, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)).slice(0, 1500); } catch {}
    reporte.edges.push({ edge: u.split('/functions/v1/')[1], status: res.status(), cuerpo });
    console.log(`[edge] ${res.status()} ${u.split('/functions/v1/')[1]} ${cuerpo ? cuerpo.slice(0, 400) : ''}`);
  });

  // 0) Login real
  await page.goto('/');
  await page.fill('#email-login', process.env.TEST_EMAIL); await page.fill('#pass-login', process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 30000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) await page.keyboard.press('Escape');
  anota('login', true, process.env.TEST_EMAIL);

  // 1) COTIZAR con IA (cotizar-texto real)
  try {
    await page.getByTestId('home-cotizar').click();
    await expect(page.getByText(/Soy .*Voni/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Empezar por los muebles/ }).click();
    const caja = page.locator('textarea.ia-textarea').first();
    await caja.fill('2 escritorios App LT de 1.50 x 0.75 y una banca doble App LT para 6 personas con biombo pet');
    await page.getByRole('button', { name: /Armar la lista de muebles/ }).click();
    const res = page.getByText(/Agregué \d+ mueble|No pude armar|No pude costear|Sin precio autorizado|no está en catálogo/).first();
    await expect(res).toBeVisible({ timeout: 120000 });
    anota('cotizar-texto', true, (await res.textContent()).slice(0, 160));
  } catch (e) { anota('cotizar-texto', false, String(e.message).slice(0, 200)); }
  guardar();

  // 2) PLANO (leer-plano real) → compuerta con veredicto del servidor
  try {
    await page.goto('/');
    await page.getByTestId('home-cotizar').click();
    await expect(page.getByText(/Soy .*Voni/i).first()).toBeVisible({ timeout: 10000 });
    const png = await planoPNG(await context.newPage()).catch(() => null);
    const input = page.locator('input[type=file][accept*="pdf"]').first();
    await input.setInputFiles({ name: 'planta.png', mimeType: 'image/png', buffer: png });
    const gate = page.getByTestId('confirmar-lectura');
    const err = page.locator('.alerta.roja, .alerta.ambar').first();
    await Promise.race([gate.waitFor({ timeout: 150000 }), err.waitFor({ timeout: 150000 })]);
    if (await gate.isVisible()) {
      const srv = await page.getByTestId('lectura-servidor').textContent().catch(() => 'sin veredicto');
      const nivel = await page.getByTestId('lectura-nivel').textContent();
      anota('leer-plano', true, `${nivel} · ${srv}`);
      await page.getByTestId('lectura-confirmar').click();
    } else anota('leer-plano', false, (await err.textContent()).slice(0, 200));
  } catch (e) { anota('leer-plano', false, String(e.message).slice(0, 200)); }
  guardar();

  // 3) ACOMODO con IA (acomodar-espacio real)
  try {
    await page.goto('/');
    await page.getByRole('button', { name: /Ver todo lo de cotizar/ }).click();
    await page.getByRole('button', { name: /Acomodo en el espacio \(IA\)/ }).first().click();
    const conIA = page.getByRole('button', { name: /^Con IA$/ });
    await expect(conIA).toBeVisible({ timeout: 20000 });
    const esperaAco = page.waitForResponse((r) => r.url().includes('/functions/v1/acomodar-espacio'), { timeout: 150000 });
    await conIA.click();
    const resAco = await esperaAco;
    await page.waitForTimeout(1500);
    const bad = page.locator('.alerta.roja').first();
    const amb = page.locator('.alerta.ambar').first();
    const hayRoja = await bad.isVisible().catch(() => false);
    const e = reporte.edges.filter((x) => x.edge === 'acomodar-espacio').pop();
    const estadoSrv = (e?.cuerpo || '').match(/"status":"[A-Z_]+"/)?.[0] || '';
    const texto = hayRoja ? await bad.textContent() : (await amb.isVisible().catch(() => false) ? await amb.textContent() : 'plan dibujado sin avisos');
    // FAIL del servidor con error explicado en pantalla también es comportamiento correcto (VH-067).
    anota('acomodar-espacio', resAco.status() === 200 && (!hayRoja || /no pudo colocar/.test(texto)), `${resAco.status()} ${estadoSrv} · ${texto}`.slice(0, 260));
  } catch (e) { anota('acomodar-espacio', false, String(e.message).slice(0, 200)); }
  guardar();

  // 4) COSTEAR (analizar-mueble real) y 5) RENDER (generar-render real)
  try {
    await page.goto('/');
    await page.getByRole('button', { name: /¿Cuánto nos cuesta fabricarlo\?/ }).first().click();
    await page.getByRole('button', { name: /Costear a mano/i }).first().click();
    await expect(page.locator('#desc-voni')).toBeVisible({ timeout: 10000 });
    await page.fill('#desc-voni', 'Credenza ejecutiva 1800 x 500 x 750 mm en MDF 16 mm con chapa de encino, 2 puertas abatibles y 2 cajones, base de acero');
    const esperaAn = page.waitForResponse((r) => r.url().includes('/functions/v1/analizar-mueble'), { timeout: 150000 });
    await page.getByRole('button', { name: /Analizar con Voni/ }).click();
    await esperaAn;
    await expect(page.locator('text=/faltan por costear|Costo|Pieza/').first()).toBeVisible({ timeout: 20000 });
    const fb = await page.getByTestId('catalogo-fallback').isVisible().catch(() => false);
    const e = reporte.edges.filter((x) => x.edge === 'analizar-mueble').pop();
    anota('analizar-mueble', true, `${e?.status} ${(e?.cuerpo || '').match(/"catalogoFuente":"[a-z-]+"/)?.[0] || ''}${fb ? ' · aviso fallback visible' : ''}`);
  } catch (e) { anota('analizar-mueble', false, String(e.message).slice(0, 200)); }
  guardar();
  try {
    const esperaRen = page.waitForResponse((r) => r.url().includes('/functions/v1/generar-render'), { timeout: 240000 });
    await page.getByRole('button', { name: /Generar render con IA/ }).click();
    const resRen = await esperaRen;
    const img = page.locator('img.ficha-foto');
    await img.waitFor({ timeout: 20000 }).catch(() => {});
    if (await img.isVisible().catch(() => false)) { const src = await img.getAttribute('src'); anota('generar-render', resRen.status() === 200 && /^https?:\/\//.test(src), `${resRen.status()} · ${src.slice(0, 160)}`); }
    else { const e = reporte.edges.filter((x) => x.edge === 'generar-render').pop(); anota('generar-render', false, `${resRen.status()} · ${(e?.cuerpo || '').slice(0, 220)}`); }
  } catch (e) { anota('generar-render', false, String(e.message).slice(0, 200)); }
  reporte.fin = new Date().toISOString();
  guardar();
  await context.close();
});
