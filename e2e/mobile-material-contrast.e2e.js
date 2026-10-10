import { test, expect } from '@playwright/test';

// Visual CSS contract (no user account and no mutations). Test uses the actual
// bundled stylesheet in browser at iPhone width, not mocked CSS.
test('iPhone: selected confirmation chips stay readable (not white on white)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'qa-opcion-contraste';
    b.className = 'pregunta-opcion';
    b.textContent = 'Cliente';
    b.setAttribute('aria-pressed', 'false');
    document.body.append(b);
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
  });
  const boton = page.locator('#qa-opcion-contraste');
  await expect(boton).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(boton).toHaveCSS('background-color', 'rgb(34, 35, 43)');
  await boton.click();
  await expect(boton).toHaveAttribute('aria-pressed', 'true');
  await expect(boton).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(boton).toHaveCSS('background-color', 'rgb(156, 32, 40)');
  const fill = await boton.evaluate(el => getComputedStyle(el).webkitTextFillColor);
  expect(fill).toBe('rgb(255, 255, 255)');
});
