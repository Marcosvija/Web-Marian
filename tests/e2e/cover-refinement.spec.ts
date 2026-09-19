import { expect, test, type Page } from '@playwright/test';

const transitions = [
  ['/', '/sobre-mi/', 'next'], ['/sobre-mi/', '/', 'previous'],
  ['/contacto/', '/contraportada/', 'next'], ['/contraportada/', '/contacto/', 'previous'],
] as const;
const paint = (page: Page) => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const home = (page: Page) => page.locator('.site-home').evaluate(element => ({
  ...element.getBoundingClientRect().toJSON(), visibility: getComputedStyle(element).visibility,
  count: document.querySelectorAll('a.site-home').length,
}));

async function grip(page: Page, direction: 'next' | 'previous') {
  const control = page.locator(`[data-page-direction="${direction}"]`);
  await page.mouse.move(0, 0);
  await control.hover();
  await expect(page.locator('[data-cover-ready="true"]')).toBeAttached();
  const box = (await control.boundingBox())!;
  const width = (await page.locator('.album-stage').boundingBox())!.width / 2;
  const x = direction === 'next' ? box.x + box.width - 10 : box.x + 10;
  const y = box.y + box.height - 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y, width, sign: direction === 'next' ? -1 : 1 };
}

test('closed cover folds keep their mirrored crease anchored, with usable focus and a painted renderer handoff', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical corner evidence uses a desktop pointer.');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const [route, side, direction] of [['/', 'right', 'next'], ['/contraportada/', 'left', 'previous']] as const) {
      await page.goto(route);
      const control = page.locator(`[data-page-direction="${direction}"]`);
      const fold = control.locator('.cover-fold');
      const measure = () => fold.evaluate(element => {
        const control = element.closest('a')!;
        const crease = element.querySelector<SVGPathElement>('.cover-fold-crease')!;
        const matrix = crease.getScreenCTM()!;
        return {
          fold: element.getBoundingClientRect().toJSON(), hit: control.getBoundingClientRect().toJSON(),
          book: element.closest('[data-album-object]')!.getBoundingClientRect().toJSON(),
          anchors: [0, crease.getTotalLength()].map(length => {
            const point = crease.getPointAtLength(length);
            return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
          }),
          overflow: document.documentElement.scrollWidth - innerWidth,
          legacy: getComputedStyle(control, '::before').content,
        };
      });
      const rest = await measure();
      expect(rest.hit.width).toBeGreaterThanOrEqual(44);
      expect(rest.hit.height).toBeGreaterThanOrEqual(44);
      expect(rest.fold.width).toBeGreaterThanOrEqual(40);
      expect(rest.fold.width).toBeLessThanOrEqual(52);
      expect(rest.fold.bottom).toBeCloseTo(rest.book.bottom, 0);
      expect(side === 'right' ? rest.fold.right : rest.fold.left).toBeCloseTo(side === 'right' ? rest.book.right : rest.book.left, 0);
      expect(rest.overflow).toBeLessThanOrEqual(1);
      expect(rest.legacy).toBe('none');
      for (const state of ['rest', 'hover', 'focus']) {
        if (state === 'hover') await control.hover();
        if (state === 'focus') { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await control.focus(); }
        await control.evaluate(async element => { await Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished)); });
        expect((await measure()).anchors).toEqual(rest.anchors);
        if (state === 'focus') {
          await expect(control).toHaveCSS('outline-style', 'solid');
          await expect(control).toHaveCSS('clip-path', 'none');
        }
        const screenshot = testInfo.outputPath(`${viewport.width}-${side}-${state}.png`);
        await page.screenshot({ path: screenshot });
        await testInfo.attach(`${viewport.width}-${side}-${state}`, { path: screenshot, contentType: 'image/png' });
      }
      const drag = await grip(page, direction);
      await page.mouse.move(drag.x + drag.sign * 12, drag.y - 8, { steps: 2 });
      await expect(page.locator('[data-cover-active="true"]')).toBeAttached();
      await paint(page);
      await expect(fold).not.toBeVisible(); // source and painted renderer never stack
      const host = page.locator('[data-cover-active="true"]');
      await expect(host.locator('.cover-fold')).not.toBeVisible();
      expect(await host.locator('.stf__item').evaluateAll(elements => elements.some(el => {
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.clipPath !== 'none' && style.transform !== 'none';
      }))).toBe(true);
      const screenshot = testInfo.outputPath(`${viewport.width}-${side}-first-curl.png`);
      await page.screenshot({ path: screenshot });
      await testInfo.attach(`${viewport.width}-${side}-first-curl`, { path: screenshot, contentType: 'image/png' });
      await page.mouse.move(drag.x + drag.sign * drag.width * 0.2, drag.y - 40, { steps: 8 });
      await page.mouse.up();
      await expect(host).toHaveCount(0);
      await page.mouse.move(0, 0);
      await expect(fold).toBeVisible();
      expect((await measure()).anchors).toEqual(rest.anchors);
      await expect(page).toHaveURL(route);
    }
  }
});

test('the single Marian link follows measured cover geometry through drag, cancel, commit and document handoff', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical scene samples use a desktop pointer.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const frames: unknown[] = [];
    const movement: unknown[] = [];
    let pointer = 0;
    document.addEventListener('pointerdown', event => { pointer = event.pointerId; });
    const sample = () => {
      const element = document.querySelector('.site-home');
      if (!element) return null;
      const folds = [...document.querySelectorAll<SVGElement>('.cover-fold')].filter(fold =>
        getComputedStyle(fold).visibility === 'visible' && fold.getBoundingClientRect().width > 0,
      ).map(fold => ({ box: fold.getBoundingClientRect().toJSON(), side: fold.dataset.foldSide,
        curve: getComputedStyle(fold.querySelector('.cover-fold-return')!).d }));
      return { ...element.getBoundingClientRect().toJSON(), visibility: getComputedStyle(element).visibility,
        count: document.querySelectorAll('a.site-home').length,
        folds,
        progress: document.querySelector<HTMLElement>('[data-cover-active]')?.dataset.coverSpatialProgress };
    };
    const record = () => {
      const value = sample();
      if (value) {
        if (frames.length < 40) frames.push(value);
        if (document.querySelector('[data-cover-home-motion]')) movement.push(value);
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
    Object.assign(window, { coverHomeEvidence: { frames, movement, cancel: () => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: pointer })) } });
    window.addEventListener('pageswap', () => sessionStorage.setItem('cover-home-last', JSON.stringify(sample())));
  });
  const destination = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const evidence = [];
  for (const [from, to, direction] of transitions) {
    await page.goto(from);
    await destination.goto(to);
    const start = await home(page);
    const end = await home(destination);
    const drag = await grip(page, direction);
    const positions: number[] = [];
    for (const progress of [0.25, 0.5, 0.75]) {
      await page.mouse.move(drag.x + drag.sign * drag.width * progress, drag.y - 50, { steps: 10 });
      await expect(page.locator('[data-cover-active="true"]')).toBeAttached();
      await paint(page);
      const actual = await home(page);
      expect(actual.count).toBe(1);
      expect(actual.visibility).toBe('visible');
      expect(Math.abs(actual.x - (start.x + (end.x - start.x) * progress))).toBeLessThan(1);
      expect(Math.abs(actual.y - (start.y + (end.y - start.y) * progress))).toBeLessThan(1);
      positions.push(actual.x);
    }
    expect(positions.every((x, i) => i === 0 || (x - positions[i - 1]!) * (end.x - start.x) >= 0)).toBe(true);
    await page.evaluate(() => (window as any).coverHomeEvidence.cancel());
    await expect(page.locator('[data-cover-active="true"]')).toHaveCount(0);
    await page.mouse.up();
    expect(await home(page)).toEqual(start);
    await expect(page.locator('[data-cover-home-motion]')).toHaveCount(0);
    const movement = await page.evaluate(() => (window as any).coverHomeEvidence.movement);
    // Every animation sample, including reverse settle, uses the same scene progress.
    for (const sample of movement) {
      expect(sample.count).toBe(1);
      expect(sample.visibility).toBe('visible');
      expect(Math.abs(sample.x - (start.x + (end.x - start.x) * Number(sample.progress)))).toBeLessThan(1);
    }
    const commit = await grip(page, direction);
    await page.mouse.move(commit.x + commit.sign * commit.width * 0.75, commit.y - 50, { steps: 12 });
    await expect(page.locator('[data-cover-active="true"]')).toBeAttached();
    await page.mouse.up();
    await expect(page).toHaveURL(to);
    await expect.poll(() => page.evaluate(() => (window as any).coverHomeEvidence.frames.length)).toBeGreaterThanOrEqual(10);
    const handoff = await page.evaluate(() => ({ last: JSON.parse(sessionStorage.getItem('cover-home-last')!), frames: (window as any).coverHomeEvidence.frames }));
    for (const frame of [handoff.last, ...handoff.frames]) {
      expect(frame.count).toBe(1);
      expect(frame.visibility).toBe('visible');
      expect(Math.abs(frame.x - end.x)).toBeLessThan(1);
      expect(Math.abs(frame.y - end.y)).toBeLessThan(1);
      expect(frame.folds.length).toBe(to === '/' || to === '/contraportada/' ? 1 : 0);
      if (frame.folds.length) {
        const finalFold = handoff.frames[0].folds[0];
        expect(frame.folds[0].side).toBe(finalFold.side);
        expect(frame.folds[0].curve).toBe(finalFold.curve);
        for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(frame.folds[0].box[key] - finalFold.box[key])).toBeLessThan(1);
      }
    }
    await expect(page.locator('.site-home')).toHaveAttribute('href', '/');
    await expect(page.locator('.site-home')).toHaveAccessibleName('Marian, inicio');
    evidence.push({ from, to, start, end, positions, movement, handoff });
  }
  await destination.close();
  await testInfo.attach('marian-cover-continuity.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

test('reduced motion and no-JS retain natural cover folds and native route destinations', async ({ browser }) => {
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    for (const [from, to, direction] of transitions) {
      await page.goto(from);
      if (from === '/' || from === '/contraportada/') await expect(page.locator('.cover-fold')).toBeVisible();
      await page.locator(`[data-page-direction="${direction}"]`).click();
      await expect(page).toHaveURL(to);
      await expect(page.locator('[data-cover-active]')).toHaveCount(0);
      await expect(page.locator('[data-cover-home-motion]')).toHaveCount(0);
      const geometry = await home(page);
      expect(geometry.count).toBe(1);
      expect(geometry.visibility).toBe('visible');
      const object = (await page.locator('[data-album-object]').boundingBox())!;
      expect(Math.abs(geometry.x - object.x)).toBeLessThan(1);
    }
    await context.close();
  }
});

test('the initial DEV canvas is flat grey while paper and PhotoViewer retain their material', async ({ page }) => {
  await page.addInitScript(() => {
    const record = () => {
      if (!document.body) { requestAnimationFrame(record); return; }
      Object.assign(window, { initialCanvas: {
        html: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
      } });
    };
    requestAnimationFrame(record);
  });
  await page.goto('/');
  // Vite can reload after its first dependency scan. Each document retains its
  // first painted colors; retry the read across that development-only reload.
  await expect(async () => {
    expect(await page.evaluate(() => (window as any).initialCanvas)).toEqual({ html: 'rgb(216, 217, 216)', body: 'rgb(216, 217, 216)' });
  }).toPass();
  for (const selector of ['html', 'body']) {
    await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(216, 217, 216)');
    await expect(page.locator(selector)).toHaveCSS('background-image', 'none');
  }
  expect(await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ['--paper', '--paper-raised'].map(name => style.getPropertyValue(name).trim());
  })).toEqual(['#f3efe6', '#fffdf8']);
  await expect(page.locator('[data-album-cover]')).toHaveCSS('background-color', 'rgb(255, 253, 248)');
  await page.goto('/portfolio/categoria-de-prueba/?foto=foto-prueba-dos');
  const viewer = page.getByRole('dialog');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveCSS('background-color', 'rgb(21, 20, 19)');
  expect(await viewer.evaluate(element => getComputedStyle(element, '::backdrop').backgroundColor)).toBe('rgba(0, 0, 0, 0.88)');
});
