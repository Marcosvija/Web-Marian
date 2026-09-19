import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('album layout fits narrow, short, tall and ultrawide viewports at a consistent page scale', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [
    { width: 280, height: 568 }, { width: 320, height: 568 },
    { width: 844, height: 390 }, { width: 1024, height: 768 },
    { width: 1024, height: 1366 }, { width: 1440, height: 900 },
    { width: 2560, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    let coverHeight = 0;
    for (const route of ['/', '/sobre-mi/', '/portfolio/categoria-extensa-de-prueba/', '/contacto/', '/contraportada/']) {
      // Let the fixture dev server finish its first dependency reload and images
      // settle before measuring; this also stabilizes the captured evidence.
      await page.goto(route, { waitUntil: 'networkidle' });
      const sizes = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        frameWidth: document.querySelector('.album-frame')!.getBoundingClientRect().width,
        surface: document.querySelector('[data-album-cover], [data-album-spread]')!.getBoundingClientRect().toJSON(),
        pages: [...document.querySelectorAll('.album-page')].map(el => ({ client: el.clientHeight, scroll: el.scrollHeight })),
      }));
      const label = `${viewport.width}x${viewport.height} ${route}`;
      expect(sizes.overflow, label).toBeLessThanOrEqual(1);
      if (viewport.width >= 944 && viewport.height >= 608) {
        if (route === '/') coverHeight = sizes.surface.height;
        expect(Math.abs(sizes.surface.height - coverHeight), label).toBeLessThan(2);
        expect(sizes.surface.bottom, label).toBeLessThanOrEqual(viewport.height);
        for (const p of sizes.pages) expect(p.scroll - p.client, label).toBeLessThanOrEqual(1);
      } else {
        expect(sizes.frameWidth, label).toBeGreaterThanOrEqual(viewport.width - 49);
      }
      if (testInfo.project.name === 'chromium' && route.includes('extensa')) {
        await page.screenshot({ path: testInfo.outputPath(`mosaic-${viewport.width}x${viewport.height}.png`), fullPage: true });
      }
    }
  }
});

test('ribbon label is exposed, target is 44px and the index owns its keyboard focus', async ({ page }) => {
  for (const width of [1024, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/portfolio/', '/contraportada/']) {
      await page.goto(route);
      const index = page.locator('[data-bookmark-index]');
      const summary = index.locator('summary');
      await expect(index).toHaveAttribute('data-bookmark-viewport-ready', 'true');
      const object = (await page.locator('[data-album-object]').boundingBox())!;
      const hit = (await summary.boundingBox())!;
      const labelLocator = summary.locator('.bookmark-ribbon-label');
      const label = (await labelLocator.boundingBox())!;
      const ribbon = (await summary.locator('.bookmark-ribbon').boundingBox())!;
      const labelFontSize = Number.parseFloat(await labelLocator.evaluate((element) => getComputedStyle(element).fontSize));
      expect(hit.width).toBeGreaterThanOrEqual(44);
      expect(labelFontSize).toBeGreaterThanOrEqual(14);
      const labelCenterRatio = (label.y + label.height / 2 - ribbon.y) / ribbon.height;
      expect(labelCenterRatio).toBeGreaterThan(0.4);
      expect(labelCenterRatio).toBeLessThan(0.52);
      expect(hit.x).toBeGreaterThanOrEqual(8);
      expect(hit.x + hit.width).toBeLessThanOrEqual(width - 8);
      if (route === '/contraportada/') expect(label.x + label.width).toBeLessThan(object.x);
      else expect(label.x).toBeGreaterThan(object.x + object.width);
      await summary.focus();
      await expect(summary).toHaveCSS('outline-style', 'solid');
      await expect(summary).toHaveCSS('clip-path', 'none');
      await page.keyboard.press('Enter');
      expect(await index.locator('.bookmark-panel').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      if (width === 1024 && route === '/portfolio/') {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
      const destination = index.locator('a').first();
      await destination.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await page.keyboard.press('Escape');
      await expect(index).not.toHaveAttribute('open');
      await expect(summary).toBeFocused();
    }
  }
});

test('both closing scenes remove static paper from the area exposed by the actual fold', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical pointer interaction uses desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [route, direction, side] of [
    ['/sobre-mi/', 'previous', 'left'], ['/contacto/', 'next', 'right'],
  ] as const) {
    await page.goto(route);
    const control = page.locator(`[data-page-direction="${direction}"]`);
    await control.hover();
    const host = page.locator('[data-cover-ready="true"]');
    await expect(host).toBeAttached();
    const box = (await control.boundingBox())!;
    const stage = (await page.locator('.album-stage').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (const progress of [0.24, 0.55]) {
      await page.mouse.move(x + (direction === 'next' ? -1 : 1) * stage.width / 2 * progress, y - 95, { steps: 10 });
      await expect(host).toHaveAttribute('data-cover-active', 'true');
      await expect(host.locator(`[data-cover-page="spread-${side}"]`)).not.toHaveCSS('clip-path', 'none');
      const screenshot = testInfo.outputPath(`${direction}-${progress}.png`);
      await page.screenshot({ path: screenshot });
      await testInfo.attach(`${direction}-${progress}`, { path: screenshot, contentType: 'image/png' });
      // Hit testing observes browser clipping independently of our subtraction formula.
      // Hide other faces only for this probe, then restore the physical scene.
      const probe = await host.evaluate((element, side) => {
        const surface = element.querySelector<HTMLElement>(`[data-cover-page="spread-${side}"]`)!;
        const blank = element.querySelector<HTMLElement>('.album-cover-blank-page')!;
        const blankBox = blank.getBoundingClientRect();
        const polygon = getComputedStyle(blank).clipPath.match(/-?[\d.]+px\s+-?[\d.]+px/g)!
          .map(pair => pair.match(/-?[\d.]+/g)!.map(Number) as [number, number]);
        const inside = (x: number, y: number) => {
          let result = false;
          for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i]!; const [xj, yj] = polygon[j]!;
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
          }
          return result;
        };
        const style = document.createElement('style');
        style.textContent = `.album-cover-curl-renderer, .album-cover-curl-renderer * { pointer-events: auto !important; }
          .album-cover-curl-renderer { clip-path: none !important; }
          .album-cover-curl-renderer .stf__item { visibility: hidden !important; }
          [data-cover-page-wrapper="spread-${side}"], [data-cover-page-wrapper="spread-${side}"] * { visibility: visible !important; }`;
        document.head.append(style);
        const inert = [element, ...element.querySelectorAll('[inert]')];
        inert.forEach(el => el.removeAttribute('inert'));
        let sampled = 0; let leaked = 0; let unmaskedHits = 0;
        const clip = surface.style.clipPath;
        for (let x = 12; x < blankBox.width - 12; x += 12) {
          for (let y = 12; y < blankBox.height - 12; y += 12) {
            const clientX = blankBox.x + x; const clientY = blankBox.y + y;
            if (!inside(x, y) || clientX < 0 || clientX >= innerWidth || clientY < 0 || clientY >= innerHeight) continue;
            sampled++;
            const hit = document.elementFromPoint(clientX, clientY);
            if (hit && (surface === hit || surface.contains(hit))) leaked++;
            surface.style.clipPath = 'none';
            const unmasked = document.elementFromPoint(clientX, clientY);
            if (unmasked && (surface === unmasked || surface.contains(unmasked))) unmaskedHits++;
            surface.style.clipPath = clip;
          }
        }
        inert.forEach(el => el.setAttribute('inert', ''));
        style.remove();
        return { sampled, leaked, unmaskedHits };
      }, side);
      expect(probe.sampled, `${direction} ${progress}`).toBeGreaterThan(0);
      expect(probe.unmaskedHits, `${direction} ${progress}`).toBeGreaterThan(0);
      expect(probe.leaked, `${direction} ${progress}`).toBe(0);
    }
    await page.mouse.move(x + (direction === 'next' ? -1 : 1) * 40, y - 15, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('[data-cover-active="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  }
});

test('prepared renderers invalidate on resize and a live reduced-motion change', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical renderer uses desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sobre-mi/');
  const next = page.locator('[data-page-direction="next"]');
  await next.hover();
  const host = page.locator('[data-curl-ready="true"]');
  await expect(host).toBeAttached();
  const oldWidth = (await host.boundingBox())!.width;
  const corner = (await next.boundingBox())!;
  await page.mouse.move(corner.x + corner.width - 10, corner.y + corner.height - 10);
  await page.mouse.down();
  await page.mouse.move(corner.x - 100, corner.y - 20, { steps: 6 });
  await expect(page.locator('[data-album-spread]')).toHaveClass(/is-flex-turning/);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.mouse.up();
  await expect(host).toHaveCount(0);
  await expect(page.locator('[data-album-spread]')).not.toHaveClass(/is-flex-turning/);
  await expect(page).toHaveURL(/\/sobre-mi\/$/);
  await page.mouse.move(0, 0);
  await next.hover();
  await expect(host).toBeAttached();
  expect((await host.boundingBox())!.width).toBeLessThan(oldWidth);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(host).toHaveCount(0);
  await next.click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
});

test('no-JS back-cover index remains exposed and opens inward without scrolling sideways', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto('/contraportada/');
  const summary = page.locator('.bookmark-index summary');
  const label = (await summary.locator('.bookmark-ribbon-label').boundingBox())!;
  const book = (await page.locator('[data-album-object]').boundingBox())!;
  expect(label.x + label.width).toBeLessThan(book.x);
  await summary.click();
  const panel = page.getByRole('navigation', { name: 'Índice del álbum' });
  expect(await panel.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await panel.getByRole('link', { name: 'Portada', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test('a failed preview can be retried without breaking the route link', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical renderer uses desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sobre-mi/');
  let failures = 0;
  await page.route('**/portfolio/', async route => { failures++; await route.abort(); });
  const next = page.locator('[data-page-direction="next"]');
  await next.hover();
  await expect.poll(() => failures).toBeGreaterThan(0);
  await expect(page.locator('[data-curl-renderer]')).toHaveCount(0);
  await page.unroute('**/portfolio/');
  await page.mouse.move(0, 0);
  await next.hover();
  await expect(page.locator('[data-curl-ready="true"]')).toBeAttached();
  await next.click();
  await expect(page).toHaveURL(/\/portfolio\/$/);
});

test('blocked session storage keeps navigation operational', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/sobre-mi/');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/portfolio\/$/);
  expect(errors).toEqual([]);
});

test('undecodable preview images never reveal a broken curl surface', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical renderer uses desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portfolio/');
  let failedImages = 0;
  await page.route('**/*photo-one*', async route => { failedImages++; await route.abort(); });
  const next = page.locator('[data-page-direction="next"]');
  await next.hover();
  await expect.poll(() => failedImages).toBeGreaterThan(0);
  await expect(page.locator('[data-curl-renderer]')).toHaveCount(0);
  await next.click();
  await expect(page).toHaveURL(/\/portfolio\/categoria-de-prueba\/$/);
});

test('modified clicks keep native link semantics for navigation and photos', async ({ page }) => {
  await page.goto('/portfolio/categoria-de-prueba/');
  await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');
  for (const selector of ['[data-page-direction="next"]', '[data-photo-trigger]']) {
    const intercepted = await page.locator(selector).first().evaluate(element => {
      let prevented = false;
      document.addEventListener('click', event => {
        prevented = event.defaultPrevented;
        event.preventDefault(); // Avoid opening a tab in this event-contract test.
      }, { once: true });
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      return prevented;
    });
    expect(intercepted).toBe(false);
  }
  await expect(page.locator('dialog')).not.toBeVisible();
});

test('deep-linked viewer restores focus and album history remains navigable', async ({ page }) => {
  await page.goto('/portfolio/');
  await page.goto('/portfolio/categoria-de-prueba/?foto=foto-prueba-dos');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-photo-id="foto-prueba-dos"]')).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/portfolio\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/portfolio\/categoria-de-prueba\/$/);
  await expect(dialog).not.toBeVisible();
});

test('eighteen photos paginate as five per page, then four, with no implicit overflow rows', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  for (const [route, count] of [['/portfolio/categoria-extensa-de-prueba/', 5], ['/portfolio/categoria-extensa-de-prueba/2/', 4]] as const) {
    await page.goto(route);
    for (const side of ['left', 'right']) {
      const grid = page.locator(`[data-album-spread] > .album-page-${side} .photo-grid`);
      await expect(grid.locator('[data-photo-trigger]')).toHaveCount(count);
      const boxes = await grid.evaluate(element => ({
        grid: element.getBoundingClientRect().toJSON(),
        photos: [...element.querySelectorAll('img')].map(image => image.getBoundingClientRect().toJSON()),
      }));
      for (const photo of boxes.photos) {
        expect(photo.height).toBeGreaterThan(40);
        expect(photo.bottom).toBeLessThanOrEqual(boxes.grid.bottom + 1);
        expect(photo.right).toBeLessThanOrEqual(boxes.grid.right + 1);
      }
    }
    await page.reload();
    await expect(page.locator('[data-photo-trigger]')).toHaveCount(count * 2);
  }
  await page.locator('[data-page-direction="previous"]').click();
  await expect(page).toHaveURL(/\/portfolio\/categoria-extensa-de-prueba\/$/);
});
