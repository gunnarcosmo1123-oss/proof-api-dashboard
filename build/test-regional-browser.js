'use strict';
// Run against a local static server. Playwright is a test dependency only.
const assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  crypto = require('node:crypto');
const { chromium } = require('playwright');
const base = process.env.PROOF_TEST_URL || 'http://127.0.0.1:8000',
  root = path.resolve(__dirname, '..');
const photo = path.join(root, 'assets/photos/afforest-01.jpg'),
  before = path.join(root, 'assets/photos/afforest-02.jpg');
const digest = crypto.createHash('sha256').update(fs.readFileSync(photo)).digest('hex');
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1450, height: 1000 },
    geolocation: { latitude: -1.25, longitude: 36.82, accuracy: 30 },
  });
  const page = await context.newPage(),
    errors = [],
    external = [],
    requests = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    requests.push(r.url());
    if (/^https?:/.test(r.url()) && !r.url().startsWith(base)) external.push(r.url());
  });
  await context.addInitScript(() => {
    window.geoCalls = 0;
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args) => {
      window.geoCalls++;
      return original(...args);
    };
  });
  try {
    await page.goto(base + '/?tab=map&lang=en&nosplash=1');
    const map = page.locator('#tab-map');
    await map.getByLabel('From date', { exact: true }).fill('2026-11-08');
    await map.getByLabel('To date', { exact: true }).fill('2026-11-10');
    const expected = await page.evaluate(() =>
      PROOF.submissions
        .filter((s) => {
          const d = PROOF.actionDate(s);
          return d >= '2026-11-08' && d <= '2026-11-10';
        })
        .map((s) => s.id)
        .sort(),
    );
    assert.deepEqual(
      (
        await page.locator('.mapx-project').evaluateAll((cards) => cards.map((c) => c.dataset.submission))
      ).sort(),
      expected,
    );
    const active = await page
      .locator('.map-path[data-active=true]')
      .evaluateAll((paths) => paths.map((p) => p.dataset.country).sort());
    assert.deepEqual(
      active,
      await page.evaluate(
        (ids) => [...new Set(ids.map((id) => PROOF.city(PROOF.byId(id).city).country.en))].sort(),
        expected,
      ),
    );
    await map.getByLabel('To date', { exact: true }).fill('2026-11-01');
    assert.match(await map.locator('.pt-error').innerText(), /previous filter is still applied/);
    assert.deepEqual(
      (
        await page.locator('.mapx-project').evaluateAll((cards) => cards.map((c) => c.dataset.submission))
      ).sort(),
      expected,
    );
    await map.getByLabel('To date', { exact: true }).fill('2026-11-10');
    await map.getByRole('button', { name: 'Open in Analytics →', exact: true }).click();
    assert.equal(
      await page.locator('#tab-analytics').getByLabel('From date', { exact: true }).inputValue(),
      '2026-11-08',
    );
    assert.equal(
      await page.locator('#tab-analytics').getByLabel('To date', { exact: true }).inputValue(),
      '2026-11-10',
    );
    assert.equal(
      (await page.locator('.hier-counts b').allTextContents()).reduce((sum, n) => sum + +n, 0),
      expected.length,
    );
    await page.locator('#tabs [data-tab=map]').click();
    await map.getByRole('button', { name: 'Last 7 days', exact: true }).click();
    assert.equal(
      await map.getByLabel('From date', { exact: true }).inputValue(),
      await page.evaluate(() => ProofPeriod.recent(7).from),
    );
    await map.getByRole('button', { name: 'Last 30 days', exact: true }).click();
    assert.equal(
      await map.getByLabel('From date', { exact: true }).inputValue(),
      await page.evaluate(() => ProofPeriod.recent(30).from),
    );
    await map.getByLabel('From date', { exact: true }).fill('2026-11-08');
    await map.getByLabel('To date', { exact: true }).fill('2026-11-10');
    console.log('PASS: inclusive ranges, invalid-range feedback, presets and matching Analytics handoff');

    await map.getByLabel('Timeline speed', { exact: true }).selectOption('500');
    await map.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await map.getByRole('button', { name: 'Pause timeline', exact: true }).click();
    const paused = await page.locator('#map-date-filter').inputValue();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#map-date-filter').inputValue(), paused);
    await map.getByRole('button', { name: 'Restore selected period', exact: true }).click();
    assert.equal(await map.getByLabel('From date', { exact: true }).inputValue(), '2026-11-08');
    await map.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await page.locator('#tabs [data-tab=regions]').click();
    const left = await page.locator('#map-date-filter').inputValue();
    await page.waitForTimeout(650);
    assert.equal(
      await page.locator('#map-date-filter').inputValue(),
      left,
      'leaving the map pauses its timer',
    );
    await page.locator('#tabs [data-tab=map]').click();
    await map.getByRole('button', { name: 'Restore selected period', exact: true }).click();
    console.log('PASS: timeline play/pause, selected-period restoration and timer cleanup on tab changes');

    await page.locator('#map-country-filter').selectOption('Kenya');
    await page.locator('#map-city-filter').selectOption('6');
    await page.locator('.cx-mix-bar[data-action-filter=afforest]').click();
    await page.locator('[data-view=gallery]').click();
    await map.getByRole('button', { name: 'Share view', exact: true }).click();
    const share = await page.getByLabel('Filtered view link', { exact: true }).inputValue();
    assert.ok(share.includes('map-city=Nairobi'));
    assert.ok(share.includes('map-from=2026-11-08'));
    assert.ok(!share.includes('story='));
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      }),
    );
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    assert.match(await page.locator('dialog .evidence-status').innerText(), /link is selected/);
    await page.keyboard.press('Escape');
    await page.goto(share + '&nosplash=1');
    assert.equal(await page.locator('#map-city-filter').inputValue(), '6');
    assert.equal(await page.locator('#map-country-filter').inputValue(), 'Kenya');
    assert.equal(await page.evaluate(() => MAP_STATE.action), 'afforest');
    assert.equal(await page.evaluate(() => MAP_VIEW_MODE), 'gallery');
    assert.equal(await map.getByLabel('To date', { exact: true }).inputValue(), '2026-11-10');
    console.log(
      'PASS: filter-only share URL round trips place, period, action and view with clipboard fallback',
    );

    await page.locator('#tabs [data-tab=regions]').click();
    const regions = page.locator('#tab-regions');
    await regions.getByRole('button', { name: 'Use Action Map dates & action type', exact: true }).click();
    const stats = await page.evaluate(() =>
      REGION_STATE.values.map((v) =>
        ProofInsights.summarise(
          PROOF.scopeSubs(v, null, null, REGION_STATE.period).filter(
            (s) => !REGION_STATE.action || s.action === REGION_STATE.action,
          ),
        ),
      ),
    );
    assert.deepEqual(
      (await regions.locator('[data-metric=total] td').allTextContents()).map(Number),
      stats.map((s) => s.total),
    );
    assert.ok((await regions.locator('[data-metric=documented]').innerText()).includes('Not assessed'));
    await regions.getByRole('button', { name: 'Add a region', exact: true }).click();
    assert.equal(await regions.locator('.pt-region-choice').count(), 3);
    const previous = await regions.getByLabel('Region 2', { exact: true }).inputValue();
    await regions.getByLabel('Region 2', { exact: true }).selectOption('Malaysia');
    assert.equal(await regions.getByLabel('Region 2', { exact: true }).inputValue(), previous);
    assert.match(await regions.locator('.pt-error:not(:empty)').innerText(), /different regions/);
    await regions.getByLabel('Region 3', { exact: true }).selectOption('Iceland');
    assert.match(await regions.locator('.mapx-small-sample').last().innerText(), /No records/);
    await regions.getByLabel('Compare by', { exact: true }).selectOption('city');
    assert.equal(await regions.locator('.pt-region-choice').count(), 2);
    assert.equal(await regions.getByLabel('Region 1', { exact: true }).inputValue(), '9');
    await page.screenshot({ path: path.join(root, '../regions-city-review.png'), fullPage: true });
    console.log(
      'PASS: comparable regions, correct denominators, duplicate guard, absent-data limits and city comparison',
    );

    const project = await page.evaluate(
      (image) => {
        const p = ProofCommunity.createProject({
          action: 'afforest',
          city: 6,
          date: '2026-11-15',
          title: 'PRIVATE Nairobi project',
          community: 'PRIVATE community',
          permissionsAcknowledged: true,
        });
        ProofCommunity.addObservation(p.id, {
          kind: 'baseline',
          date: '2026-11-14',
          note: 'PRIVATE baseline note',
          photo: image,
        });
        window.__startProjectSubmission(ProofCommunity.projectFor(p.id));
        return p;
      },
      'data:image/jpeg;base64,' + fs.readFileSync(before).toString('base64'),
    );
    await page.locator('#tab-submit input[type=file]').first().setInputFiles(photo);
    await page.waitForFunction(() => SUBMIT.dims != null);
    await page.locator('#tab-submit .claim-form input[type=text]').first().fill('PRIVATE contributor');
    await page.locator('#tab-submit .cx-action-details > summary').click();
    await page.getByLabel('Species planted', { exact: true }).fill('PRIVATE species notes');
    await page.getByLabel('Number of seedlings planted', { exact: true }).fill('100');
    await page
      .getByLabel('Watering and maintenance responsibility', { exact: true })
      .fill('PRIVATE maintainer');
    assert.equal(await page.evaluate(() => window.geoCalls), 0);
    assert.equal(await page.locator('input[capture=environment]').count(), 1);
    await context.grantPermissions(['geolocation']);
    await page.getByRole('button', { name: 'Attach my device location', exact: true }).click();
    await page.waitForFunction(() => SUBMIT.deviceLocation?.lat === -1.25);
    await page.getByRole('button', { name: 'Repeat-photo framing guide', exact: true }).click();
    await page.getByLabel('Reference overlay opacity', { exact: true }).fill('70');
    assert.equal(await page.locator('.pt-ghost').evaluate((e) => e.style.opacity), '0.7');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save offline draft', exact: true }).click();
    await page.waitForFunction(async () => (await ProofDrafts.list()).length === 1);
    assert.equal(
      await page.evaluate(async () =>
        sha256(await (await ProofDrafts.load(SUBMIT.draftId)).file.arrayBuffer()),
      ),
      digest,
    );
    await page.getByRole('button', { name: 'Prepare app for offline use', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('.pt-capture .evidence-status')?.textContent.includes('Offline app prepared'),
      null,
      { timeout: 60000 },
    );
    assert.ok(
      !requests.some((u) => /huggingface|vendor\/transformers/.test(u)),
      'field-offline preparation does not download model/runtime files',
    );
    await context.setOffline(true);
    await page.reload();
    assert.equal(
      await page.evaluate(() => SUBMIT.file),
      null,
      'drafts do not attach themselves automatically',
    );
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
    await page.waitForFunction(() => SUBMIT.dims != null);
    assert.equal(await page.evaluate(async () => sha256(await SUBMIT.file.arrayBuffer())), digest);
    assert.equal(await page.evaluate(() => SUBMIT.projectId), project.id);
    assert.equal(await page.evaluate(() => SUBMIT.actionEvidence.values.planted), '100');
    assert.equal(await page.evaluate(() => SUBMIT.deviceLocation.lat), -1.25);
    await page.locator('#tab-submit .submit-actions .btn-primary').click();
    // A language rebuild during the async local pipeline must keep its live result panel.
    await page.locator('#lang-toggle').click();
    await page.locator('#lang-toggle').click();
    await page.locator('#run-real-model').waitFor({ timeout: 20000 });
    const record = await page.evaluate(() => SUBMIT.result.submission);
    assert.equal(await page.evaluate((id) => REG.hashes.find((h) => h.id === id).hash, record.id), digest);
    assert.equal(record.deviceLocation.lat, -1.25);
    console.log(
      'PASS: opt-in location, repeat framing, exact original-file draft persistence and submission after offline reload',
    );

    // Same original guarantees matching aspect ratios; identical-file warning remains visible.
    await page.locator('.pair-cell input[type=file]').first().setInputFiles(photo);
    await page.locator('.pair-cell input[type=date]').first().fill('2026-11-14');
    const range = page.locator('.pair-panel .pt-compare-range');
    await range.focus();
    await page.keyboard.press('End');
    assert.equal(await range.inputValue(), '100');
    assert.match(await range.getAttribute('aria-valuetext'), /100%/);
    await page.locator('.pair-confirm input').check();
    await page.getByRole('button', { name: 'Compare evidence pair', exact: true }).click();
    await page.locator('.pair-output .evidence-metric').first().waitFor();
    await page.locator('.pair-output circle[role=button]').last().focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('.pair-output [role=status]').innerText(), /After · 2026-11-15/);
    const obs = await page.evaluate(() => PROOF_NDVI.sites.find((s) => s.city === 6).observations[3]);
    await page.getByLabel('Selected Landsat acquisition', { exact: true }).selectOption('3');
    assert.match(await page.locator('.ndvi-acquisition').innerText(), new RegExp(obs.date));
    assert.ok((await page.locator('.ndvi-acquisition').innerText()).includes(obs.sceneId));
    await page.locator('.satellite-panel circle[role=button]').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByLabel('Selected Landsat acquisition', { exact: true }).inputValue(), '0');
    console.log(
      'PASS: keyboard before/after wipe, clickable measured greenness and source-linked NDVI acquisitions offline',
    );

    await page
      .locator('#tab-submit')
      .getByRole('button', { name: 'Open project story →', exact: true })
      .click();
    assert.equal(await page.locator('#tab-story .pt-compare-range').count(), 1);
    await page.evaluate((id) => {
      window.__setVerdict(id, 'verified', {
        reviewer: 'PRIVATE reviewer',
        note: 'PRIVATE local review for the test',
        acknowledged: true,
      });
      ProofCommunity.addObservation(PROOF.byId(id).projectId, {
        kind: 'followup',
        date: '2026-11-16',
        value: 95,
        note: 'PRIVATE follow-up note',
      });
      ProofExperience.refresh();
    }, record.id);
    await page.getByRole('button', { name: 'Download project summary', exact: true }).click();
    assert.equal(await page.locator('dialog input[type=checkbox]:checked').count(), 0);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download JSON summary', exact: true }).click(),
    ]);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.ok(!JSON.stringify(exported).includes('PRIVATE'));
    assert.ok(!exported.records[0].selfReportedDeviceLocation);
    assert.ok(!exported.observations[0].photoPreview);
    assert.equal(exported.records[0].selfReportedFields.planted, 100);
    await page.keyboard.press('Escape');
    await page.locator('#tabs [data-tab=regions]').click();
    await regions.getByRole('button', { name: 'All dates', exact: true }).click();
    assert.match(
      (await regions.locator('[data-metric=documented] td').allTextContents())[1],
      /1 \/ 1 · 100%/,
    );
    assert.match((await regions.locator('[data-metric=human] td').allTextContents())[1], /^1 \/ /);
    assert.match((await regions.locator('[data-metric=followup] td').allTextContents())[1], /^1 \/ /);
    await page.evaluate(() =>
      window.__startProjectSubmission(ProofCommunity.projectFor(ProofExperience.storyId)),
    );
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
    await page.waitForFunction(() => SUBMIT.dims != null);
    await page.getByRole('button', { name: 'Remove device location', exact: true }).click();
    assert.equal(await page.evaluate(() => !!SUBMIT.deviceLocation), false);
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        window.lateLocation = success;
      };
    });
    await page.getByRole('button', { name: 'Attach my device location', exact: true }).click();
    await page.getByRole('button', { name: 'Remove device location', exact: true }).click();
    await page.evaluate(() =>
      window.lateLocation({
        coords: { latitude: -1.25, longitude: 36.82, accuracy: 30 },
        timestamp: Date.now(),
      }),
    );
    assert.equal(
      await page.evaluate(() => !!SUBMIT.deviceLocation),
      false,
      'removal wins over a late location response',
    );
    await page.getByRole('button', { name: 'Delete draft', exact: true }).click();
    await page.waitForFunction(async () => (await ProofDrafts.list()).length === 0);
    assert.ok(
      await page.evaluate((id) => !!PROOF.byId(id), record.id),
      'deleting a draft does not delete its submitted record',
    );
    console.log(
      'PASS: story comparison, redacted downloads, live regional review/follow-up coverage, location removal and draft deletion',
    );

    // Fail storage deliberately; the photo stays in memory and errors are visible.
    await page.evaluate(() => {
      ProofDrafts.save = async () => {
        throw new Error('Quota exceeded (test)');
      };
    });
    await page.getByRole('button', { name: 'Save offline draft', exact: true }).click();
    assert.match(
      await page.locator('.pt-capture .evidence-status').innerText(),
      /Draft was not saved.*Quota exceeded/,
    );
    assert.equal(await page.evaluate(async () => sha256(await SUBMIT.file.arrayBuffer())), digest);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#lang-toggle').click();
    assert.equal(
      await page.evaluate(async () => sha256(await SUBMIT.file.arrayBuffer())),
      digest,
      'language switches preserve an open original',
    );
    assert.ok(await page.getByRole('button', { name: '保存离线草稿', exact: true }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#tabs [data-tab=regions]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(
      (await page.locator('.topbar').boundingBox()).height <= 80,
      'mobile header stays compact in Chinese',
    );
    await page.locator('.tab.active').evaluate(async (e) => {
      await Promise.all(e.getAnimations().map((a) => a.finished));
    });
    await page.screenshot({ path: path.join(root, '../regions-mobile-review.png'), fullPage: true });
    console.log(
      'PASS: visible storage failures, retained originals on language changes and 390px bilingual layouts',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: all new workflows work without external requests or browser errors');
  } finally {
    await context.close();
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
