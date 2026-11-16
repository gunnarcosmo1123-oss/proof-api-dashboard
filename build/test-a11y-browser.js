'use strict';
// Optional browser test for the accessibility claims in the footer:
// keyboard traversal of every visible view, WAI-ARIA tab semantics, skip link.
// The view list is read from the DOM, so newly added tabs stay covered.
// Playwright is a test tool, not an app dependency. Serve the repo first:
//   NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-a11y-browser.js
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const URL_BASE = process.env.PROOF_TEST_URL || 'http://127.0.0.1:8000';
const launch = { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] };

async function main(){
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_BASE + '/?lang=en&nosplash');

  /* 1) Tablist semantics */
  const tabs = page.locator('.tabs button');
  const visible = page.locator('.tabs button:not([hidden])');
  const order = await visible.evaluateAll(btns => btns.map(b => b.dataset.tab));
  const tabCount = await tabs.count();
  assert.equal(await page.locator('.tabs').getAttribute('role'), 'tablist');
  assert.ok(order.length >= 8, 'at least eight visible views are reachable tabs, got ' + order.length);
  const bad = await tabs.evaluateAll(btns => btns.filter(b =>
    b.getAttribute('role') !== 'tab' || !b.getAttribute('aria-controls') || b.getAttribute('aria-selected') === null).length);
  assert.equal(bad, 0, 'every tab has role, aria-controls and aria-selected');
  const noLabel = await visible.evaluateAll(btns => btns.filter(b => !b.textContent.trim()).length);
  assert.equal(noLabel, 0, 'every visible tab has a text label');
  assert.equal(await tabs.evaluateAll(btns => btns.filter(b => b.getAttribute('aria-selected') === 'true').length), 1, 'exactly one selected tab');
  const panels = page.locator('main > .tab');
  assert.equal(await panels.count(), tabCount, 'one panel per tab');
  const badPanel = await panels.evaluateAll(secs => secs.filter(s =>
    s.getAttribute('role') !== 'tabpanel' || !s.getAttribute('aria-labelledby')).length);
  assert.equal(badPanel, 0, 'every panel is role=tabpanel with aria-labelledby');
  console.log('PASS: all ' + order.length + ' visible views (of ' + tabCount + ' tabs) carry WAI-ARIA tablist/tab/tabpanel semantics');

  /* 2) Skip link is the first focusable element and lands on main */
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.className || '') + '|' + (el.id || '') : 'none';
  });
  assert.match(firstFocus, /skip-link/, 'Tab reaches the skip link first: got ' + firstFocus);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'main-content', 'skip link moves focus to main content');
  console.log('PASS: skip link is first in tab order and focuses main content');

  /* 3) Arrow-key navigation across every visible view (roving tabindex) */
  await visible.first().focus();
  for(let i = 1; i < order.length; i++){
    await page.keyboard.press('ArrowRight');
    const state = await page.evaluate(() => {
      const b = document.activeElement;
      return { tab: b && b.dataset ? b.dataset.tab : null, selected: b && b.getAttribute('aria-selected') };
    });
    assert.equal(state.tab, order[i], 'ArrowRight ' + i + ' focuses ' + order[i]);
    assert.equal(state.selected, 'true');
    assert.ok(await page.locator('#tab-' + order[i]).evaluate(s => s.classList.contains('active')), 'panel ' + order[i] + ' is visible');
  }
  const last = order[order.length - 1];
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), order[0], 'Home returns to the first tab');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), last, 'ArrowLeft wraps to the last visible tab');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), last, 'End jumps to the last visible tab');
  console.log('PASS: ArrowRight/ArrowLeft/Home/End traverse all ' + order.length + ' visible views; hidden tabs are skipped');

  /* 4) English-only build: even ?lang=zh must not expose Chinese or a language switch */
  await page.goto(URL_BASE + '/?lang=zh&nosplash');
  assert.ok((await page.locator('.tabs').getAttribute('aria-label')).length > 0, 'tablist has an aria-label');
  assert.ok(await page.getByText('Skip to main content', { exact: true }).count(), 'English skip link is present');
  assert.equal(await visible.count(), order.length, 'the same visible views are exposed');
  assert.ok(!(await page.locator('#lang-toggle').isVisible()), 'language switch is hidden');
  assert.equal(await page.evaluate(() => /[\u4e00-\u9fff]/.test(document.body.innerText)), false, 'no Chinese text is rendered');
  console.log('PASS: English-only UI keeps the same keyboard structure; ?lang=zh cannot switch language');

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: no page errors during keyboard traversal');
}
main().catch(e => { console.error(e); process.exit(1); });
