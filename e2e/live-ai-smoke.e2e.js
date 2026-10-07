import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL;
const PASS = process.env.TEST_PASSWORD;

test('LIVE AI smoke · Costear llama analizar-mueble real y devuelve BOM', async ({ page }) => {
  test.skip(!(EMAIL && PASS), 'Requiere cuenta de prueba autenticada.');
  test.setTimeout(140000);

  // Determinista (#9): marca onboarding visto ANTES de montar para que el modal
  // de guía nunca intercepte los clicks del flujo.
  await page.addInitScript(() => {
    try {
      const k = 'costeador-vonhaucke-v1';
      const s = JSON.parse(window.localStorage.getItem(k) || '{}');
      s.onboardingVisto = true;
      window.localStorage.setItem(k, JSON.stringify(s));
    } catch (_e) { /* modo privado */ }
  });
  await page.goto('/');
  await page.fill('#email-login', EMAIL);
  await page.fill('#pass-login', PASS);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible({ timeout: 20000 });

  await page.getByTestId('home-costear').click();
  await expect(page.getByText(/Qué vas a costear/i)).toBeVisible({ timeout: 15000 });

  const desc = page.getByLabel(/Descríbelo para que la IA lo entienda/i);
  await desc.fill('Escritorio recto de 1200 x 600 x 750 mm, cubierta de melamina de 19 mm, dos patas metálicas PTR y faldón. Una pieza.');
  await page.getByRole('button', { name: /Analizar con Voni/i }).click();

  await expect(page.getByText(/¿De qué está hecho\?/i)).toBeVisible({ timeout: 100000 });
  await expect(page.getByText(/No se pudo analizar el archivo con IA|No se pudo llamar a Claude/i)).toHaveCount(0);
});
