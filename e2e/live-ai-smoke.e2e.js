import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;

test('LIVE AI smoke · Costear llama analizar-mueble real y devuelve BOM', async ({ page }) => {
  test.skip(!(EMAIL && PASS), 'Requiere cuenta de prueba autenticada.');
  test.setTimeout(140000);

  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });
  if (await page.getByRole('dialog', { name: /Guía de uso/i }).isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
  }

  await page.getByTestId('home-costear').click();
  await expect(page.getByText(/Qué vas a costear/i)).toBeVisible({ timeout: 15000 });

  const desc = page.getByLabel(/Descríbelo para que la IA lo entienda/i);
  await desc.fill('Escritorio recto de 1200 x 600 x 750 mm, cubierta de melamina de 19 mm, dos patas metálicas PTR y faldón. Una pieza.');
  await page.getByRole('button', { name: /Analizar con Voni/i }).click();

  await expect(page.getByText(/¿De qué está hecho\?/i)).toBeVisible({ timeout: 100000 });
  await expect(page.getByText(/No se pudo analizar el archivo con IA|No se pudo llamar a Claude/i)).toHaveCount(0);
});
