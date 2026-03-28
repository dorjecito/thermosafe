import { test, expect } from '@playwright/test';

const cities = [
  'Palma',
  'Barcelona',
  'Madrid',
  'Lima',
  'Reykjavik',
  'Dubai',
  'Tokyo',
  'Sydney',
];

test('test múltiples ciutats', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('https://thermosafe.app');

  const input = page.locator('input').first();

  for (const city of cities) {
    await input.fill(city);

    await page.getByRole('button', { name: new RegExp(`${city}.*`, 'i') }).first().click();

    await page.waitForTimeout(2500);

    // ✅ validar que la ciutat apareix en algun lloc visible
    await expect(page.locator('body')).toContainText(new RegExp(city, 'i'));

    // ✅ validar que la UI segueix carregant dades
    await expect(page.locator('body')).toContainText(/temperatura|temperature|uv|vent|wind/i);
  }
});