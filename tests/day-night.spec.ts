import { test, expect } from '@playwright/test';

// Funció per simular hora fixa
function freezeTime(page: any, isoDate: string) {
  return page.addInitScript((dateString) => {
    const fixed = new Date(dateString).valueOf();

    const RealDate = Date;

    class MockDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixed);
        } else {
          super(...args);
        }
      }

      static now() {
        return fixed;
      }
    }

    // @ts-ignore
    window.Date = MockDate;
  }, isoDate);
}

test.describe('ThermoSafe dia / nit', () => {

  test('comportament de dia a Mallorca', async ({ context, page }) => {
    test.setTimeout(60_000);

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 39.5696,
      longitude: 2.6502,
    });

    // 🕐 Migdia
    await freezeTime(page, '2026-07-15T13:00:00+02:00');

    await page.goto('https://thermosafe.app');
    await page.waitForTimeout(3000);

    // ✔️ La UI ha de mostrar dades
    await expect(page.locator('body')).toContainText(/temperatura|temperature|uv|vent|wind/i);

    // ✔️ De dia no hauria de ser UV 0 (validació flexible)
    await expect(page.locator('body')).not.toContainText(/uv\s*0|0\s*uv/i);
  });

  test('comportament de nit a Mallorca', async ({ context, page }) => {
    test.setTimeout(60_000);

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 39.5696,
      longitude: 2.6502,
    });

    // 🌙 Nit
    await freezeTime(page, '2026-07-15T02:00:00+02:00');

    await page.goto('https://thermosafe.app');
    await page.waitForTimeout(3000);

    // ✔️ La UI ha de seguir mostrant dades
    await expect(page.locator('body')).toContainText(/temperatura|temperature|uv|vent|wind/i);

    // ✔️ De nit NO hi ha UV alt (validació comportament)
    await expect(page.getByText(/alt|alto|high/i)).not.toBeVisible();

    // ✔️ Opcional: evitar incoherències visuals
    await expect(page.getByText(/cel net/i)).not.toBeVisible();
  });

});