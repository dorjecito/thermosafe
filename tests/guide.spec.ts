import { test, expect } from '@playwright/test';

const titles = { ca: 'Guia d’usuari', es: 'Guía de usuario', eu: 'Erabiltzailearen gida', gl: 'Guía de uso', en: 'User guide' };

test.beforeEach(async ({ context }) => {
  // Tests never call production weather, Firebase, analytics or other external services.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
    return route.abort();
  });
  await context.addInitScript(() => {
    (window as any).__guidePermissionCalls = [];
    const record = (name: string) => (window as any).__guidePermissionCalls.push(name);
    navigator.geolocation.getCurrentPosition = () => record('geolocation');
    navigator.geolocation.watchPosition = () => { record('watchPosition'); return 1; };
    if ('Notification' in window) Notification.requestPermission = async () => { record('notifications'); return 'denied'; };
  });
});

for (const [lang, title] of Object.entries(titles)) {
  test(`${lang}: direct route, metadata, reload, index and no weather initialization`, async ({ page }) => {
    const requested: string[] = [];
    page.on('request', request => requested.push(request.url()));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/guia?lng=${lang}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page).toHaveTitle(`${title} · ThermoSafe`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://thermosafe.app/guia');
    await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', '');
    await expect(page.locator('main section')).toHaveCount(11);
    for (const href of await page.locator('nav a').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
      await page.locator(`nav a[href="${href}"]`).click();
      await expect(page.locator(href!)).toBeInViewport();
    }
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    expect(await page.evaluate(() => (window as any).__guidePermissionCalls)).toEqual([]);
    expect(requested.filter(url => /\/api\/|firebase|openweather|openuv|nominatim|nasa|\/assets\/App-|\/assets\/subscribe-/.test(url))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('language selection persists, saved preference wins and home link returns to App', async ({ page }) => {
  await page.goto('/guia?lng=ca');
  await page.getByRole('combobox').selectOption('eu');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.eu);
  await page.goto('/guia/?lng=en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.eu);
  expect(await page.evaluate(() => localStorage.getItem('ts-lang'))).toBe('eu');
  expect(await page.evaluate(() => (window as any).__guidePermissionCalls)).toEqual([]);
  await page.locator('.guide-home').first().click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.guide-unavailable-link a')).toHaveAttribute('href', '/guia');
  await page.locator('.guide-unavailable-link a').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.eu);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 284, height: 591 }]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${viewport.width}×${viewport.height} ${colorScheme}: layout, keyboard and text zoom`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      await page.goto('/guia?lng=ca');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.ca);
      await page.keyboard.press('Tab');
      await expect(page.locator('.guide-skip')).toBeFocused();
      await page.keyboard.press('Enter');
      expect(new URL(page.url()).hash).toBe('#guide-content');
      await page.locator('#preguntes-frequents summary').first().focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#preguntes-frequents details').first()).toHaveAttribute('open', '');
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(await overflow()).toBe(false);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `node_modules/.tmp/guide-${viewport.width}-${colorScheme}.png`, fullPage: false });
      // 200% text enlargement complements narrow-viewport reflow coverage.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      expect(await overflow()).toBe(false);
      await expect(page.getByRole('combobox')).toBeVisible();
    });
  }
}

test('PWA: cached guide can reload offline with existing generated worker', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow', baseURL: 'http://127.0.0.1:4173' });
  // The guide's generated worker caches only local assets. Block external traffic.
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  try {
    await page.goto('/guia?lng=ca');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.ca);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.ca);
    await page.getByRole('combobox').selectOption('en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.en);
    await page.goto('/guia/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.en);
  } finally { await context.close(); }
});

for (const viewport of [{ width: 390, height: 844 }, { width: 284, height: 591 }]) {
  test(`${viewport.width}px: main action bar retains share and 112, opens guide`, async ({ context, page }) => {
    await page.setViewportSize(viewport);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: unknown) => { (window as any).__shared = data; } });
      navigator.geolocation.getCurrentPosition = success => success({
        coords: { latitude: 39.57, longitude: 2.65, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now(),
      } as GeolocationPosition);
    });
    const now = Math.floor(Date.now() / 1000);
    await context.route('**/api/openweather?**', route => {
      const kind = new URL(route.request().url()).searchParams.get('route');
      const json = kind === 'weather' ? {
        coord: { lat: 39.57, lon: 2.65 }, main: { temp: 26, humidity: 55, feels_like: 26 },
        wind: { speed: 4, deg: 180 }, clouds: { all: 10 }, weather: [{ id: 800, main: 'Clear', description: 'cel net', icon: '01d' }],
        sys: { sunrise: now - 3600, sunset: now + 3600, country: 'ES' }, timezone: 3600, name: 'Palma', dt: now,
      } : kind === 'geo-reverse' ? [{ name: 'Palma' }] : { alerts: [], hourly: [], current: { uvi: 3 }, timezone_offset: 3600 };
      return route.fulfill({ json });
    });
    await context.route('**/api/openuv?**', route => route.fulfill({ json: { result: { uv: 3, uv_max: 5 } } }));
    await page.goto('/?lng=ca');
    const emergency = page.locator('.safety-112-btn');
    await expect(emergency).toBeVisible();
    await page.getByRole('button', { name: 'Català', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Català', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const box = await emergency.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(64);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.locator('.safety-share-btn').click();
    expect(await page.evaluate(() => (window as any).__shared.text)).toContain('ThermoSafe');
    const confirmation = page.waitForEvent('dialog').then(async dialog => {
      const type = dialog.type();
      const message = dialog.message();
      await dialog.dismiss(); // Never place a real emergency call in a browser test.
      expect(type).toBe('confirm');
      expect(message).toBe('Segur que vols trucar a emergències?');
    });
    await emergency.click();
    await confirmation;
    await page.locator('.safety-actions').screenshot({ path: `node_modules/.tmp/guide-actions-${viewport.width}.png` });
    await page.locator('.safety-info-link').click();
    await expect(page).toHaveURL('/guia');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.ca);
  });
}
