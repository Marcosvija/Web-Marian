import { expect, test } from '@playwright/test';

const category = '/portfolio/categoria-extensa-de-prueba/';
const photoUrl = (number: number) => `${category}${number > 10 ? '2/' : ''}?foto=foto-extensa-${number}`;
const viewer = (page: import('@playwright/test').Page) => page.locator('[data-photo-viewer]');

async function expectPhoto(page: import('@playwright/test').Page, number: number) {
  await expect(page).toHaveURL(photoUrl(number));
  await expect(viewer(page)).toBeVisible();
  await expect(viewer(page).locator('[data-viewer-status]')).toHaveText(`Fotografía ${number} de 18`);
  await expect(viewer(page).locator('img')).toHaveAttribute('alt', `Patrón de paginación ${number}`);
}

test('category viewer crosses real spreads with global position, history and destination focus', async ({ page }) => {
  await page.goto(photoUrl(9));
  await expectPhoto(page, 9);
  const initialHistory = await page.evaluate(() => history.length);
  await page.evaluate(() => { document.documentElement.dataset.originalDocument = 'true'; });
  await viewer(page).getByRole('button', { name: 'Fotografía siguiente' }).click();
  await expectPhoto(page, 10);
  await expect(page.locator('html')).toHaveAttribute('data-original-document', 'true');
  expect(await page.evaluate(() => history.length)).toBe(initialHistory);

  await page.keyboard.press('ArrowRight');
  await expectPhoto(page, 11);
  await expect(page.locator('html')).not.toHaveAttribute('data-original-document');
  expect(await page.evaluate(() => history.length)).toBe(initialHistory + 1);
  await expect(viewer(page).getByRole('button', { name: 'Cerrar visor' })).toBeFocused();

  await page.goBack();
  await expectPhoto(page, 10);
  await page.goForward();
  await expectPhoto(page, 11);
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toBeHidden();
  await expect(page).toHaveURL(`${category}2/`);
  await expect(page.locator('[data-photo-id="foto-extensa-11"]')).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(initialHistory + 1);
  await page.goBack();
  await expectPhoto(page, 10);
  await page.goForward();
  await expect(viewer(page)).toBeHidden();
  await expect(page).toHaveURL(`${category}2/`);
  await page.goBack();
  await expectPhoto(page, 10);
  await page.keyboard.press('ArrowRight');
  await expectPhoto(page, 11);
});

test('category viewer goes backwards across spreads and wraps only within the category', async ({ page }) => {
  await page.goto(photoUrl(11));
  await expectPhoto(page, 11);
  await viewer(page).getByRole('button', { name: 'Fotografía anterior' }).click();
  await expectPhoto(page, 10);
  await viewer(page).getByRole('button', { name: 'Cerrar visor' }).click();
  await expect(page.locator('[data-photo-id="foto-extensa-10"]')).toBeFocused();
  await page.goto(photoUrl(1));
  await page.keyboard.press('ArrowLeft');
  await expectPhoto(page, 18);
  await viewer(page).getByRole('button', { name: 'Fotografía siguiente' }).click();
  await expectPhoto(page, 1);
});

test('category viewer swipe crosses both directions between spreads', async ({ page }) => {
  await page.goto(photoUrl(10));
  const cdp = await page.context().newCDPSession(page);
  for (const [direction, destination] of [[-1, 11], [1, 10]]) {
    const box = (await viewer(page).locator('img').boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + direction! * 90, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expectPhoto(page, destination!);
  }
});

test('category metadata contains only locations and native modified photo links still open destinations', async ({ page, context }) => {
  await page.goto(`${category}2/`);
  const locations = JSON.parse((await viewer(page).getAttribute('data-photo-locations'))!);
  expect(locations).toHaveLength(18);
  for (const photo of locations) expect(Object.keys(photo).sort()).toEqual(['id', 'path', 'position']);
  await expect(page.locator('[data-photo-trigger]')).toHaveCount(8);
  await expect(page.locator('img[alt="Patrón de paginación 1"]')).toHaveCount(0);
  const popupPromise = context.waitForEvent('page');
  await page.locator('[data-photo-id="foto-extensa-11"]').click({ modifiers: ['ControlOrMeta'] });
  const popup = await popupPromise;
  await expectPhoto(popup, 11);
  await expect(viewer(page)).toBeHidden();
  await expect(page).toHaveURL(`${category}2/`);
  await popup.close();
});

test('category photo fallback remains a real link with an in-document target without JS', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${category}2/`);
  await page.locator('[data-photo-id="foto-extensa-11"]').click();
  await expect(page).toHaveURL(`${photoUrl(11)}#foto-foto-extensa-11`);
  await expect(page.locator('#foto-foto-extensa-11')).toBeVisible();
  await expect(viewer(page)).toBeHidden();
  await context.close();
});
