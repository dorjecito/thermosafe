import { test, expect } from '@playwright/test';

test('test general ThermoSafe', async ({ page }) => {
  await page.goto('https://thermosafe.app');

  const input = page.locator('input').first();

  // Palma
  await input.fill('Palma');
  await page.getByRole('button', { name: /Palma.*ES/i }).click();

  await page.waitForTimeout(2000);
  await expect(page.getByText(/Palma/i).last()).toBeVisible();

  // Barcelona
  await input.fill('Barcelona');
  await page.getByRole('button', { name: /Barcelona.*ES/i }).click();

  await page.waitForTimeout(2000);
  await expect(page.getByText(/Barcelona/i).last()).toBeVisible();
});