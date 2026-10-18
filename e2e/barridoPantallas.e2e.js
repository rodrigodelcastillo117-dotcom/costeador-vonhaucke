// ============================================================================
//  BARRIDO DE PANTALLAS POR ROL (2026-10-18). Ninguna pantalla que se abre desde el Inicio puede caer en
//  "Esta pantalla se atoró" ni lanzar una excepción de JavaScript, para Dirección, Diseño y Ventas.
//  Corre contra la nube falsa (e2e/nubeFalsa.js): prueba que el CLIENTE no truena; no prueba el servidor.
//  Con E2E_BUILD=1 y `vite preview` corre contra el build de producción.
//  Evidencia: test-results/barrido-<rol>.json (pantalla, botón, errores).
// ============================================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { crearNubeFalsa, estadoLocal, CLAVE_LOCAL } from './nubeFalsa.js';

const USUARIOS = { 'rodrigo@vh.mx': 'direccion', 'diseno@vh.mx': 'diseno', 'ventas@vh.mx': 'vendedor' };
const PARTIDA = { id: 'p1', nombre: 'Banca APP LT 6 usuarios', cantidad: 1, precioUnitario: 48000 };
// Botones que no abren pantalla o que destruyen el estado sembrado.
const SALTAR = /^(Empezar de cero|Salir)$/i;

for (const [email, rol] of Object.entries(USUARIOS)) {
  test(`barrido · ${rol}: cada pantalla del Inicio abre sin "se atoró" ni excepciones`, async ({ browser }) => {
    test.setTimeout(12 * 60_000);
    const nube = crearNubeFalsa({ usuarios: USUARIOS });
    const context = await browser.newContext();
    await nube.instalar(context);
    await context.addInitScript(({ k, v }) => { if (!localStorage.getItem('__sembrado__')) { localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__sembrado__', '1'); } },
      { k: CLAVE_LOCAL, v: estadoLocal({ cotizacion: { cliente: 'Barrido SA', partidas: [PARTIDA] } }) });
    const page = await context.newPage();
    const excepciones = [];
    page.on('pageerror', (e) => excepciones.push(String(e?.message || e).slice(0, 300)));
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    await page.goto('/');
    await page.fill('#email-login', email);
    await page.fill('#pass-login', 'prueba-123');
    await page.getByRole('button', { name: /^Entrar$/i }).click();
    await expect(page.getByRole('button', { name: /Salir/i }).first()).toBeVisible({ timeout: 20000 });

    // Volver al Inicio: el botón "Inicio" de la pantalla (o el logo si no hay); se espera la tarjeta de Cotizar.
    const enInicio = () => page.getByTestId('home-cotizar').isVisible().catch(() => false);
    const inicio = async () => {
      for (let k = 0; k < 3 && !(await enInicio()); k++) {
        const boton = page.getByRole('button', { name: /^Inicio$/ }).first();
        if (await boton.isVisible().catch(() => false)) await boton.click().catch(() => {});
        else await page.locator('header button').first().click().catch(() => {});
        await page.waitForTimeout(400);
      }
      await expect(page.getByTestId('home-cotizar')).toBeVisible({ timeout: 10000 });
    };
    await inicio();
    const n = await page.locator('main button:visible').count();
    const visitas = [];
    for (let i = 0; i < n; i++) {
      await inicio();
      const b = page.locator('main button:visible').nth(i);
      if (!(await b.count())) continue;
      const nombre = ((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label')) || `#${i}`).replace(/\s+/g, ' ').trim().slice(0, 80);
      if (SALTAR.test(nombre)) continue;
      const antes = excepciones.length;
      await b.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
      const atoro = await page.getByText('Esta pantalla se atoró').count();
      const detalle = atoro ? await page.locator('details pre').first().innerText().catch(() => '') : '';
      visitas.push({ boton: nombre, atoro: atoro > 0, detalle: detalle.slice(0, 600), excepciones: excepciones.slice(antes) });
      fs.mkdirSync('test-results', { recursive: true });
      fs.writeFileSync(`test-results/barrido-${rol}.json`, JSON.stringify({ rol, botones: n, visitas, parcial: true }, null, 2));
    }
    fs.writeFileSync(`test-results/barrido-${rol}.json`, JSON.stringify({ rol, botones: n, visitas }, null, 2));
    const malas = visitas.filter((v) => v.atoro || v.excepciones.length);
    expect(malas, JSON.stringify(malas, null, 2)).toEqual([]);
    expect(visitas.length).toBeGreaterThan(3);
    await context.close();
  });
}
