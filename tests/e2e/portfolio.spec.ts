import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the album routes, sequential page controls and recoverable index work without client JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Marian' })).toBeVisible();
  await page.locator('[data-album-cover="front"]').getByRole('link', { name: 'Abrir el álbum' }).click();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);

  const pageNavigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(pageNavigation.getByRole('link', { name: 'Cerrar álbum' })).toHaveAttribute('href', '/');
  await pageNavigation.getByRole('link', { name: 'Página siguiente: Índice' }).click();
  await expect(page).toHaveURL(/\/portfolio\/$/);

  await page.locator('.bookmark-index summary').click();
  const albumIndex = page.getByRole('navigation', { name: 'Índice del álbum' });
  await expect(albumIndex.getByRole('link', { name: 'Portfolio', exact: true })).toHaveCount(0);
  await expect(albumIndex.getByRole('link', { name: 'Portada', exact: true })).toBeVisible();
  await expect(albumIndex.getByRole('link', { name: 'Quién soy' })).toBeVisible();
  await expect(albumIndex.getByRole('link', { name: 'Contacto' })).toBeVisible();
  await expect(albumIndex.getByRole('link', { name: 'Contraportada', exact: true })).toBeVisible();
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
  for (const route of ['/', '/sobre-mi/', '/portfolio/', '/portfolio/categoria-de-prueba/', '/contacto/', '/contraportada/']) {
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

test('the bookmark is physically inserted and includes both covers in canonical order', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });

  for (const route of ['/', '/portfolio/categoria-de-prueba/', '/contraportada/']) {
    await page.goto(route);

    const object = page.locator('[data-album-object]');
    const index = page.locator('[data-bookmark-index]');
    const tab = index.locator('summary');
    const objectBox = await object.boundingBox();
    const restingBox = await tab.boundingBox();

    expect(objectBox, route).not.toBeNull();
    expect(restingBox, route).not.toBeNull();
    await expect(tab).toHaveCSS('writing-mode', 'vertical-rl');
    await expect(tab).toHaveCSS('border-top-width', '0px');

    expect((restingBox?.y ?? Infinity), route).toBeLessThan((objectBox?.y ?? 0));
    expect(
      (restingBox?.y ?? 0) + (restingBox?.height ?? 0),
      route,
    ).toBeGreaterThan((objectBox?.y ?? Infinity));

    const slotContent = await index.evaluate((element) =>
      getComputedStyle(element, '::before').content,
    );
    const occlusionContent = await index.evaluate((element) =>
      getComputedStyle(element, '::after').content,
    );
    expect(slotContent, route).not.toBe('none');
    expect(occlusionContent, route).not.toBe('none');

    await tab.hover();
    const hoverBox = await tab.boundingBox();
    expect((hoverBox?.y ?? 0), route).toBeLessThan((restingBox?.y ?? 0) - 3);

    await tab.click();
    const openBox = await tab.boundingBox();
    expect((openBox?.y ?? 0), route).toBeLessThan((restingBox?.y ?? 0) - 12);

    const panel = page.getByRole('navigation', { name: 'Índice del álbum' });
    const links = panel.getByRole('link');
    await expect(links.first()).toHaveText(/Portada/);
    await expect(links.last()).toHaveText(/Contraportada/);
    await expect(panel.getByRole('link', { name: 'Quién soy' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Contacto' })).toBeVisible();

    await expect(panel.locator('[data-bookmark-kind="cover"]')).not.toHaveClass(/is-category/);
    await expect(panel.locator('[data-bookmark-kind="back-cover"]')).not.toHaveClass(/is-category/);

    if (route === '/') {
      await expect(panel.getByRole('link', { name: 'Portada', exact: true })).toHaveAttribute('aria-current', 'page');
    }
    if (route === '/contraportada/') {
      await expect(panel.getByRole('link', { name: 'Contraportada', exact: true })).toHaveAttribute('aria-current', 'page');
    }
  }
});

test('mobile index keeps Portada and Contraportada with a labelled 44px control', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile bookmark regression runs on mobile Chromium.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sobre-mi/');

  const tab = page.locator('[data-bookmark-index] summary');
  const box = await tab.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(tab).toContainText('Índice');

  await tab.click();
  const panel = page.getByRole('navigation', { name: 'Índice del álbum' });
  const links = panel.getByRole('link');
  await expect(links.first()).toHaveText(/Portada/);
  await expect(links.last()).toHaveText(/Contraportada/);
});

test('touch navigation keeps semantic focus without drawing a frame around the album', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch focus regression runs on mobile Chromium.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sobre-mi/');
  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Índice' });

  await next.dispatchEvent('click', { detail: 1 });
  await expect(page).toHaveURL(/\/portfolio\/$/);

  const main = page.locator('#contenido');
  await expect(main).toBeFocused();
  await expect(main).toHaveAttribute('data-page-focus-origin', 'pointer');
  await expect(main).toHaveCSS('outline-style', 'none');
});

test('desktop interior is a two-page spread with content distributed across both surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/portfolio/');

  const spread = page.locator('[data-album-spread]');
  const left = spread.locator('.album-page-left');
  const right = spread.locator('.album-page-right');
  const spreadBox = await spread.boundingBox();
  const leftBox = await left.boundingBox();
  const rightBox = await right.boundingBox();

  expect(spreadBox).not.toBeNull();
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(leftBox?.width ?? 0).toBeGreaterThan(300);
  expect(rightBox?.width ?? 0).toBeGreaterThan(300);
  expect(Math.abs((leftBox?.width ?? 0) - (rightBox?.width ?? 0))).toBeLessThan(4);
  expect(Math.abs(((leftBox?.x ?? 0) + (leftBox?.width ?? 0)) - (rightBox?.x ?? 0))).toBeLessThan(4);

  expect(await left.locator('.category-list a').count()).toBeGreaterThan(0);
  expect(await right.locator('.category-list a').count()).toBeGreaterThan(0);
});

test('desktop album scales proportionally with the useful viewport without a fixed visual cap', async ({ page }) => {
  const routes = [
    '/sobre-mi/',
    '/portfolio/',
    '/portfolio/categoria-de-prueba/',
    '/portfolio/segunda-categoria-de-prueba/',
    '/contacto/',
  ];
  const viewports = [
    { width: 1440, height: 900 },
    { width: 2560, height: 1440 },
  ];
  const measuredWidths: number[] = [];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    const expectedWidth = Math.min(
      viewport.width - 48,
      (viewport.height - 88) * (16 / 9),
    );
    const expectedHeight = expectedWidth * (9 / 16);
    let baseline: { width: number; height: number } | null = null;

    for (const route of routes) {
      await page.goto(route);

      const spread = page.locator('[data-album-spread]');
      const spreadBox = await spread.boundingBox();
      expect(spreadBox, `${route} @ ${viewport.width}x${viewport.height}`).not.toBeNull();
      if (!spreadBox) continue;

      expect(Math.abs(spreadBox.width - expectedWidth), route).toBeLessThan(4);
      expect(Math.abs(spreadBox.height - expectedHeight), route).toBeLessThan(4);
      expect(
        Math.abs(spreadBox.width / spreadBox.height - 16 / 9),
        route,
      ).toBeLessThan(0.01);
      expect(
        Math.abs(spreadBox.x + spreadBox.width / 2 - viewport.width / 2),
        route,
      ).toBeLessThan(4);

      if (!baseline) {
        baseline = { width: spreadBox.width, height: spreadBox.height };
      } else {
        expect(Math.abs(spreadBox.width - baseline.width), route).toBeLessThan(2);
        expect(Math.abs(spreadBox.height - baseline.height), route).toBeLessThan(2);
      }

      const pages = spread.locator('.album-page');
      await expect(pages).toHaveCount(2);
      const leftBox = await pages.nth(0).boundingBox();
      const rightBox = await pages.nth(1).boundingBox();
      expect(leftBox, route).not.toBeNull();
      expect(rightBox, route).not.toBeNull();
      expect(Math.abs((leftBox?.width ?? 0) - (rightBox?.width ?? 0)), route).toBeLessThan(2);
      expect(Math.abs((leftBox?.height ?? 0) - spreadBox.height), route).toBeLessThan(2);
      expect(Math.abs((rightBox?.height ?? 0) - spreadBox.height), route).toBeLessThan(2);

      const overflow = await pages.evaluateAll((elements) =>
        elements.map((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        })),
      );
      for (const metrics of overflow) {
        expect(metrics.scrollHeight, route).toBeLessThanOrEqual(metrics.clientHeight + 2);
        expect(metrics.scrollWidth, route).toBeLessThanOrEqual(metrics.clientWidth + 2);
      }
    }

    expect(baseline).not.toBeNull();
    measuredWidths.push(baseline?.width ?? 0);

    await page.goto('/');
    const coverBox = await page.locator('.album-cover').boundingBox();
    expect(coverBox).not.toBeNull();
    expect(Math.abs((coverBox?.height ?? 0) - expectedHeight)).toBeLessThan(2);
    expect(Math.abs((coverBox?.width ?? 0) - expectedWidth / 2)).toBeLessThan(3);
    expect(
      Math.abs((coverBox?.x ?? 0) + (coverBox?.width ?? 0) / 2 - viewport.width / 2),
    ).toBeLessThan(4);
  }

  expect(measuredWidths[1] ?? 0).toBeGreaterThan((measuredWidths[0] ?? 0) * 1.5);
  expect(measuredWidths[1] ?? 0).toBeGreaterThan(96 * 16);
});

test('double spread reflows when useful width or height is insufficient', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 600 },
    { width: 900, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/portfolio/categoria-de-prueba/');

    await expect(page.locator('.album-page').first()).toHaveCSS('display', 'block');
    await expect(
      page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' }),
    ).toHaveCSS('position', 'static');

    const frameBox = await page.locator('.album-frame').boundingBox();
    const spreadBox = await page.locator('[data-album-spread]').boundingBox();
    expect(frameBox).not.toBeNull();
    expect(spreadBox).not.toBeNull();
    expect(spreadBox?.width ?? Infinity).toBeLessThanOrEqual((frameBox?.width ?? 0) + 2);
  }
});

test('single-page reflow adds one small gap between former left and right page groups', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of [
    '/sobre-mi/',
    '/portfolio/',
    '/portfolio/categoria-de-prueba/',
    '/contacto/',
  ]) {
    await page.goto(route);

    const left = page.locator('[data-album-spread] > .album-page-left');
    const right = page.locator('[data-album-spread] > .album-page-right');
    await expect(left, route).toHaveCSS('display', 'block');
    await expect(right, route).toHaveCSS('display', 'block');

    const leftBox = await left.boundingBox();
    const rightBox = await right.boundingBox();
    expect(leftBox, route).not.toBeNull();
    expect(rightBox, route).not.toBeNull();

    const gap = (rightBox?.y ?? 0) - ((leftBox?.y ?? 0) + (leftBox?.height ?? 0));
    expect(gap, route).toBeGreaterThanOrEqual(12);
    expect(gap, route).toBeLessThanOrEqual(20);

    await expect(right, route).toHaveCSS('border-top-width', '0px');
    await expect(right, route).toHaveCSS('box-shadow', 'none');
    await expect(right, route).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
});

test('double spread removes the mobile group gap', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portfolio/categoria-de-prueba/');

  const left = page.locator('[data-album-spread] > .album-page-left');
  const right = page.locator('[data-album-spread] > .album-page-right');
  const leftBox = await left.boundingBox();
  const rightBox = await right.boundingBox();

  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(Math.abs((rightBox?.y ?? 0) - (leftBox?.y ?? 0))).toBeLessThan(2);
  await expect(right).toHaveCSS('margin-top', '0px');
});

test('desktop physical corners stay attached to the lower edge of every interior spread', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const route of [
    '/sobre-mi/',
    '/portfolio/',
    '/portfolio/categoria-de-prueba/',
    '/contacto/',
  ]) {
    await page.goto(route);

    const spread = page.locator('[data-album-spread]');
    const stage = page.locator('.album-stage');
    const navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
    const controls = navigation.locator('.page-navigation-control');
    const spreadBox = await spread.boundingBox();
    const stageBox = await stage.boundingBox();

    expect(spreadBox, route).not.toBeNull();
    expect(stageBox, route).not.toBeNull();

    const spreadBottom = (spreadBox?.y ?? 0) + (spreadBox?.height ?? 0);
    const stageBottom = (stageBox?.y ?? 0) + (stageBox?.height ?? 0);
    expect(Math.abs(stageBottom - spreadBottom), route).toBeLessThan(3);

    const count = await controls.count();
    expect(count, route).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const controlBox = await controls.nth(index).boundingBox();
      expect(controlBox, `${route} control ${index}`).not.toBeNull();
      expect(controlBox?.width ?? 0, route).toBeGreaterThanOrEqual(44);
      expect(controlBox?.height ?? 0, route).toBeGreaterThanOrEqual(44);

      const controlBottom = (controlBox?.y ?? 0) + (controlBox?.height ?? 0);
      expect(Math.abs(controlBottom - spreadBottom), route).toBeLessThan(3);
    }

    const previous = navigation.locator('[data-page-direction="previous"]');
    if (await previous.count()) {
      const previousBox = await previous.boundingBox();
      expect(previousBox?.x ?? Infinity, route).toBeLessThan((spreadBox?.x ?? 0) + 12);
    }

    const next = navigation.locator('[data-page-direction="next"]');
    if (await next.count()) {
      const nextBox = await next.boundingBox();
      expect((nextBox?.x ?? 0) + (nextBox?.width ?? 0), route).toBeGreaterThan(
        (spreadBox?.x ?? 0) + (spreadBox?.width ?? 0) - 12,
      );
    }
  }
});

test('flexible curl renderer uses real adjacent content and follows the corner in two dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/sobre-mi/');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');

  const navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  const next = navigation.getByRole('link', { name: 'Página siguiente: Índice' });
  await next.hover();

  const renderer = page.locator('[data-curl-renderer="next"]');
  await expect(renderer).toHaveAttribute('data-curl-ready', 'true');
  await expect(renderer).toHaveAttribute('aria-hidden', 'true');
  await expect(renderer).toHaveAttribute('inert', '');
  await expect(renderer.locator('[data-curl-page="destination-left"]')).toContainText('Atrapando instantes');

  const currentRight = page.locator('[data-album-spread] > .album-page-right');
  const pageWidth = (await currentRight.boundingBox())?.width ?? 1;
  const box = await next.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width - 10;
  const startY = box.y + box.height - 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - pageWidth * 0.25, startY - 55, { steps: 8 });

  await expect(page.locator('[data-album-spread]')).toHaveClass(/is-flex-turning/);
  await expect(currentRight).toHaveCSS('visibility', 'hidden');

  const movingPage = renderer.locator('.stf__item', { hasText: 'Atrapando instantes' }).first();
  const firstStyle = await movingPage.getAttribute('style');
  expect(firstStyle).toContain('clip-path');
  expect(firstStyle).not.toContain('rotateY(');

  await page.mouse.move(startX - pageWidth * 0.25, startY - 150, { steps: 6 });
  const secondStyle = await movingPage.getAttribute('style');
  expect(secondStyle).not.toEqual(firstStyle);

  await page.mouse.up();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);
  await expect(page.locator('[data-curl-renderer="next"]')).toHaveCount(0, { timeout: 1500 });
  await expect(currentRight).toHaveCSS('visibility', 'visible');
});

test('flexible curl preloads destination images at full decoded quality before revealing them', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/portfolio/');

  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Categoría de prueba' });

  await next.hover();
  const renderer = page.locator('[data-curl-renderer="next"]');
  await expect(renderer).toHaveAttribute('data-curl-ready', 'true');

  const destinationImage = renderer.locator('[data-curl-page^="destination-"] img').first();
  await expect(destinationImage).toBeAttached();
  const imageState = await destinationImage.evaluate((image: HTMLImageElement) => ({
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    loading: image.loading,
  }));
  expect(imageState.complete).toBe(true);
  expect(imageState.naturalWidth).toBeGreaterThan(0);
  expect(imageState.naturalHeight).toBeGreaterThan(0);
  expect(imageState.loading).toBe('eager');
});

test('flexible curl mirrors the renderer for previous navigation and commits from the current deformation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/portfolio/');

  const previous = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página anterior: Quién soy' });

  await previous.hover();
  const renderer = page.locator('[data-curl-renderer="previous"]');
  await expect(renderer).toHaveAttribute('data-curl-ready', 'true');
  await expect(renderer.locator('[data-curl-page="destination-left"]')).toContainText('Quién soy');

  const currentLeft = page.locator('[data-album-spread] > .album-page-left');
  const pageWidth = (await currentLeft.boundingBox())?.width ?? 1;
  const box = await previous.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + 10;
  const startY = box.y + box.height - 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + pageWidth * 0.5, startY - 80, { steps: 10 });
  await page.mouse.up();

  await expect(page).toHaveURL(/\/sobre-mi\/$/, { timeout: 3000 });
});

test('physical page drag cancels below forty percent and confirms above it in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/sobre-mi/');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');

  const rightPage = page.locator('[data-album-spread] > .album-page-right');
  let pageWidth = (await rightPage.boundingBox())?.width ?? 1;
  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Índice' });
  let nextBox = await next.boundingBox();
  expect(nextBox).not.toBeNull();

  let startX = (nextBox?.x ?? 0) + (nextBox?.width ?? 0) - 10;
  let startY = (nextBox?.y ?? 0) + (nextBox?.height ?? 0) - 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - pageWidth * 0.25, startY - 4, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);

  await page.waitForTimeout(220);
  nextBox = await next.boundingBox();
  startX = (nextBox?.x ?? 0) + (nextBox?.width ?? 0) - 10;
  startY = (nextBox?.y ?? 0) + (nextBox?.height ?? 0) - 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - pageWidth * 0.5, startY - 4, { steps: 7 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/portfolio\/$/);

  const leftPage = page.locator('[data-album-spread] > .album-page-left');
  pageWidth = (await leftPage.boundingBox())?.width ?? 1;
  const previous = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página anterior: Quién soy' });
  const previousBox = await previous.boundingBox();
  expect(previousBox).not.toBeNull();

  startX = (previousBox?.x ?? 0) + 10;
  startY = (previousBox?.y ?? 0) + (previousBox?.height ?? 0) - 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + pageWidth * 0.5, startY - 4, { steps: 7 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);
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

  await expect(page.locator('.album-page').first()).toHaveCSS('display', 'block');
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

test('the album sequence closes after Contact and reopens from the back cover', async ({ page }) => {
  await page.goto('/');

  let navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(navigation.getByRole('link', { name: /Página anterior:/ })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Abrir el álbum' })).toBeVisible();

  await page.goto('/contacto/');
  navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(navigation.getByRole('link', { name: 'Cerrar álbum' })).toHaveAttribute('href', '/contraportada/');

  await page.goto('/contraportada/');
  navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
  await expect(navigation.getByRole('link', { name: 'Reabrir álbum' })).toHaveAttribute('href', '/contacto/');
  await expect(navigation.getByRole('link', { name: /Página siguiente:/ })).toHaveCount(0);
  await expect(page.locator('[data-album-cover="back"]').getByRole('link', { name: 'Reabrir álbum', exact: true })).toBeVisible();
});

test('closed front and back covers share one-page geometry and Marian stays anchored to the object', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const measurements: Array<{ width: number; height: number }> = [];

  for (const route of ['/', '/contraportada/']) {
    await page.goto(route);
    const object = page.locator('[data-album-object]');
    const cover = page.locator('[data-album-cover]');
    const home = page.locator('.site-home');
    const objectBox = await object.boundingBox();
    const coverBox = await cover.boundingBox();
    const homeBox = await home.boundingBox();

    expect(objectBox, route).not.toBeNull();
    expect(coverBox, route).not.toBeNull();
    expect(homeBox, route).not.toBeNull();
    expect(Math.abs((homeBox?.x ?? 0) - (objectBox?.x ?? 0)), route).toBeLessThan(3);
    expect(Math.abs((coverBox?.width ?? 0) - (objectBox?.width ?? 0)), route).toBeLessThan(3);
    measurements.push({ width: coverBox?.width ?? 0, height: coverBox?.height ?? 0 });
  }

  expect(Math.abs((measurements[0]?.width ?? 0) - (measurements[1]?.width ?? 0))).toBeLessThan(2);
  expect(Math.abs((measurements[0]?.height ?? 0) - (measurements[1]?.height ?? 0))).toBeLessThan(2);
});

test('desktop corner controls keep semantic links but hide permanent arrows and copy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/portfolio/');

  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Categoría de prueba' });

  await expect(next.locator('.page-navigation-arrow')).toHaveCSS('display', 'none');
  await expect(next.locator('.page-navigation-copy')).toHaveCSS('opacity', '0');
  await next.focus();
  await expect(next.locator('.page-navigation-copy')).toHaveCSS('opacity', '1');
});

test('reduced motion keeps corner links functional without enabling physical page drag', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/sobre-mi/');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');

  const next = page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Índice' });
  const rightPage = page.locator('[data-album-spread] > .album-page-right');

  await next.dispatchEvent('pointerdown', {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: 1200,
    clientY: 700,
  });
  await next.dispatchEvent('pointermove', {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: 800,
    clientY: 700,
  });

  await expect(rightPage).not.toHaveClass(/is-page-turning/);
  await expect(rightPage).toHaveCSS('transform', 'none');

  await next.click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
});


test('no-JS can close Contact to the back cover and reopen the album', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/contacto/');
  await page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Cerrar álbum' })
    .click();
  await expect(page).toHaveURL(/\/contraportada\/$/);

  await page.locator('[data-album-cover="back"]').getByRole('link', { name: 'Reabrir álbum', exact: true }).click();
  await expect(page).toHaveURL(/\/contacto\/$/);
  await context.close();
});

test('hard-cover renderer is opaque and bidirectional at both ends with forty-percent commit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Physical cover drag is desktop-only; mobile keeps labelled controls.');
  await page.setViewportSize({ width: 1280, height: 800 });

  const cases = [
    { route: '/', name: 'Abrir el álbum', mode: 'open-front', direction: 'next', destination: /\/sobre-mi\/$/, cover: 'front-cover' },
    { route: '/sobre-mi/', name: 'Cerrar álbum', mode: 'close-front', direction: 'previous', destination: /\/$/, cover: 'front-cover' },
    { route: '/contacto/', name: 'Cerrar álbum', mode: 'close-back', direction: 'next', destination: /\/contraportada\/$/, cover: 'back-cover' },
    { route: '/contraportada/', name: 'Reabrir álbum', mode: 'open-back', direction: 'previous', destination: /\/contacto\/$/, cover: 'back-cover' },
  ] as const;

  for (const current of cases) {
    await page.goto(current.route);
    await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');

    const navigation = page.getByRole('navigation', { name: 'Recorrido entre páginas del álbum' });
    let control = navigation.getByRole('link', { name: current.name });
    await control.hover();

    let renderer = page.locator(`[data-cover-turn="${current.mode}"]`);
    await expect(renderer).toHaveAttribute('data-cover-ready', 'true');
    await expect(renderer.locator(`[data-cover-page-wrapper="${current.cover}"]`)).toHaveAttribute('data-density', 'hard');
    await expect(renderer.locator(`[data-cover-page="${current.cover}"]`)).toHaveCSS('opacity', '1');

    const pageWidth = (await page.locator('.album-stage').boundingBox())?.width ?? 2;
    const physicalWidth = pageWidth / 2;

    let box = await control.boundingBox();
    expect(box, current.route).not.toBeNull();
    if (!box) continue;

    let startX = current.direction === 'next' ? box.x + box.width - 10 : box.x + 10;
    let startY = box.y + box.height - 10;
    const cancelX = current.direction === 'next'
      ? startX - physicalWidth * 0.25
      : startX + physicalWidth * 0.25;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(cancelX, startY - 24, { steps: 7 });
    await expect(renderer).toHaveClass(/is-active/);
    await expect(renderer.locator(`[data-cover-page="${current.cover}"]`)).toHaveCSS('opacity', '1');
    await page.mouse.up();
    expect(new URL(page.url()).pathname).toBe(current.route);
    await expect(page.locator(`[data-cover-turn="${current.mode}"]`)).toHaveCount(0, { timeout: 1500 });

    control = page
      .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
      .getByRole('link', { name: current.name });
    box = await control.boundingBox();
    expect(box, current.route).not.toBeNull();
    if (!box) continue;

    startX = current.direction === 'next' ? box.x + box.width - 10 : box.x + 10;
    startY = box.y + box.height - 10;
    const commitX = current.direction === 'next'
      ? startX - physicalWidth * 0.5
      : startX + physicalWidth * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(commitX, startY - 32, { steps: 9 });
    renderer = page.locator(`[data-cover-turn="${current.mode}"]`);
    await expect(renderer).toHaveClass(/is-active/);
    await expect(renderer.locator(`[data-cover-page="${current.cover}"]`)).toHaveCSS('opacity', '1');
    await page.mouse.up();
    await expect(page).toHaveURL(current.destination, { timeout: 3500 });
  }
});

test('reduced motion keeps cover endpoints semantic without creating a physical cover renderer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Abrir el álbum' })
    .click();
  await expect(page).toHaveURL(/\/sobre-mi\/$/);
  await expect(page.locator('[data-cover-turn]')).toHaveCount(0);

  await page
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Cerrar álbum' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-cover-turn]')).toHaveCount(0);
});

test('editorial category mosaic balances the fixture across both pages without destructive crop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portfolio/categoria-de-prueba/');

  const left = page.locator('[data-album-spread] > .album-page-left .photo-grid');
  const right = page.locator('[data-album-spread] > .album-page-right .photo-grid');
  await expect(left).toHaveAttribute('data-photo-count', '1');
  await expect(right).toHaveAttribute('data-photo-count', '1');
  await expect(left.locator('img')).toHaveCSS('object-fit', 'contain');
  await expect(right.locator('img')).toHaveCSS('object-fit', 'contain');
});

test('curl destination surface keeps the stable route layout contract for BUG-9', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Physical curl renderer is desktop-only.');

  const current = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const stable = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await current.goto('/portfolio/');
  const next = current
    .getByRole('navigation', { name: 'Recorrido entre páginas del álbum' })
    .getByRole('link', { name: 'Página siguiente: Categoría de prueba' });
  await next.hover();

  const previewWrapper = current.locator('[data-curl-page-wrapper="destination-left"]');
  const previewSurface = current.locator('[data-curl-page="destination-left"]');
  await expect(previewWrapper).toHaveClass(/category-view/);
  await expect(previewSurface).toHaveClass(/album-page-left/);

  const currentRight = current.locator('[data-album-spread] > .album-page-right');
  const pageWidth = (await currentRight.boundingBox())?.width ?? 1;
  const nextBox = await next.boundingBox();
  expect(nextBox).not.toBeNull();
  if (!nextBox) return;

  const startX = nextBox.x + nextBox.width - 10;
  const startY = nextBox.y + nextBox.height - 10;
  await current.mouse.move(startX, startY);
  await current.mouse.down();
  await current.mouse.move(startX - pageWidth * 0.2, startY - 45, { steps: 6 });
  await expect(current.locator('[data-album-spread]')).toHaveClass(/is-flex-turning/);

  const readLayoutContract = async (surface: import('@playwright/test').Locator) =>
    surface.evaluate((element) => {
      const heading = element.querySelector<HTMLElement>('.section-heading');
      const title = element.querySelector<HTMLElement>('h1');
      const grid = element.querySelector<HTMLElement>('.photo-grid');
      const surfaceStyle = getComputedStyle(element);
      const headingStyle = heading ? getComputedStyle(heading) : null;
      const titleStyle = title ? getComputedStyle(title) : null;
      const gridStyle = grid ? getComputedStyle(grid) : null;

      return {
        paddingInlineStart: surfaceStyle.paddingInlineStart,
        paddingBlockStart: surfaceStyle.paddingBlockStart,
        paddingBlockEnd: surfaceStyle.paddingBlockEnd,
        display: surfaceStyle.display,
        flexDirection: surfaceStyle.flexDirection,
        headingMarginBlockEnd: headingStyle?.marginBlockEnd ?? null,
        titleFontSize: titleStyle?.fontSize ?? null,
        titleLineHeight: titleStyle?.lineHeight ?? null,
        gridDisplay: gridStyle?.display ?? null,
        gridColumns: gridStyle?.gridTemplateColumns ?? null,
        gridRows: gridStyle?.gridTemplateRows ?? null,
        gridGap: gridStyle?.gap ?? null,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      };
    });

  const previewContract = await readLayoutContract(previewSurface);

  await stable.goto('/portfolio/categoria-de-prueba/');
  const stableSurface = stable.locator('[data-album-spread] > .album-page-left');
  const stableContract = await readLayoutContract(stableSurface);

  expect(previewContract).toEqual(stableContract);
  await current.mouse.up();
  await expect(current).toHaveURL(/\/portfolio\/$/);
  await current.close();
  await stable.close();
});
