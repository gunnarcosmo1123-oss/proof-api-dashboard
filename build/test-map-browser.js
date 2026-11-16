'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PROOF_TEST_URL || 'http://127.0.0.1:8000';
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } }),
    page = await context.newPage(),
    errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(base)) external.push(r.url());
  });
  try {
    await page.goto(base + '/?lang=en&tab=map&nosplash=1');
    await page.waitForFunction(() => document.querySelector('#intro').classList.contains('done'));
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.mapx-project').count(), 66);
    assert.equal(await page.locator('.mapx-ranking h3').innerText(), 'Country ranking');
    assert.equal(await page.locator('.mapx-coverage-card').count(), 3);
    assert.equal(await page.locator('.mapx-coverage-action').count(), 6);
    if (process.env.PROOF_SCREENSHOT_DIR)
      await page.screenshot({ path: process.env.PROOF_SCREENSHOT_DIR + '/map-global.png', fullPage: true });
    console.log('PASS: initial global overview, action list and coverage without selecting a country');

    const firstDate = await page.locator('.mapx-dates .dbar').first().getAttribute('aria-label');
    await page.locator('.mapx-dates .dbar').first().click();
    assert.equal(await page.locator('#map-date-filter').inputValue(), firstDate.slice(0, 10));

    const date = '2026-11-10';
    await page.locator('#map-date-filter').fill(date);
    const expected = await page.evaluate(
      (d) =>
        PROOF.scopeSubs(null, null, null, d).map((s) => ({
          id: s.id,
          country: PROOF.city(s.city).country.en,
          city: s.city,
        })),
      date,
    );
    assert.equal(await page.locator('.mapx-project').count(), expected.length);
    const active = await page
      .locator('.map-path[data-active=true]')
      .evaluateAll((paths) => paths.map((p) => p.dataset.country));
    assert.deepEqual(active.sort(), [...new Set(expected.map((s) => s.country))].sort());
    assert.equal(await page.locator('.mapx-ranking tbody tr').count(), active.length);
    for (const country of active) {
      assert.equal(
        (await page
          .locator('.map-path')
          .filter({ has: page.locator('title', { hasText: country }) })
          .count()) > 0,
        true,
      );
    }
    console.log('PASS: global date updates list, ranking and every highlighted country');

    const country = expected[0].country,
      city = expected[0].city;
    await page.locator(`.map-path[data-country="${country}"]`).press('Enter');
    assert.equal(await page.locator('#map-date-filter').inputValue(), date);
    assert.equal(await page.locator('#map-country-filter').inputValue(), country);
    assert.ok(Number((await page.locator('.map-svg').getAttribute('viewBox')).split(' ')[2]) < 360);
    await page.locator(`.map-pin[data-city="${city}"]`).press('Enter');
    assert.equal(await page.locator('#map-city-filter').inputValue(), String(city));
    const expectedCity = expected.filter((s) => s.city === city);
    assert.equal(await page.locator('.mapx-project').count(), expectedCity.length);
    const onMap = await page.locator('.mapx-breakdown tbody').innerText();
    await page.getByRole('button', { name: 'Open in Analytics →', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Hierarchy action date' }).inputValue(), date);
    const hierCounts = await page.locator('#tab-analytics .hier-counts b').allTextContents();
    assert.equal(
      hierCounts.reduce((a, n) => a + Number(n), 0),
      expectedCity.length,
    );
    assert.ok(onMap.length > 0);
    console.log('PASS: map keyboard selection zooms and carries country/city/date into Analytics');

    await page.locator('#tabs button[data-tab=map]').click();
    await page.getByRole('button', { name: 'Reset all filters', exact: true }).click();
    const search = page.getByRole('combobox', { name: 'Search country or recorded city' });
    await search.fill('厦门');
    await search.press('Enter');
    assert.equal(await page.locator('#map-city-filter').inputValue(), '4');
    assert.equal(await page.locator('#map-country-filter').inputValue(), 'China');
    assert.equal(await page.locator('.mapx-coverage-action .mapx-suggestion').count(), 5);
    assert.match(await page.locator('#map-coverage [data-action=afforest]').innerText(), /native trees/);
    assert.match(await page.locator('#map-coverage [data-action=cleanup]').innerText(), /100%/);
    await page.getByRole('button', { name: 'Reset all filters', exact: true }).click();
    await search.fill('Medellin');
    await search.press('Enter');
    assert.equal(await page.locator('#map-city-filter').inputValue(), '8');
    console.log('PASS: bilingual/accent-insensitive city search and cleanup-only local recommendations');

    const originalView = await page.locator('.map-svg').getAttribute('viewBox');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.notEqual(await page.locator('.map-svg').getAttribute('viewBox'), originalView);
    const zoomed = await page.locator('.map-svg').getAttribute('viewBox'),
      box = await page.locator('.map-svg').boundingBox();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 8 });
    await page.mouse.up();
    assert.notEqual(await page.locator('.map-svg').getAttribute('viewBox'), zoomed);
    assert.equal(
      await page.locator('#map-city-filter').inputValue(),
      '8',
      'panning cannot accidentally select a country',
    );
    console.log('PASS: zoom and drag-to-pan preserve the selected geographic filters');

    await search.fill('Canada');
    await search.press('Enter');
    assert.equal(await page.locator('.mapx-project').count(), 0);
    assert.match(await page.locator('#map-coverage').innerText(), /No verified evidence/);
    assert.equal(await page.locator('.mapx-suggestion').count(), 0);
    await page.getByRole('button', { name: 'Reset all filters', exact: true }).click();
    await page.locator('#map-date-filter').fill('2000-01-01');
    assert.equal(await page.locator('.mapx-project').count(), 0);
    assert.equal(await page.locator('.map-path[data-active=true]').count(), 0);
    await page.getByRole('button', { name: 'All dates', exact: true }).click();
    assert.equal(await page.locator('.mapx-project').count(), 66);
    console.log('PASS: empty countries/dates show honest empty states; all-dates restores global overview');

    await page.evaluate(() => {
      const original = PROOF.submissions[0];
      PROOF.submissions.push({
        ...original,
        id: 'PA-9999',
        city: 4,
        status: 'verified',
        action: 'afforest',
        time: new Date(2026, 10, 20),
      });
      window.__renderMap();
    });
    await page.locator('#map-date-filter').fill('2026-11-20');
    assert.equal(await page.locator('.mapx-project').count(), 1);
    assert.match(await page.locator('#map-coverage [data-action=afforest]').innerText(), /1 \/ 1/);
    console.log('PASS: new submissions update dates, map and coverage immediately');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#lang-toggle').click();
    assert.equal(await page.locator('#map-date-filter').inputValue(), '2026-11-20');
    assert.ok((await page.locator('.mapx-context').innerText()).includes('全球'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false);
    assert.equal(await page.locator('.mapx-coverage-card').count(), 3);
    console.log('PASS: Chinese mobile layout preserves filters and avoids page overflow');

    // Prepare the same offline shell used by opt-in CLIP, without fetching weights.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = ({ data }) => data.ok ? resolve() : reject(new Error(data.reason));
        registration.active.postMessage('prepare-offline', [channel.port2]);
      });
    });
    await context.setOffline(true);
    await page.reload();
    await page.locator('#map-date-filter').fill(date);
    assert.equal(await page.locator('.mapx-project').count(), expected.length);
    await page.locator('.mapx-search input').fill('Xiamen');
    await page.locator('.mapx-search input').press('Enter');
    assert.equal(await page.locator('#map-city-filter').inputValue(), '4');
    assert.equal(await page.locator('#map-date-filter').inputValue(), date);
    console.log('PASS: cached app reloads offline with functioning map, search and date filters');
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log('PASS: no external requests or browser errors');
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
