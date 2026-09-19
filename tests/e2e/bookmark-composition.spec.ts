import { expect, test } from '@playwright/test';

test('wide ribbon keeps every glyph and its hit area inside the viewport in every state', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 1600, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const route of ['/', '/portfolio/', '/contraportada/']) {
      await page.goto(route);
      const bookmark = page.locator('[data-bookmark-index]');
      const summary = bookmark.locator('summary');
      await expect(summary).toHaveAccessibleName('Índice');
      for (const state of ['rest', 'hover', 'focus', 'open']) {
        if (state === 'hover') await summary.hover();
        if (state === 'focus') await summary.focus();
        if (state === 'open') await summary.click();
        // Wait for the intentional extraction transition, never for an initial correction.
        if (state !== 'rest') await page.waitForTimeout(200);
        const geometry = await bookmark.evaluate(element => {
          const summary = element.querySelector('summary')!;
          const ribbon = element.querySelector('.bookmark-ribbon')!;
          const label = element.querySelector('.bookmark-ribbon-label')!;
          const paper = element.closest('[data-album-object]')!;
          const labelBox = label.getBoundingClientRect();
          const paperBox = paper.getBoundingClientRect();
          const ribbonBox = ribbon.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(label);
          const glyphs = range.getBoundingClientRect();
          const style = getComputedStyle(label);
          const left = (element as HTMLElement).dataset.bookmarkSide === 'left';
          const panel = element.querySelector('nav')!;
          return {
            hit: summary.getBoundingClientRect().toJSON(), ribbon: ribbonBox.toJSON(), label: labelBox.toJSON(), glyphs: glyphs.toJSON(),
            font: parseFloat(style.fontSize), textTransform: style.textTransform,
            overflow: document.documentElement.scrollWidth - innerWidth,
            exposed: left ? paperBox.left - ribbonBox.left : ribbonBox.right - paperBox.right,
            labelOutside: left ? labelBox.right <= paperBox.left : labelBox.left >= paperBox.right,
            panel: element.hasAttribute('open') ? panel.getBoundingClientRect().toJSON() : null,
          };
        });
        const description = `${viewport.width} ${route} ${state}`;
        expect(geometry.hit.width, description).toBeGreaterThanOrEqual(68);
        expect(geometry.ribbon.width, description).toBeGreaterThanOrEqual(64);
        expect(geometry.ribbon.height, description).toBeGreaterThanOrEqual(160);
        expect(geometry.label.width, description).toBeGreaterThanOrEqual(28);
        expect(geometry.font, description).toBeGreaterThanOrEqual(16);
        expect(geometry.textTransform, description).toBe('uppercase');
        expect(geometry.exposed, description).toBeGreaterThanOrEqual(44);
        expect(geometry.labelOutside, description).toBe(true);
        expect(geometry.glyphs.left, description).toBeGreaterThanOrEqual(geometry.label.left - 1);
        expect(geometry.glyphs.right, description).toBeLessThanOrEqual(geometry.label.right + 1);
        expect(geometry.glyphs.top, description).toBeGreaterThanOrEqual(geometry.label.top);
        // The text ends above the V-shaped tip, not inside the clipped triangle.
        expect(geometry.glyphs.bottom, description).toBeLessThan(geometry.ribbon.top + geometry.ribbon.height * 0.88);
        expect(Math.abs((geometry.glyphs.left + geometry.glyphs.right) / 2 - (geometry.label.left + geometry.label.right) / 2), description).toBeLessThan(2);
        expect(geometry.overflow, description).toBeLessThanOrEqual(1);
        for (const box of [geometry.hit, geometry.panel].filter(Boolean)) {
          expect(box!.left, description).toBeGreaterThanOrEqual(4);
          expect(box!.right, description).toBeLessThanOrEqual(viewport.width - 4);
          expect(box!.top, description).toBeGreaterThanOrEqual(0);
          expect(box!.bottom, description).toBeLessThanOrEqual(viewport.height);
        }
      }
      if (viewport.width === 1440 && testInfo.project.name === 'chromium') {
        await page.screenshot({ path: testInfo.outputPath(`ribbon-${route.replaceAll('/', '') || 'front'}.png`) });
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portfolio/');
  const mobileSummary = page.locator('[data-bookmark-index] summary');
  const mobileLabel = mobileSummary.locator('.bookmark-ribbon-label');
  await expect(mobileSummary).toHaveAccessibleName('Índice');
  await expect(mobileLabel).toHaveText('Índice');
  await expect(mobileLabel).toHaveCSS('text-transform', 'none');
});

test('real paper occludes the inserted ribbon without a rigid white plate during forward and backward curls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical curl probe uses a desktop pointer.');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const direction of ['next', 'previous']) {
    await page.goto('/portfolio/');
    const control = page.locator(`[data-page-direction="${direction}"]`);
    await control.hover();
    await expect(page.locator('[data-curl-ready="true"]')).toBeAttached();
    const box = (await control.boundingBox())!;
    const startX = direction === 'next' ? box.x + box.width - 10 : box.x + 10;
    const y = box.y + box.height - 10;
    const width = (await page.locator('.album-stage').boundingBox())!.width / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    for (const progress of [0.25, 0.55]) {
      await page.mouse.move(startX + (direction === 'next' ? -1 : 1) * width * progress, y - 100, { steps: 10 });
      await expect(page.locator('[data-curl-active="true"]')).toBeAttached();
      const probe = await page.locator('[data-bookmark-index]').evaluate(element => {
        const summary = element.querySelector('summary')!;
        const ribbon = element.querySelector('.bookmark-ribbon')!;
        const object = element.closest('[data-album-object]')!.getBoundingClientRect();
        const r = ribbon.getBoundingClientRect();
        const outer = document.elementFromPoint(object.right + 10, r.top + 30);
        const inner = document.elementFromPoint(object.right - 5, r.top + 30);
        return { before: getComputedStyle(element, '::before').content, after: getComputedStyle(element, '::after').content,
          outerIsRibbon: outer === summary || (outer !== null && summary.contains(outer)),
          innerIsRibbon: inner === summary || (inner !== null && summary.contains(inner)),
          stackingContext: getComputedStyle(element).zIndex };
      });
      expect(probe).toEqual({ before: 'none', after: 'none', outerIsRibbon: true, innerIsRibbon: false, stackingContext: 'auto' });
      const screenshot = testInfo.outputPath(`ribbon-curl-${direction}-${progress}.png`);
      await page.screenshot({ path: screenshot });
      await testInfo.attach(`${direction}-${progress}`, { path: screenshot, contentType: 'image/png' });
    }
    await page.mouse.move(startX, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-curl-active="true"]')).toHaveCount(0);
  }
});

test('cover turns keep the ribbon inserted in real paper, including both sides of the back hinge', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical paper cross-sections use desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  const evidence = [];
  for (const [route, direction] of [['/', 'next'], ['/sobre-mi/', 'previous'], ['/contacto/', 'next'], ['/contraportada/', 'previous']] as const) {
    await page.goto(route);
    const control = page.locator(`[data-page-direction="${direction}"]`);
    await control.hover();
    await expect(page.locator('[data-cover-ready="true"]')).toBeAttached();
    const box = (await control.boundingBox())!;
    const width = (await page.locator('.album-stage').boundingBox())!.width / 2;
    const x = direction === 'next' ? box.x + box.width - 10 : box.x + 10;
    const y = box.y + box.height - 10;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (const progress of [0.1, 0.24, 0.26, 0.45, 0.55, 0.74, 0.76, 0.9]) {
      await page.mouse.move(x + (direction === 'next' ? -1 : 1) * width * progress, y - 70, { steps: 6 });
      await expect(page.locator('[data-cover-active="true"]')).toBeAttached();
      // Allow the renderer to paint the polygon supplied by the pointer update.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const probe = await page.evaluate(() => {
        const host = document.querySelector<HTMLElement>('[data-cover-active="true"]')!;
        const marker = document.querySelector<HTMLElement>('[data-bookmark-index]')!;
        const box = marker.querySelector('.bookmark-ribbon')!.getBoundingClientRect();
        const left = marker.dataset.bookmarkSide === 'left';
        // Enable only hit testing temporarily; the renderer normally is inert.
        const inert = [host, ...host.querySelectorAll('[inert]')];
        inert.forEach(element => element.removeAttribute('inert'));
        host.style.pointerEvents = 'auto';
        const paperAt = (x: number, y: number) => document.elementsFromPoint(x, y).some(element => {
          const surface = element.closest<HTMLElement>('[data-cover-page-wrapper]');
          return surface && host.contains(surface) && !surface.classList.contains('album-cover-blank-page');
        });
        const inserted = [0.1, 0.45, 0.8].map(fraction => paperAt(left ? box.right - 6 : box.left + 6, box.top + box.height * fraction));
        const covered = [box.left + 4, box.right - 4].every(x => paperAt(x, box.top + box.height * 0.45));
        host.style.removeProperty('pointer-events');
        inert.forEach(element => element.setAttribute('inert', ''));
        return { side: marker.dataset.bookmarkSide, inserted, covered };
      });
      expect(probe.inserted, `${route} ${progress}`).toEqual([true, true, true]);
      if ((route === '/contraportada/' && (progress === 0.24 || progress === 0.26)) ||
          (route === '/contacto/' && (progress === 0.74 || progress === 0.76))) {
        expect(probe.covered, `side changes under real paper: ${route} ${progress}`).toBe(true);
      }
      evidence.push({ route, progress, ...probe });
    }
    await page.mouse.move(x, y, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('[data-cover-active="true"]')).toHaveCount(0);
    await expect(page.locator('[data-bookmark-turning]')).toHaveCount(0);
  }
  await testInfo.attach('ribbon-paper-cross-sections.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

test('open-back only exposes the right-facing ribbon while real paper covers its insertion edge', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical open-back probe uses desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/contraportada/');
  const control = page.locator('[data-page-direction="previous"]');
  await control.hover();
  await expect(page.locator('[data-cover-ready="true"]')).toBeAttached();
  const box = (await control.boundingBox())!;
  const width = (await page.locator('.album-stage').boundingBox())!.width / 2;
  const x = box.x + 10;
  const y = box.y + box.height - 10;
  const evidence = [];

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const progress of [0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 0.97]) {
    await page.mouse.move(x + width * progress, y - 70, { steps: 8 });
    await expect(page.locator('[data-cover-active="true"]')).toBeAttached();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const probe = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('[data-cover-active="true"]')!;
      const marker = document.querySelector<HTMLElement>('[data-bookmark-index]')!;
      const ribbon = marker.querySelector<HTMLElement>('.bookmark-ribbon')!;
      const ribbonBox = ribbon.getBoundingClientRect();
      const left = marker.dataset.bookmarkSide === 'left';
      const inert = [host, ...host.querySelectorAll<HTMLElement>('[inert]')];
      const blanks = [...host.querySelectorAll<HTMLElement>('.album-cover-blank-page')];
      const previousBlankPointerEvents = blanks.map(element => element.style.pointerEvents);

      inert.forEach(element => element.removeAttribute('inert'));
      host.style.pointerEvents = 'auto';
      blanks.forEach(element => { element.style.pointerEvents = 'none'; });

      const topPaperAt = (sampleX: number, sampleY: number) => {
        const top = document.elementFromPoint(sampleX, sampleY);
        const surface = top?.closest<HTMLElement>('[data-cover-page-wrapper]');
        return Boolean(surface && host.contains(surface) && !surface.classList.contains('album-cover-blank-page'));
      };
      const insertionX = left ? ribbonBox.right - 6 : ribbonBox.left + 6;
      const insertionCovered = [0.1, 0.45, 0.8].map(
        fraction => topPaperAt(insertionX, ribbonBox.top + ribbonBox.height * fraction),
      );

      host.style.removeProperty('pointer-events');
      blanks.forEach((element, index) => {
        const value = previousBlankPointerEvents[index];
        if (value) element.style.pointerEvents = value;
        else element.style.removeProperty('pointer-events');
      });
      inert.forEach(element => element.setAttribute('inert', ''));

      return {
        side: marker.dataset.bookmarkSide,
        insertionCovered,
        ribbon: ribbonBox.toJSON(),
      };
    });

    if (probe.side === 'right') {
      expect(probe.insertionCovered, `open-back ${progress}`).toEqual([true, true, true]);
    }
    evidence.push({ progress, ...probe });
  }

  expect(evidence.some(sample => sample.side === 'right')).toBe(true);
  await testInfo.attach('open-back-ribbon-support.json', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  });

  // A cancelled reopening must return the ribbon to the closed back-cover edge.
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('[data-cover-active="true"]')).toHaveCount(0);
  await expect(page).toHaveURL('/contraportada/');
  await expect(page.locator('[data-bookmark-index]')).toHaveAttribute('data-bookmark-side', 'left');
  await expect(page.locator('[data-bookmark-turning]')).toHaveCount(0);
});

test('bookmark last turn frame matches first and later destination frames across all six transitions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Physical frame handoff uses desktop mode.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const frames: { x: number; y: number; width: number; height: number; side: string | undefined; visibility: string }[] = [];
    const sample = () => {
      const element = document.querySelector<HTMLElement>('[data-bookmark-index]');
      const box = element?.querySelector('summary')?.getBoundingClientRect();
      if (!element || !box || box.height === 0) return null;
      return { x: box.x, y: box.y, width: box.width, height: box.height, side: element.dataset.bookmarkSide, visibility: getComputedStyle(element).visibility };
    };
    const record = () => {
      const frame = sample();
      if (frame) frames.push(frame);
      if (frames.length < 40) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
    Object.assign(window, { bookmarkFrames: frames });
    window.addEventListener('pageswap', () => {
      sessionStorage.setItem('bookmark-last-frame', JSON.stringify({ frame: sample(), committed: document.documentElement.dataset.albumTurnNavigation }));
    });
  });
  const evidence = [];
  for (const [from, to, direction] of [
    ['/', '/sobre-mi/', 'next'], ['/sobre-mi/', '/', 'previous'],
    ['/portfolio/', '/portfolio/categoria-de-prueba/', 'next'], ['/portfolio/categoria-de-prueba/', '/portfolio/', 'previous'],
    ['/contacto/', '/contraportada/', 'next'], ['/contraportada/', '/contacto/', 'previous'],
  ] as const) {
    await page.goto(from);
    await expect(page.locator('html')).toHaveAttribute('data-page-navigation-ready', 'true');
    const control = page.locator(`[data-page-direction="${direction}"]`);
    await control.hover();
    await expect(page.locator('[data-curl-ready="true"], [data-cover-ready="true"]')).toBeAttached();
    const box = (await control.boundingBox())!;
    const width = (await page.locator('.album-stage').boundingBox())!.width / 2;
    const x = direction === 'next' ? box.x + box.width - 10 : box.x + 10;
    const y = box.y + box.height - 10;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + (direction === 'next' ? -1 : 1) * width * 0.55, y - 55, { steps: 10 });
    const screenshot = testInfo.outputPath(`handoff-${from.replaceAll('/', '') || 'front'}-${direction}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`${from} ${direction}`, { path: screenshot, contentType: 'image/png' });
    await page.mouse.up();
    await expect(page).toHaveURL(to);
    await expect.poll(() => page.evaluate(() => (window as unknown as { bookmarkFrames: unknown[] }).bookmarkFrames.length)).toBeGreaterThanOrEqual(10);
    const data = await page.evaluate(() => ({
      last: JSON.parse(sessionStorage.getItem('bookmark-last-frame')!),
      frames: (window as unknown as { bookmarkFrames: { x: number; y: number; width: number; height: number; side: string; visibility: string }[] }).bookmarkFrames,
    }));
    expect(data.last.committed, from).toBe('committed');
    expect(data.last.frame.visibility, from).toBe('visible');
    for (const frame of data.frames) {
      expect(frame.side, `${from} → ${to}`).toBe(data.last.frame.side);
      expect(frame.visibility).toBe('visible');
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(frame[key] - data.last.frame[key]), `${from} → ${to}: ${key}`).toBeLessThan(1);
    }
    evidence.push({ from, to, ...data });
  }
  await testInfo.attach('bookmark-frame-continuity.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

test('index composition measures header and whole groups for short, medium, full and oversized maps', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const size of ['short', 'medium', 'full', 'overflow']) {
    await page.goto(`/test-fixtures/album-index/${size}/`);
    const index = page.locator('[data-album-map-view="index"]');
    const hrefs = (selector: string) => page.locator(selector).evaluateAll(links => links.map(link => link.getAttribute('href')));
    const expected = await hrefs('[data-album-map-view="bookmark"] [data-bookmark-kind="category"] [data-album-map-link]');
    expect(await hrefs('[data-album-map-view="index"] [data-album-map-link]')).toEqual(expected);
    await expect(index.locator('[aria-current="page"]')).toHaveCount(0);
    await expect(index).toHaveAttribute('data-index-layout', size === 'overflow' ? 'flow' : 'spread');
    const layout = await index.evaluate(root => [...root.querySelectorAll(':scope > .album-page')].filter(el => getComputedStyle(el).display !== 'none').map(page => {
      const box = page.getBoundingClientRect(); const style = getComputedStyle(page);
      const groups = [...page.querySelectorAll('[data-index-group]')].map(group => ({
        box: group.getBoundingClientRect().toJSON(),
        items: [...group.querySelectorAll('a')].map(a => a.getBoundingClientRect().toJSON()),
      }));
      return { box: box.toJSON(), padding: parseFloat(style.paddingBottom), top: parseFloat(style.paddingTop), groups, justify: style.justifyContent, overflow: style.overflow };
    }));
    for (const side of layout) {
      expect(side.overflow).not.toBe('hidden');
      for (const group of side.groups) {
        expect(group.box.bottom, size).toBeLessThanOrEqual(side.box.bottom - side.padding + 1);
        for (const row of group.items) {
          expect(row.top, size).toBeGreaterThanOrEqual(group.box.top);
          expect(row.bottom, size).toBeLessThanOrEqual(group.box.bottom + 1);
        }
      }
    }
    if (layout[1]?.groups.length) {
      expect(layout[1].justify).toBe('flex-start');
      expect(layout[0]?.groups.length).toBeGreaterThan(0);
      expect(Math.abs(layout[1].groups[0]!.box.top - layout[0]!.groups[0]!.box.top)).toBeLessThan(2);
    }
    for (const slug of await index.locator('[data-album-map-category]').evaluateAll(items => [...new Set(items.map(item => item.getAttribute('data-album-map-category')))])) {
      expect(await index.locator(`[data-album-map-category="${slug}"]`).evaluateAll(items => new Set(items.map(item => item.closest('[data-index-group]'))).size)).toBe(1);
    }
    if (size === 'medium' || size === 'full') await expect(index.getByText('Pliego 3', { exact: true })).toHaveCount(1);
    if (testInfo.project.name === 'chromium') await page.screenshot({ path: testInfo.outputPath(`index-${size}.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(index).toHaveAttribute('data-index-layout', 'flow');
    await expect(index.locator('.album-page-right [data-index-group]')).toHaveCount(0);
    expect(await hrefs('[data-album-map-view="index"] [data-album-map-link]')).toEqual(expected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});

test('index and widened ribbon remain readable without JS', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  await page.goto('/portfolio/');
  await expect(page.locator('[data-album-map-view="index"] [data-album-map-link]')).toHaveCount(4);
  const index = page.locator('[data-album-map-view="index"]');
  expect(await index.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await page.goto('/contraportada/');
  const label = page.locator('.bookmark-ribbon-label');
  await expect(label).toHaveCSS('font-size', '16px');
  const box = (await label.boundingBox())!;
  expect(box.x).toBeGreaterThan(8);
  await page.locator('[data-bookmark-index] summary').click();
  await page.getByRole('navigation', { name: 'Índice global del álbum' }).getByRole('link', { name: 'Atrapando instantes' }).click();
  await expect(page).toHaveURL('/portfolio/');
  await context.close();
});

test('the index preview uses the same measured group distribution as its real route', async ({ browser }) => {
  const current = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const destination = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await current.goto('/sobre-mi/');
  await current.locator('[data-page-direction="next"]').hover();
  await expect(current.locator('[data-curl-ready="true"]')).toBeAttached();
  await destination.goto('/portfolio/');
  const measure = (surface: import('@playwright/test').Locator) => surface.evaluate(element => {
    return [...element.querySelectorAll<HTMLElement>('[data-index-group]')].map(group => ({
      hrefs: [...group.querySelectorAll('a')].map(a => a.getAttribute('href')),
      top: group.offsetTop,
      height: group.offsetHeight,
    }));
  });
  // Activate the real turn so both destination faces have layout; local offsets
  // compare editorial composition independently of the current curl transform.
  const box = (await current.locator('[data-page-direction="next"]').boundingBox())!;
  await current.mouse.move(box.x + box.width - 10, box.y + box.height - 10);
  await current.mouse.down();
  await current.mouse.move(box.x - 130, box.y - 30, { steps: 8 });
  await expect(current.locator('[data-curl-active="true"]')).toBeAttached();
  for (const side of ['left', 'right']) {
    expect(await measure(current.locator(`[data-curl-page="destination-${side}"]`))).toEqual(
      await measure(destination.locator(`[data-album-spread] > .album-page-${side}`)),
    );
  }
  await current.close();
  await destination.close();
});
