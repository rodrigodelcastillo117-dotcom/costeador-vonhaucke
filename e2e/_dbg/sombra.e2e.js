import { test } from '@playwright/test';
test('dbg sombra', async ({ page }) => {
  test.setTimeout(180000);
  const log = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => log.push('[pageerror] ' + String(e).slice(0, 300)));
  page.on('request', (r) => { if (/functions\/v1/.test(r.url())) log.push('[req] ' + r.url().split('/functions/v1/')[1]); });
  await page.addInitScript(() => { try { const k = 'costeador-vonhaucke-v1'; const s = JSON.parse(window.localStorage.getItem(k) || '{}'); s.onboardingVisto = true; window.localStorage.setItem(k, JSON.stringify(s)); } catch (_e) {} });
  await page.goto('/');
  await page.fill('#email-login', process.env.TEST_EMAIL); await page.fill('#pass-login', process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await page.getByRole('button', { name: /Salir/i }).first().waitFor({ timeout: 30000 });
  await page.getByTestId('home-costear').click();
  await page.getByRole('button', { name: /Biblioteca/ }).first().click();
  try {
    await page.getByText('Biblioteca de productos').waitFor({ timeout: 15000 });
    const item = page.getByRole('button', { name: /LAB ciego ATCUBS45ABS 1013-2126/ }).first();
    await item.click({ timeout: 20000 });
    await page.locator('.pieza').first().waitFor({ timeout: 30000 });
    for (let k = 0; k < 3 && !(await page.locator('.precio-enorme').count()); k++) { const vp = page.getByRole('button', { name: /Ver precio|Siguiente/ }); if (await vp.count()) await vp.first().click(); await page.waitForTimeout(1500); }
    await page.waitForTimeout(8000);
    log.push('[estado] ' + (await page.getByTestId('estado-costo-detalle').innerText().catch(() => 'sin estado')));
  } finally { console.log(log.join('\n')); }
});
