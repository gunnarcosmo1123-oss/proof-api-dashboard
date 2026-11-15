'use strict';
// Optional browser test for the accessibility claims in the footer:
// keyboard traversal of all eight views, WAI-ARIA tab semantics, skip link.
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
  assert.equal(await page.locator('.tabs').getAttribute('role'), 'tablist');
  assert.equal(await tabs.count(), 8, 'eight views are all reachable tabs');
  const bad = await tabs.evaluateAll(btns => btns.filter(b =>
    b.getAttribute('role') !== 'tab' || !b.getAttribute('aria-controls') || b.getAttribute('aria-selected') === null || !b.textContent.trim()).length);
  assert.equal(bad, 0, 'every tab has role, aria-controls, aria-selected and a visible label');
  assert.equal(await tabs.evaluateAll(btns => btns.filter(b => b.getAttribute('aria-selected') === 'true').length), 1, 'exactly one selected tab');
  const panels = page.locator('main > .tab');
  assert.equal(await panels.count(), 8);
  const badPanel = await panels.evaluateAll(secs => secs.filter(s =>
    s.getAttribute('role') !== 'tabpanel' || !s.getAttribute('aria-labelledby')).length);
  assert.equal(badPanel, 0, 'every panel is role=tabpanel with aria-labelledby');
  console.log('PASS: eight views carry WAI-ARIA tablist/tab/tabpanel semantics in both states');

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

  /* 3) Arrow-key navigation across all eight views (roving tabindex) */
  await tabs.first().focus();
  for(let i = 1; i < 8; i++){
    await page.keyboard.press('ArrowRight');
    const state = await page.evaluate(() => {
      const b = document.activeElement;
      return { tab: b && b.dataset ? b.dataset.tab : null, selected: b && b.getAttribute('aria-selected') };
    });
    const expected = ['submit','overview','queue','dup','analytics','map','agent','about'][i];
    assert.equal(state.tab, expected, 'ArrowRight ' + i + ' focuses ' + expected);
    assert.equal(state.selected, 'true');
    assert.ok(await page.locator('#tab-' + expected).evaluate(s => s.classList.contains('active')), 'panel ' + expected + ' is visible');
  }
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'submit', 'Home returns to the first tab');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'about', 'ArrowLeft wraps to the last tab');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'about', 'End jumps to the last tab');
  console.log('PASS: ArrowRight/ArrowLeft/Home/End traverse all eight views; every step updates aria-selected and the visible panel');

  /* 4) Tab back into the page and confirm the Chinese variant labels the same structure */
  await page.goto(URL_BASE + '/?lang=zh&nosplash');
  assert.ok((await page.locator('.tabs').getAttribute('aria-label')).length > 0, 'tablist has a localized aria-label');
  assert.ok(await page.getByText('跳到主内容 / Skip to main content', { exact: true }).count(), 'skip link present in Chinese variant');
  assert.equal(await tabs.count(), 8);
  console.log('PASS: Chinese variant keeps the same keyboard structure with localized labels');

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: no page errors during keyboard traversal');
}
main().catch(e => { console.error(e); process.exit(1); });
