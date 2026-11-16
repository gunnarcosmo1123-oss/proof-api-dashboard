'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const root = path.resolve(__dirname, '..'),
  files = ['js/data.js', 'js/community-data.js'];
function environment(saved) {
  const storage = new Map(saved ? Object.entries(saved) : []);
  let fail = false;
  const ctx = {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => {
        if (fail) throw new Error('Quota exceeded');
        storage.set(key, value);
      },
    },
  };
  vm.createContext(ctx);
  files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx));
  vm.runInContext('this.P=PROOF;', ctx);
  return {
    ctx,
    C: ctx.ProofCommunity,
    P: ctx.P,
    storage,
    failStorage(value) {
      fail = value;
    },
  };
}
const env = environment(),
  { C, P } = env;
const legacy = environment();
legacy.ctx.REG = { subs: [{ submission: { id: 'PA-9999' }, verification: { verdict: 'pending' } }] };
const oldRecord = { ...legacy.P.submissions[0], id: 'PA-9999', status: 'verified' };
assert.equal(
  legacy.C.reviewState(oldRecord).automatic,
  'pending',
  'legacy manual changes do not rewrite the recorded engine verdict',
);
assert.equal(legacy.C.reviewState(oldRecord).human, null, 'legacy acceptance cannot invent a reviewer');
assert.equal(Object.keys(C.guides).length, 6);
for (const a of P.actions) {
  const g = C.guides[a.key];
  assert.equal(g.version, '1.0');
  for (const key of ['fit', 'permissions', 'equipment', 'baseline', 'evidence', 'followup']) {
    assert.ok(g[key].en.length > 20);
    assert.ok(g[key].zh.length > 10);
  }
  assert.ok(g.sources.every((s) => s.url.startsWith('https://')));
}
const draft = {
  action: 'afforest',
  city: 6,
  date: '2026-11-15',
  title: 'Karura planting observations',
  community: 'Local volunteers',
  permissionsAcknowledged: true,
};
for (const patch of [
  { action: '__proto__' },
  { city: -1 },
  { city: 200 },
  { date: '2026-02-30' },
  { title: 'x' },
  { community: 'x' },
  { permissionsAcknowledged: false },
])
  assert.throws(() => C.createProject({ ...draft, ...patch }));
assert.equal(C.validDate('2024-02-29'), true);
assert.equal(C.validDate('2025-02-29'), false);
const created = C.createProject(draft);
assert.equal(C.listProjects().length, 1);
assert.equal(
  C.normaliseEvidence('afforest', { species: '  Native species  ', planted: '100', unknown: 'ignored' })
    .planted,
  100,
);
assert.equal(C.normaliseEvidence('afforest', { species: '  Native species  ' }).species, 'Native species');
assert.equal(Object.keys(C.normaliseEvidence('solar', { unknown: 'ignored', capacityKwp: '' })).length, 0);
assert.throws(() => C.normaliseEvidence('afforest', { planted: '3.5' }));
assert.throws(() => C.normaliseEvidence('solar', { capacityKwp: 'Infinity' }));
assert.throws(() => C.normaliseEvidence('solar', { capacityKwp: -1 }));
assert.throws(() => C.normaliseEvidence('ev', { chargers: true }));
created.title = 'mutated';
assert.equal(C.listProjects()[0].title, draft.title, 'callers cannot mutate stored drafts');
assert.equal(C.validateLink(created.id, 'afforest', 6), created.id);
assert.throws(() => C.validateLink(created.id, 'solar', 6));
assert.throws(() => C.validateLink(created.id, 'afforest', 0));
assert.equal(C.projectFor(created.id).submissions.length, 0);
const original = {
  ...P.submissions[0],
  id: 'PA-9998',
  projectId: created.id,
  action: 'afforest',
  city: 6,
  status: 'verified',
  forensics: {},
  time: new Date(2026, 10, 15),
};
P.submissions.unshift(original);
assert.equal(C.projectFor(created.id).submissions.length, 1, 'only explicit project IDs group submissions');
assert.equal(
  C.projectFor('record:' + P.submissions[1].id).submissions.length,
  1,
  'nearby seed records are standalone stories',
);
assert.equal(
  C.projectFor('record:' + P.submissions[1].id).observations.length,
  0,
  'no baseline/follow-up is invented for seed records',
);
assert.equal(C.reviewState(original).human, null, 'heuristic acceptance is not human review');
assert.equal(C.reviewState(original).followups, 0);
assert.throws(
  () => C.addObservation(created.id, { kind: 'baseline', date: '2026-11-16', note: 'Baseline at the site' }),
  /baseline date/,
);
assert.throws(
  () => C.addObservation(created.id, { kind: 'followup', date: '2026-11-14', note: 'Follow-up at the site' }),
  /follow-up date/,
);
assert.throws(
  () =>
    C.addObservation(created.id, { kind: 'followup', date: '2026-11-16', note: 'Later count', value: -1 }),
  /non-negative/,
);
assert.throws(() =>
  C.addObservation(created.id, {
    kind: 'followup',
    date: '2026-11-16',
    note: 'Later count',
    photo: 'https://external.example/photo.jpg',
  }),
);
C.addObservation(created.id, {
  kind: 'baseline',
  date: '2026-11-14',
  note: 'Existing habitat documented',
  photo: null,
});
assert.throws(() => C.validateLink(created.id, 'afforest', 6, '2026-11-13'), /project baseline/);
C.addObservation(created.id, {
  kind: 'followup',
  date: '2026-12-15',
  note: '30-day survival count at marked plots',
  value: 84,
});
assert.equal(C.reviewState(original).followups, 1);
assert.equal(C.reviewState(original).human, null, 'an outcome observation does not confer human validation');
assert.equal(
  C.reviewState({ ...original, time: new Date(2027, 0, 1) }).followups,
  0,
  'earlier site observations are not follow-up evidence for a later action',
);
assert.throws(() =>
  C.addObservation('record:' + P.submissions[1].id, {
    kind: 'baseline',
    date: '2026-11-01',
    note: 'Cannot edit an archival story',
  }),
);
assert.throws(() =>
  C.recordReview(original, { decision: 'verified', reviewer: 'A', note: 'Short', acknowledged: true }),
);
C.recordReview(original, {
  decision: 'rejected',
  reviewer: 'Field reviewer',
  note: 'Missing provenance; original event is not confirmed.',
  acknowledged: true,
});
original.status = 'rejected';
C.recordReview(original, {
  decision: 'verified',
  reviewer: 'Second reviewer',
  note: 'Additional explanation reviewed; limitations still apply.',
  acknowledged: true,
});
assert.equal(C.reviews(original.id).length, 2);
assert.equal(
  C.reviewState(original).automatic,
  'verified',
  'manual decisions cannot rewrite the original automated stage',
);
assert.equal(C.reviewState(original).human.decision, 'verified');
const snapshot = Object.fromEntries(env.storage),
  restored = environment(snapshot);
assert.equal(restored.C.listProjects().length, 1);
assert.equal(restored.C.projectFor(created.id).observations.length, 2);
assert.equal(restored.C.reviews(original.id).length, 2);
restored.P.submissions.push({ ...original, status: 'pending' });
restored.C.applyReviews();
assert.equal(
  restored.P.byId(original.id).status,
  'verified',
  'reviews restore decisions independently of the old registry',
);
env.failStorage(true);
assert.throws(() => C.createProject(draft), /No changes were committed/);
assert.equal(C.listProjects().length, 1);
assert.throws(() =>
  C.addObservation(created.id, {
    kind: 'followup',
    date: '2026-12-16',
    note: 'This should not be committed',
  }),
);
assert.equal(C.projectFor(created.id).observations.length, 2);
assert.throws(() =>
  C.recordReview(original, {
    decision: 'rejected',
    reviewer: 'Reviewer',
    note: 'This review cannot be stored.',
    acknowledged: true,
  }),
);
assert.equal(C.reviews(original.id).length, 2);
const corrupt = environment({ 'proof-community-v1': 'not json' });
assert.ok(corrupt.C.loadError);
assert.throws(() => corrupt.C.createProject(draft));
assert.equal(corrupt.storage.get('proof-community-v1'), 'not json');
console.log(
  'PASS: six bilingual guides; explicit project grouping; temporal/measurement validation; independent review stages; local persistence and atomic storage failure',
);
