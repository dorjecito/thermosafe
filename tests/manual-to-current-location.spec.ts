import { test, expect } from '@playwright/test';

test('de cerca manual a ubicació actual', async ({ context, page }) => {
  test.setTimeout(60_000);

  // Simula Mallorca
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: 39.5696,
    longitude: 2.6502,
  });

  await page.goto('https://thermosafe.app');

  const input = page.locator('input').first();

  // 1) Cerca manual: Lima
  await input.fill('Lima');
  await page.getByRole('button', { name: /Lima.*/i }).first().click();

  await page.waitForTimeout(2500);

  // 2) Comprova que Lima apareix a la UI
  await expect(page.locator('body')).toContainText(/Lima/i);

  // 3) Torna a ubicació actual
  const currentLocationButton = page.getByRole('button', {
    name: /ubicació actual|ubicacion actual|current location|usar ubicació actual|usar ubicación actual/i,
  });

  await expect(currentLocationButton).toBeVisible();
  await currentLocationButton.click();

  await page.waitForTimeout(3500);

  // 4) La UI ha de seguir mostrant dades útils
  await expect(page.locator('body')).toContainText(
    /temperatura|temperature|humitat|humidity|vent|wind|uv/i
  );

  // 5) Lima no hauria de continuar dominant la pantalla
  const bodyText = await page.locator('body').innerText();
  const limaCount = (bodyText.match(/Lima/gi) || []).length;

  expect(limaCount).toBeLessThanOrEqual(1);
});