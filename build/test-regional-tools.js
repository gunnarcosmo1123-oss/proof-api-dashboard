'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const storage = new Map(),
  ctx = {
    URL,
    localStorage: { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
  };
vm.createContext(ctx);
for (const name of ['data', 'community-data', 'insights'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + name + '.js'), 'utf8'), ctx);
vm.runInContext('this.P=PROOF', ctx);
const { P, ProofPeriod: D, ProofInsights: I, ProofCommunity: C } = ctx;
assert.ok(D.valid('2024-02-29'));
assert.ok(!D.valid('2025-02-29'));
assert.ok(!D.valid('2026-02-30'));
assert.ok(!D.valid('2026-2-01'));
assert.ok(!D.valid('garbage'));
assert.equal(D.shift('2024-03-01', -1), '2024-02-29');
assert.equal(D.shift('2026-01-01', -1), '2025-12-31');
assert.equal(D.recent(7, '2026-11-15').from, '2026-11-09');
assert.equal(D.recent(30, '2026-11-15').from, '2026-10-17');
assert.equal(D.clean(null).date, null);
assert.equal(D.label({ date: '2026-11-10', from: '2026-11-01' }), '2026-11-10');
assert.equal(D.label({ from: '2026-11-15', to: '2026-11-01' }), 'All dates');
for (const period of [
  {},
  { date: '2026-11-10' },
  { from: '2026-11-08', to: '2026-11-11' },
  { from: '2026-11-10' },
  { to: '2026-11-09' },
]) {
  const records = P.scopeSubs(null, null, null, period);
  assert.equal(records.length, P.submissions.filter((s) => D.matches(P.actionDate(s), period)).length);
  assert.equal(
    P.countryRows(records).reduce((a, r) => a + r.count, 0),
    records.length,
  );
}
assert.ok(D.matches('2026-11-08', { from: '2026-11-08', to: '2026-11-11' }));
assert.ok(D.matches('2026-11-11', { from: '2026-11-08', to: '2026-11-11' }));
assert.ok(!D.matches('2026-11-12', { from: '2026-11-08', to: '2026-11-11' }));
const seed = I.summarise(P.submissions);
assert.equal(seed.total, 66);
assert.equal(seed.seed, 66);
assert.equal(seed.local, 0);
assert.equal(seed.documented, 0);
assert.equal(seed.human, 0);
assert.equal(seed.followup, 0);
assert.equal(
  seed.actions.reduce((sum, a) => sum + a.count, 0),
  seed.total,
);
const project = C.createProject({
  action: 'afforest',
  city: 6,
  date: '2026-11-15',
  title: 'PRIVATE project name',
  community: 'PRIVATE members',
  plan: 'PRIVATE plan',
  permissionsAcknowledged: true,
});
const local = {
  ...P.submissions[0],
  id: 'PA-9998',
  action: 'afforest',
  city: 6,
  time: new Date(2026, 10, 15),
  status: 'pending',
  projectId: project.id,
  forensics: {},
  thumb: 'PRIVATE photo',
  submitter: 'PRIVATE submitter',
  hash: 'PRIVATE hash',
  deviceLocation: { lat: -1.2, lon: 36.9, accuracyMeters: 20 },
  actionEvidence: { species: 'PRIVATE species notes', planted: 0, maintenance: 'PRIVATE maintainer' },
};
P.submissions.unshift(local);
assert.equal(I.summarise([local]).documented, 1, 'zero is a filled numeric field');
assert.equal(I.summarise([{ ...local, actionEvidence: { planted: 0 } }]).documented, 0);
C.addObservation(project.id, {
  kind: 'followup',
  date: '2026-11-20',
  note: 'PRIVATE follow-up note',
  value: 0,
});
C.recordReview(local, {
  reviewer: 'PRIVATE reviewer',
  note: 'PRIVATE review reason',
  acknowledged: true,
  decision: 'verified',
});
local.status = 'verified';
const measured = I.summarise([local]);
assert.equal(measured.accepted, 1);
assert.equal(measured.human, 1);
assert.equal(measured.followup, 1);
const scoped = P.scopeSubs('Kenya', 6, null, { date: '2026-11-15' });
assert.equal(
  I.summarise(scoped).followup,
  1,
  'follow-up coverage includes later observations outside action-date range',
);
const redacted = I.summary(C.projectFor(project.id));
assert.ok(!JSON.stringify(redacted).includes('PRIVATE'));
assert.equal(redacted.records[0].selfReportedFields.planted, 0);
assert.equal(redacted.observations[0].value, 0);
assert.ok(!redacted.records[0].selfReportedDeviceLocation);
const explicit = I.summary(C.projectFor(project.id), { personal: true, photos: true, coordinates: true });
assert.equal(explicit.records[0].submitter, local.submitter);
assert.equal(explicit.records[0].photoPreview, local.thumb);
assert.equal(explicit.records[0].selfReportedDeviceLocation.lat, -1.2);
assert.ok(
  !JSON.stringify(explicit).includes('PRIVATE hash'),
  'hashes and original EXIF never leave the summary',
);
const source = {
  country: 'Kenya',
  city: 6,
  from: '2026-11-01',
  to: '2026-11-15',
  action: 'afforest',
  private: 'PRIVATE',
};
const link = I.mapLink(
  'https://example.test/proof/?story=PRIVATE&drawer=PRIVATE#PRIVATE',
  source,
  'gallery',
  'en',
);
assert.ok(!link.includes('PRIVATE'));
assert.ok(!link.includes('story='));
const parsed = I.readMapLink(link);
assert.equal(parsed.state.country, 'Kenya');
assert.equal(parsed.state.city, 6);
assert.equal(parsed.mode, 'gallery');
assert.equal(parsed.state.from, source.from);
assert.equal(parsed.state.to, source.to);
assert.equal(parsed.state.action, 'afforest');
assert.equal(
  I.readMapLink('https://example.test/?map-city=Nairobi&map-action=bogus&map-date=2026-02-30').state.country,
  'Kenya',
);
assert.equal(
  I.readMapLink('https://example.test/?map-city=Nairobi&map-action=bogus&map-date=2026-02-30').state.action,
  null,
);
console.log(
  'PASS: inclusive date ranges/leap days, regional denominators and actual review/follow-up provenance, redacted exports and safe filter-link round trips',
);
