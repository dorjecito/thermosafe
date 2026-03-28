import { test, expect } from '@playwright/test';

test('ubicació actual Mallorca', async ({ context, page }) => {
  await context.grantPermissions(['geolocation']);

  await context.setGeolocation({
    latitude: 39.5696,
    longitude: 2.6502,
  });

  await page.goto('https://thermosafe.app');

  await page.waitForTimeout(2000);

  await expect(page.locator('body')).toBeVisible();
});