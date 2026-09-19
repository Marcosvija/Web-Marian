import { expect, test, type Page } from '@playwright/test';

const physicalViewport = { width: 1280, height: 800 };

async function waitForAutomaticTurn(page: Page, direction: 'previous' | 'next') {
  await expect(page.locator('html')).toHaveAttribute('data-album-automatic-turn', direction);
  await expect(page.locator(`[data-curl-renderer="${direction}"][data-curl-active="true"]`)).toBeAttached();
}

test('interior corners click through the existing flexible renderer in both directions before navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical automatic turn uses desktop mode.');
  await page.setViewportSize(physicalViewport);

  for (const current of [
    { from: '/sobre-mi/', destination: /\/portfolio\/$/, direction: 'next' as const },
    { from: '/portfolio/', destination: /\/sobre-mi\/$/, direction: 'previous' as const },
  ]) {
    await page.goto(current.from);
    const control = page.locator(`[data-page-direction="${current.direction}"]`);
    await control.hover();
    await expect(page.locator(`[data-curl-renderer="${current.direction}"][data-curl-ready="true"]`)).toBeAttached();

    const sourceUrl = page.url();
    const startedAt = Date.now();
    await control.evaluate((element: HTMLAnchorElement) => element.click());
    await waitForAutomaticTurn(page, current.direction);
    expect(page.url()).toBe(sourceUrl);

    await expect(page).toHaveURL(current.destination);
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(elapsed).toBeLessThan(1200);
  }
});

test('Enter, Space and sub-8px pointer activation use the same automatic interior turn and preserve keyboard focus origin', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical automatic turn uses desktop mode.');
  await page.setViewportSize(physicalViewport);

  for (const key of ['Enter', 'Space'] as const) {
    await page.goto('/sobre-mi/');
    const control = page.locator('[data-page-direction="next"]');
    await control.focus();
    await expect(page.locator('[data-curl-ready="true"]')).toBeAttached();
    await page.keyboard.press(key);
    await waitForAutomaticTurn(page, 'next');
    await expect(page).toHaveURL(/\/portfolio\/$/);
    await expect(page.locator('#contenido')).toBeFocused();
    await expect(page.locator('#contenido')).toHaveAttribute('data-page-focus-origin', 'keyboard');
  }

  await page.goto('/sobre-mi/');
  const control = page.locator('[data-page-direction="next"]');
  await control.hover();
  await expect(page.locator('[data-curl-ready="true"]')).toBeAttached();
  const box = (await control.boundingBox())!;
  const x = box.x + box.width - 10;
  const y = box.y + box.height - 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 5, y - 2);
  await page.mouse.up();
  await waitForAutomaticTurn(page, 'next');
  await expect(page).toHaveURL(/\/portfolio\/$/);
});

test('automatic interior turn blocks repeated/opposite activations and falls back to the real href when preview preparation fails', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical automatic turn uses desktop mode.');
  await page.setViewportSize(physicalViewport);
  await page.goto('/portfolio/');

  const next = page.locator('[data-page-direction="next"]');
  const previous = page.locator('[data-page-direction="previous"]');
  await next.hover();
  await expect(page.locator('[data-curl-renderer="next"][data-curl-ready="true"]')).toBeAttached();

  let destinationNavigations = 0;
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/portfolio/categoria-de-prueba/') {
      destinationNavigations += 1;
    }
  });

  await next.evaluate((element: HTMLAnchorElement) => {
    element.click();
    element.click();
  });
  await previous.evaluate((element: HTMLAnchorElement) => element.click());
  await waitForAutomaticTurn(page, 'next');
  await expect(page).toHaveURL(/\/portfolio\/categoria-de-prueba\/$/);
  expect(destinationNavigations).toBe(1);

  await page.goto('/sobre-mi/');
  await page.route('**/portfolio/', async route => {
    if (route.request().headers()['x-album-turn-preview']) await route.abort();
    else await route.continue();
  });
  const fallback = page.locator('[data-page-direction="next"]');
  await fallback.hover();
  await expect(page.locator('[data-curl-renderer]')).toHaveCount(0);
  await fallback.click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.locator('[data-curl-active="true"]')).toHaveCount(0);
});

test('automatic-turn refinement preserves the 40 percent drag threshold and direct reduced-motion navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical drag threshold uses desktop mode.');
  await page.setViewportSize(physicalViewport);
  await page.goto('/sobre-mi/');

  const next = page.locator('[data-page-direction="next"]');
  await next.hover();
  await expect(page.locator('[data-curl-ready="true"]')).toBeAttached();
  const box = (await next.boundingBox())!;
  const pageWidth = (await page.locator('[data-album-spread] > .album-page-right').boundingBox())!.width;
  const x = box.x + box.width - 10;
  const y = box.y + box.height - 10;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - pageWidth * 0.25, y - 10, { steps: 6 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);
  await expect(page.locator('[data-curl-active="true"]')).toHaveCount(0);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - pageWidth * 0.5, y - 10, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/portfolio\/$/);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sobre-mi/');
  const reduced = page.locator('[data-page-direction="next"]');
  await reduced.click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await expect(page.locator('[data-album-automatic-turn]')).toHaveCount(0);
  await expect(page.locator('[data-curl-active="true"]')).toHaveCount(0);
});

test('interior corner visual fold stays compact while the physical hit target remains at least 44px', async ({ page }) => {
  await page.setViewportSize(physicalViewport);
  await page.goto('/portfolio/');
  const next = page.locator('[data-page-direction="next"]');
  const geometry = await next.evaluate(element => {
    const hit = element.getBoundingClientRect();
    const fold = getComputedStyle(element, '::before');
    return {
      hit: hit.toJSON(),
      width: parseFloat(fold.width),
      height: parseFloat(fold.height),
      content: fold.content,
    };
  });
  expect(geometry.hit.width).toBeGreaterThanOrEqual(44);
  expect(geometry.hit.height).toBeGreaterThanOrEqual(44);
  expect(geometry.width).toBeGreaterThanOrEqual(40);
  expect(geometry.width).toBeLessThanOrEqual(52);
  expect(geometry.height).toBeGreaterThanOrEqual(40);
  expect(geometry.height).toBeLessThanOrEqual(52);
  expect(geometry.content).not.toBe('none');
});
