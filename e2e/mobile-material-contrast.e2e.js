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


test('iPhone: Borrador and Aprobado are legible in every state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => {
    for (const [id, label, selected, disabled] of [
      ['qa-borrador', 'Borrador', true, false],
      ['qa-aprobado', 'Aprobado', false, true],
    ]) {
      const b = document.createElement('button');
      b.id = id;
      b.type = 'button';
      b.className = 'estado-exp-opcion';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(selected));
      b.disabled = disabled;
      document.body.appendChild(b);
    }
  });
  const borrador = page.locator('#qa-borrador');
  const aprobado = page.locator('#qa-aprobado');
  await expect(borrador).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(borrador).toHaveCSS('background-color', 'rgb(159, 40, 50)');
  expect(await borrador.evaluate(el => getComputedStyle(el).webkitTextFillColor)).toBe('rgb(255, 255, 255)');
  await expect(aprobado).toBeDisabled();
  await expect(aprobado).toHaveCSS('color', 'rgb(173, 173, 183)');
  await expect(aprobado).toHaveCSS('background-color', 'rgb(38, 38, 44)');
  expect(await aprobado.evaluate(el => getComputedStyle(el).webkitTextFillColor)).toBe('rgb(173, 173, 183)');
  // Cuando la validación permite aprobar, se presenta como estado activo.
  await aprobado.evaluate(el => {
    el.disabled = false;
    el.setAttribute('aria-pressed', 'true');
  });
  await expect(aprobado).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(aprobado).toHaveCSS('background-color', 'rgb(159, 40, 50)');
});
