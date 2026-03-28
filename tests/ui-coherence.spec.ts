import { test, expect } from '@playwright/test';

test('no mostrar cel net amb alta nuvolositat', async ({ page }) => {
  await page.goto('https://thermosafe.app');

  await page.waitForTimeout(3000);

  await expect(page.getByText(/cel net/i)).not.toBeVisible();
});