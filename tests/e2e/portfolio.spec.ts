import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the album routes, sequential page controls and recoverable index work without client JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Marian' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir el álbum' }).click();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);

  const pageNavigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(pageNavigation.getByRole('link', { name: 'Página anterior: Portada' })).toBeVisible();
  await pageNavigation.getByRole('link', { name: 'Página siguiente: Índice' }).click();
  await expect(page).toHaveURL(/\/portfolio\/$/);

  await page.locator('.bookmark-index summary').click();
  const albumIndex = page.getByRole('navigation', { name: 'Índice del álbum' });
  await expect(albumIndex.getByRole('link', { name: 'Portfolio', exact: true })).toHaveCount(0);
  await expect(albumIndex.getByRole('link', { name: 'Quién soy' })).toBeVisible();
  await expect(albumIndex.getByRole('link', { name: 'Contacto' })).toBeVisible();
  await albumIndex.getByRole('link', { name: 'Categoría de prueba', exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio\/categoria-de-prueba\/$/);

  const categoryNavigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(categoryNavigation.getByRole('link', { name: 'Página anterior: Índice' })).toBeVisible();
  await expect(
    categoryNavigation.getByRole('link', { name: 'Página siguiente: Segunda categoría de prueba' }),
  ).toBeVisible();

  await context.close();
});

test('keyboard page navigation follows the editorial sequence and moves focus to the new page', async ({ page }) => {
  await page.goto('/sobre-mi/');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.locator('#contenido')).toBeFocused();
  await expect(page.locator('#contenido')).toHaveAttribute('data-page-focus-origin', 'keyboard');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');

  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/sobre-mi\/$/);
  await expect(page.locator('#contenido')).toBeFocused();
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
  await expect(page).toHaveURL(/\/portfolio\/categoria-de-prueba\//);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(firstPhoto).toBeFocused();
  await expect(page).not.toHaveURL(/foto=/);
});

test('the photo viewer changes photo after a horizontal touch swipe', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch regression runs on mobile Chromium.');

  await page.goto('/portfolio/categoria-de-prueba/');
  await page.getByRole('link', { name: 'Ampliar: Patrón geométrico de prueba uno' }).click();

  const dialog = page.getByRole('dialog', { name: 'Visor de fotografías' });
  const image = dialog.getByRole('img');
  const box = await image.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const y = box.y + box.height / 2;
  const startX = box.x + box.width * 0.75;
  const endX = box.x + box.width * 0.25;
  const cdp = await page.context().newCDPSession(page);

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: endX, y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect(image).toHaveAttribute('alt', 'Patrón geométrico de prueba dos');
  await expect(page).toHaveURL(/foto=foto-prueba-dos/);
});

test('critical routes have no automatically detectable accessibility violations', async ({ page }) => {
  for (const route of ['/', '/sobre-mi/', '/portfolio/', '/portfolio/categoria-de-prueba/', '/contacto/']) {
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

test('the bookmark remains an album-side tab on desktop without replacing page continuity', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/portfolio/categoria-de-prueba/');

  const album = page.locator('.album-frame');
  const tab = page.locator('.bookmark-index summary');
  const pageNavigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  const previous = pageNavigation.getByRole('link', { name: 'Página anterior: Índice' });
  const next = pageNavigation.getByRole('link', { name: 'Página siguiente: Segunda categoría de prueba' });
  const albumBox = await album.boundingBox();
  const tabBox = await tab.boundingBox();
  const previousBox = await previous.boundingBox();
  const nextBox = await next.boundingBox();

  expect(albumBox).not.toBeNull();
  expect(tabBox).not.toBeNull();
  expect(previousBox).not.toBeNull();
  expect(nextBox).not.toBeNull();
  expect((previousBox?.x ?? 0) + (previousBox?.width ?? 0)).toBeLessThanOrEqual(albumBox?.x ?? 0);
  expect(nextBox?.x ?? 0).toBeGreaterThanOrEqual((albumBox?.x ?? 0) + (albumBox?.width ?? 0));
  await expect(tab).toHaveCSS('writing-mode', 'vertical-rl');

  await tab.click();
  const panelBox = await page
    .getByRole('navigation', { name: 'Índice del álbum' })
    .boundingBox();
  expect(panelBox).not.toBeNull();
  expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThan(tabBox?.x ?? 0);
});

test('touch navigation keeps semantic focus without drawing a frame around the album', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch focus regression runs on mobile Chromium.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sobre-mi/');
  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Índice' });

  await next.tap();
  await expect(page).toHaveURL(/\/portfolio\/$/);

  const main = page.locator('#contenido');
  await expect(main).toBeFocused();
  await expect(main).toHaveAttribute('data-page-focus-origin', 'pointer');
  await expect(main).toHaveCSS('outline-style', 'none');
});

test('desktop side controls stay outside the album even when expanded', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/portfolio/categoria-de-prueba/');

  const albumBox = await page.locator('.album-frame').boundingBox();
  const previous = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página anterior: Índice' });
  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Segunda categoría de prueba' });

  expect(albumBox).not.toBeNull();

  await previous.hover();
  const previousExpanded = await previous.boundingBox();
  expect(previousExpanded).not.toBeNull();
  expect((previousExpanded?.x ?? 0) + (previousExpanded?.width ?? 0)).toBeLessThanOrEqual(albumBox?.x ?? 0);

  await next.hover();
  const nextExpanded = await next.boundingBox();
  expect(nextExpanded).not.toBeNull();
  expect(nextExpanded?.x ?? 0).toBeGreaterThanOrEqual((albumBox?.x ?? 0) + (albumBox?.width ?? 0));
});

test('mobile page controls are visible after the section instead of relying on narrow side targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portfolio/categoria-de-prueba/');

  const sheet = page.locator('.sheet');
  const pageNavigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  const previous = pageNavigation.getByRole('link', { name: 'Página anterior: Índice' });
  const next = pageNavigation.getByRole('link', { name: 'Página siguiente: Segunda categoría de prueba' });
  const sheetBox = await sheet.boundingBox();
  const previousBox = await previous.boundingBox();
  const nextBox = await next.boundingBox();

  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  expect(sheetBox).not.toBeNull();
  expect(previousBox).not.toBeNull();
  expect(nextBox).not.toBeNull();
  expect(previousBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(previousBox?.y ?? 0).toBeGreaterThanOrEqual((sheetBox?.y ?? 0) + (sheetBox?.height ?? 0));
  expect(nextBox?.y ?? 0).toBeGreaterThanOrEqual((sheetBox?.y ?? 0) + (sheetBox?.height ?? 0));
});

test('the album endpoints only render navigation that exists', async ({ page }) => {
  await page.goto('/');
  let navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(navigation.getByRole('link', { name: /Página anterior:/ })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Página siguiente: Quién soy' })).toBeVisible();

  await page.goto('/contacto/');
  navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(navigation.getByRole('link', { name: /Página siguiente:/ })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: /Página anterior:/ })).toBeVisible();
});
