import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the album routes and recoverable index work without client JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Marian' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir el álbum' }).click();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);

  await page.getByText('Índice', { exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Índice del álbum' })
    .getByRole('link', { name: 'Portfolio', exact: true })
    .click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.getByRole('heading', { name: 'Atrapando instantes' })).toBeVisible();

  await context.close();
});

test('the photo viewer supports URL state, keyboard navigation and focus restoration', async ({ page }) => {
  await page.goto('/portfolio/categoria-de-prueba/');

  const firstPhoto = page.getByRole('link', { name: 'Ampliar: Patrón geométrico de prueba uno' });
  await firstPhoto.focus();
  await firstPhoto.click();

  const dialog = page.getByRole('dialog', { name: 'Visor de fotografías' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/foto=foto-prueba-uno/);

  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('img')).toHaveAttribute('alt', 'Patrón geométrico de prueba dos');
  await expect(page).toHaveURL(/foto=foto-prueba-dos/);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(firstPhoto).toBeFocused();
  await expect(page).not.toHaveURL(/foto=/);
});

test('critical routes have no automatically detectable accessibility violations', async ({ page }) => {
  for (const route of ['/', '/portfolio/', '/portfolio/categoria-de-prueba/', '/contacto/']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('main')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test('reduced motion removes the page entrance animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/portfolio/');

  const animationName = await page.locator('.sheet').evaluate(
    (element) => window.getComputedStyle(element).animationName,
  );

  expect(animationName).toBe('none');
});
