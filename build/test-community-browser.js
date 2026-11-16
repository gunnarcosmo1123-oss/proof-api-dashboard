'use strict';
const assert = require('node:assert/strict'),
  path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.PROOF_TEST_URL || 'http://127.0.0.1:8000';
const ROOT = path.resolve(__dirname, '..');
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1450, height: 1000 } }),
    page = await context.newPage(),
    errors = [],
    external = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(base)) external.push(r.url());
  });
  try {
    await page.goto(base + '/?lang=en&nosplash=1');
    assert.equal(await page.locator('#tab-home').evaluate((e) => e.classList.contains('active')), true);
    for (const name of ['Explore actions →', 'Submit evidence', 'Review evidence →'])
      assert.ok(await page.getByRole('button', { name, exact: true }).isVisible());
    assert.equal(await page.locator('#tab-home .stat').count(), 0);
    assert.equal(await page.locator('#tab-home .cx-gallery .cx-action-card').count(), 6);
    console.log('PASS: photo-led landing page, three entry points and operational KPIs in Overview');
    await page.getByRole('button', { name: 'Review evidence →', exact: true }).click();
    const pendingId = await page.evaluate(() => PROOF.submissions.find((s) => s.status === 'pending').id);
    const approveText = await page.evaluate(() => t('qc.approve'));
    await page
      .locator('#tab-queue .qc-card')
      .filter({ has: page.locator('.qc-id', { hasText: new RegExp('^' + pendingId + '$') }) })
      .getByRole('button', { name: approveText, exact: true })
      .click();
    await page
      .locator('dialog[open]')
      .getByRole('button', { name: 'Save local review', exact: true })
      .click();
    assert.equal(await page.evaluate((id) => PROOF.byId(id).status, pendingId), 'pending');
    assert.equal(await page.evaluate((id) => ProofCommunity.reviews(id).length, pendingId), 0);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    await page.locator('#tabs [data-tab=home]').click();
    console.log(
      'PASS: reviewer entry point and accept control require a completed review, with safe cancellation',
    );
    await page.getByRole('button', { name: 'Explore actions →', exact: true }).click();
    await page.locator('#map-country-filter').selectOption('China');
    await page.locator('#map-city-filter').selectOption('4');
    const date = await page.evaluate(() => PROOF.actionDate(PROOF.scopeSubs('China', 4, null)[0]));
    await page.locator('#map-date-filter').fill(date);
    const ids = await page
      .locator('.mapx-project')
      .evaluateAll((cards) => cards.map((c) => c.dataset.submission));
    await page.locator('.cx-view-modes [data-view=gallery]').click();
    assert.equal(await page.locator('.map-layout').isVisible(), false);
    await page.locator('.cx-view-modes [data-view=table]').click();
    assert.deepEqual(
      await page.locator('.mapx-project').evaluateAll((cards) => cards.map((c) => c.dataset.submission)),
      ids,
    );
    assert.equal(await page.locator('#map-city-filter').inputValue(), '4');
    assert.equal(await page.locator('#map-date-filter').inputValue(), date);
    await page.locator('.cx-view-modes [data-view=map-gallery]').click();
    assert.ok(await page.locator('.map-layout').isVisible());
    await page.getByRole('button', { name: 'All dates', exact: true }).click();
    await page.locator('.mapx-project').first().hover();
    assert.equal(await page.locator('.map-pin[data-city="4"].is-linked').count(), 1);
    await page.locator('.map-pin[data-city="4"]').hover();
    assert.ok((await page.locator('.mapx-project.is-linked').count()) > 0);
    await page.locator('.cx-mix-bar[data-action-filter=cleanup]').click();
    assert.ok(
      (await page.locator('.mapx-project').evaluateAll((cards) => cards.map((c) => c.dataset.action))).every(
        (k) => k === 'cleanup',
      ),
    );
    assert.equal(
      await page.locator('#map-coverage [data-action=afforest]').count(),
      1,
      'action filter does not hide coverage for other types',
    );
    console.log(
      'PASS: gallery/table parity, retained filters, reciprocal map/card highlights and chart cross-filtering',
    );

    const filteredCount = await page.locator('.mapx-project').count();
    await page.getByRole('button', { name: 'Open in Analytics →', exact: true }).click();
    assert.equal(await page.evaluate(() => HIER_ACTION), 'cleanup');
    assert.equal(
      (await page.locator('#tab-analytics .hier-counts b').allTextContents()).reduce(
        (sum, n) => sum + Number(n),
        0,
      ),
      filteredCount,
    );
    await page.locator('#tabs [data-tab=map]').click();

    await page.locator('#map-coverage [data-action=afforest] .cx-starter-link').click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByRole('button', { name: 'Continue →', exact: true }).click();
    assert.match(await dialog.locator('[role=alert]').innerText(), /Acknowledge/);
    await dialog
      .getByLabel('I will check site suitability, permissions and safety before doing this activity.', {
        exact: true,
      })
      .check();
    await dialog.getByRole('button', { name: 'Continue →', exact: true }).click();
    await dialog.getByLabel('Project name', { exact: true }).fill('Xiamen community trees');
    await dialog.getByLabel('Community / organisation', { exact: true }).fill('Neighbourhood volunteers');
    assert.equal(await dialog.getByLabel('Project city', { exact: true }).inputValue(), '4');
    await dialog.getByLabel('Planned action date', { exact: true }).fill('2026-11-15');
    await dialog
      .getByLabel('Local plan (optional)', { exact: true })
      .fill('Native species with a named watering team and fixed photo plots.');
    await dialog.getByRole('button', { name: 'Continue →', exact: true }).click();
    await dialog.getByLabel('Baseline plan prepared', { exact: true }).check();
    await dialog
      .getByLabel('Save this project and preview evidence in this browser. Nothing is uploaded or shared.', {
        exact: true,
      })
      .check();
    await dialog.getByRole('button', { name: 'Save project & add evidence →', exact: true }).click();
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    const project = await page.evaluate(() => ProofCommunity.listProjects()[0]);
    assert.equal(project.action, 'afforest');
    assert.equal(project.city, 4);
    assert.equal(project.guideVersion, '1.0');
    assert.equal(await page.locator('.cx-submission-project select').inputValue(), project.id);
    assert.deepEqual(
      await page.evaluate(() => ({ action: SUBMIT.action, city: SUBMIT.city, projectId: SUBMIT.projectId })),
      { action: 'afforest', city: 4, projectId: project.id },
    );
    console.log(
      'PASS: guided suitability/permissions wizard saves an explicit project and prefills submission',
    );

    await page.locator('#tab-submit .cx-action-details>summary').click();
    await page
      .getByLabel('Species planted', { exact: true })
      .fill('Locally suitable native species (test fixture)');
    await page.getByLabel('Number of seedlings planted', { exact: true }).fill('100');
    await page
      .getByLabel('Watering and maintenance responsibility', { exact: true })
      .fill('Neighbourhood watering team');

    await page
      .locator('#tab-submit input[type=file]')
      .first()
      .setInputFiles(path.join(ROOT, 'assets/photos/afforest-01.jpg'));
    await page.locator('#tab-submit .submit-actions .btn-primary').click();
    await page.locator('#run-real-model').waitFor({ timeout: 20000 });
    const sub = await page.evaluate(() => SUBMIT.result.submission);
    assert.equal(sub.projectId, project.id);
    assert.equal(sub.guideVersion, '1.0');
    assert.equal(sub.actionEvidence.planted, 100);
    assert.match(sub.actionEvidence.species, /native species/);
    assert.match(await page.locator('#tab-submit .cx-stages').innerText(), /No human review recorded/);
    await page
      .locator('#tab-submit')
      .getByRole('button', { name: 'Open project story →', exact: true })
      .click();
    assert.match(await page.locator('#tab-story h2').innerText(), /Xiamen community trees/);
    assert.equal(await page.locator('.cx-timeline-event[data-kind=action]').count(), 1);
    assert.match(await page.locator('#tab-story').innerText(), /Baseline · not recorded/);
    assert.match(await page.locator('#tab-story').innerText(), /Follow-up · not recorded/);
    console.log(
      'PASS: submitted original links to the project; story invents no baseline, outcome or human review',
    );

    async function observe(kind, date, note, value) {
      await page.getByRole('button', { name: 'Add baseline or follow-up', exact: true }).click();
      const d = page.locator('dialog[open]');
      await d.getByLabel('Observation type', { exact: true }).selectOption(kind);
      await d.getByLabel('Acquisition date (self-reported)', { exact: true }).fill(date);
      await d
        .getByLabel('What did you observe? Include the measurement period if relevant.', { exact: true })
        .fill(note);
      if (kind === 'baseline')
        await d
          .getByLabel('Evidence photo (optional, max 12 MB)', { exact: true })
          .setInputFiles(path.join(ROOT, 'assets/photos/afforest-02.jpg'));
      if (value != null) await d.locator('input[type=number]').fill(String(value));
      await d
        .getByLabel('Store a reduced preview locally. I have permission to record this evidence.', {
          exact: true,
        })
        .check();
      await d.getByRole('button', { name: 'Save observation', exact: true }).click();
      return d;
    }
    let d = await observe('baseline', '2026-11-16', 'Date is too late for a baseline');
    await d.locator('[role=alert]').waitFor({ state: 'visible' });
    assert.match(await d.locator('[role=alert]').innerText(), /baseline date/);
    await d.getByLabel('Acquisition date (self-reported)', { exact: true }).fill('2026-11-14');
    await d.getByRole('button', { name: 'Save observation', exact: true }).click();
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    await observe(
      'followup',
      '2026-12-15',
      '30-day repeat count: 84 living seedlings in the marked plots.',
      84,
    );
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    assert.equal(await page.locator('.cx-timeline-event[data-kind=baseline]').count(), 1);
    assert.equal(await page.locator('.cx-timeline-event[data-kind=baseline] img').count(), 1);
    assert.equal(await page.locator('.cx-timeline-event[data-kind=followup]').count(), 1);
    assert.match(await page.locator('#tab-story .cx-stages').innerText(), /Outcome follow-up available/);
    assert.match(await page.locator('#tab-story .cx-stages').innerText(), /No human review recorded/);
    console.log(
      'PASS: real dated observations, temporal validation and outcome availability independent of review',
    );

    const automatic = await page.evaluate(
      (id) => ProofCommunity.reviewState(PROOF.byId(id)).automatic,
      sub.id,
    );
    await page.locator('#tab-story .cx-review-stage-action').click();
    d = page.locator('dialog[open]');
    assert.match(await d.innerText(), /identity is self-declared/);
    await d.getByLabel('Reviewer name (self-declared)', { exact: true }).fill('Local field reviewer');
    await d
      .getByLabel('Reason and unresolved limitations', { exact: true })
      .fill('Photo and local notes reviewed. Location and long-term survival remain self-reported.');
    await d
      .getByLabel('I reviewed the evidence and acknowledge the limitations above.', { exact: true })
      .check();
    await d.getByRole('button', { name: 'Save local review', exact: true }).click();
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    assert.equal(await page.locator('.cx-timeline-event[data-kind=review]').count(), 1);
    assert.equal(
      await page.evaluate((id) => ProofCommunity.reviewState(PROOF.byId(id)).automatic, sub.id),
      automatic,
    );
    assert.match(await page.locator('#tab-story .cx-stages').innerText(), /Human reviewed · local/);
    assert.match(await page.locator('#tab-submit .verdict-banner').innerText(), /local review decision was recorded/);
    await page.reload();
    await page.locator('#tab-story h2').waitFor();
    assert.match(await page.locator('#tab-story h2').innerText(), /Xiamen community trees/);
    assert.equal(await page.locator('.cx-timeline-event[data-kind=review]').count(), 1);
    assert.equal(await page.locator('.cx-timeline-event[data-kind=followup]').count(), 1);
    console.log('PASS: named/reasoned local review, immutable automated stage and persistence after reload');

    await page.getByRole('button', { name: 'Add action evidence', exact: true }).click();
    await page
      .locator('#tab-submit input[type=file]')
      .first()
      .setInputFiles(path.join(ROOT, 'assets/photos/afforest-02.jpg'));
    await page.locator('#tab-submit .submit-actions .btn-primary').click();
    await page.locator('#run-real-model').waitFor({ timeout: 20000 });
    assert.equal(
      await page.evaluate((id) => ProofCommunity.projectFor(id).submissions.length, project.id),
      2,
    );
    await page
      .locator('#tab-submit')
      .getByRole('button', { name: 'Open project story →', exact: true })
      .click();
    assert.equal(await page.locator('.cx-timeline-event[data-kind=action]').count(), 2);
    console.log('PASS: repeat submissions group only through the explicit project link');

    await page.locator('#tabs button[data-tab=guides]').click();
    assert.equal(await page.locator('#tab-guides details[data-guide]').count(), 6);
    await page.locator('#tab-guides [data-guide=solar]>summary').click();
    assert.match(
      await page.locator('#tab-guides [data-guide=solar]').innerText(),
      /installed capacity \(kWp\)/,
    );
    await page.locator('#tab-guides [data-guide=solar] .cx-guide-sources>summary').click();
    assert.match(
      await page.locator('#tab-guides [data-guide=solar]').innerText(),
      /neither organisation has approved/,
    );
    console.log(
      'PASS: action-specific guides expose version, evidence requirements and source applicability',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#lang-toggle').click();
    for (const tab of ['home', 'map', 'guides', 'story']) {
      await page.locator('#tabs [data-tab=' + tab + ']').click();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        tab + ' fits mobile',
      );
    }
    assert.match(await page.locator('#tab-story').innerText(), /人工复核/);
    console.log('PASS: bilingual mobile landing, gallery, guides and story layouts');

    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      await new Promise((resolve, reject) => {
        const c = new MessageChannel();
        c.port1.onmessage = ({ data }) => (data.ok ? resolve() : reject(new Error(data.reason)));
        reg.active.postMessage('prepare-offline', [c.port2]);
      });
    });
    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator('.cx-timeline-event[data-kind=action]').count(), 2);
    await page.locator('#tabs [data-tab=home]').click();
    assert.equal(await page.locator('#tab-home .cx-local-project').count(), 1);
    await page.locator('#tab-home .cx-local-project').click();
    assert.equal(await page.locator('.cx-timeline-event[data-kind=review]').count(), 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      'PASS: offline reload retains projects, linked evidence and reviews; zero external requests or errors',
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
