import { test, expect } from '@playwright/test';

// SMOKE E2E (navegador real, sin credenciales): la app arranca, monta y NO cae en la
// pantalla blanca ni en la red de último recurso. Atrapa el peor bug posible —
// "la app no abre" — que ninguna prueba unitaria puede ver. Robusto ante login/app.
test.describe('smoke · la app arranca', () => {
  test('carga, monta y no muestra la pantalla de fallo total', async ({ page }) => {
    const erroresConsola = [];
    page.on('pageerror', (e) => erroresConsola.push(String(e)));

    await page.goto('/');

    // 1) Título e idioma correctos (SEO/a11y base).
    await expect(page).toHaveTitle(/Costeador|Vonhaucke/i);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // 2) React montó algo dentro de #raiz (no quedó en blanco).
    await expect(page.locator('#raiz >> *').first()).toBeVisible();

    // 3) NO apareció la malla de último recurso de main.jsx.
    await expect(page.getByText('La app no pudo abrir')).toHaveCount(0);
    await expect(page.getByText('Esta pantalla se atoró')).toHaveCount(0);

    // 4) Hay UI interactiva (login o app): al menos un control visible.
    await expect(page.locator('button, input').first()).toBeVisible();

    // 5) Sin errores JS no atrapados en el arranque.
    expect(erroresConsola, erroresConsola.join('\n')).toHaveLength(0);
  });

  test('no hay scroll horizontal a ancho de teléfono (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('#raiz >> *').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
  test('login · validación local, mostrar contraseña y recuperación no tienen caminos muertos', async ({ page }) => {
    await page.goto('/');

    const entrar = page.getByRole('button', { name: /^Entrar$/i });
    await entrar.click();
    await expect(page.getByText(/Escribe tu correo y tu contraseña/i)).toBeVisible();

    const pass = page.locator('#pass-login');
    await expect(pass).toHaveAttribute('type', 'password');
    await page.getByLabel(/Ver contraseña/i).check();
    await expect(pass).toHaveAttribute('type', 'text');
    await page.getByLabel(/Ver contraseña/i).uncheck();
    await expect(pass).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: /Olvidaste tu contraseña/i }).click();
    await expect(page.getByText(/Escribe tu correo arriba/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Mandarme el enlace/i })).toBeVisible();
    await page.getByRole('button', { name: /Cancelar/i }).click();
    await expect(page.getByRole('button', { name: /Olvidaste tu contraseña/i })).toBeVisible();
  });

});
