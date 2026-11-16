'use strict';
/* Calendar-day filters and auditable regional measures. No network or DOM. */
globalThis.ProofPeriod = (() => {
  function valid(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }
  function today() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }
  function shift(value, days) {
    if (!valid(value)) throw new Error('Invalid calendar date');
    const d = new Date(value + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function clean(state = {}) {
    state = state || {};
    if (typeof state === 'string') state = { date: state };
    if (valid(state.date)) return { date: state.date, from: null, to: null };
    const from = valid(state.from) ? state.from : null,
      to = valid(state.to) ? state.to : null;
    if (from && to && from > to) return { date: null, from: null, to: null };
    return { date: null, from, to };
  }
  function matches(date, period) {
    const p = clean(period);
    return (!p.date || date === p.date) && (!p.from || date >= p.from) && (!p.to || date <= p.to);
  }
  function recent(days, end = today()) {
    return { date: null, from: shift(end, 1 - days), to: end };
  }
  function label(period, zh = false) {
    const p = clean(period);
    return (
      p.date ||
      (p.from || p.to
        ? (p.from || (zh ? '最早' : 'Earliest')) + ' → ' + (p.to || (zh ? '最新' : 'Latest'))
        : zh
          ? '所有日期'
          : 'All dates')
    );
  }
  return { valid, today, shift, clean, matches, recent, label };
})();

globalThis.ProofInsights = (() => {
  function summarise(records) {
    const local = records.filter((s) => !!s.forensics);
    const documented = local.filter((s) => {
      const guide = ProofCommunity.guides[s.action],
        fields = guide?.fields || [];
      const values = s.actionEvidence || {};
      return (
        !!(s.thumb || s.photo) &&
        ProofPeriod.valid(PROOF.actionDate(s)) &&
        Number.isInteger(s.city) &&
        !!PROOF.cities[s.city] &&
        fields.length > 0 &&
        fields.every(
          (f) => values[f.key] !== undefined && values[f.key] !== null && String(values[f.key]).trim() !== '',
        )
      );
    });
    const states = records.map((s) => ProofCommunity.reviewState(s));
    return {
      total: records.length,
      accepted: records.filter((s) => s.status === 'verified').length,
      human: states.filter((s) => !!s.human).length,
      followup: states.filter((s) => s.followups > 0).length,
      local: local.length,
      seed: records.length - local.length,
      documented: documented.length,
      actions: PROOF.actions.map((a) => ({
        key: a.key,
        count: records.filter((s) => s.action === a.key).length,
      })),
    };
  }
  function summary(project, options = {}) {
    const personal = !!options.personal,
      photos = !!options.photos,
      coordinates = !!options.coordinates;
    const numericEvidence = (values) =>
      Object.fromEntries(Object.entries(values || {}).filter(([, v]) => personal || typeof v === 'number'));
    const records = project.submissions || [];
    return {
      schema: 'proof-project-summary/1',
      exportedAt: new Date().toISOString(),
      scope: 'Local browser records; not third-party certification or measured climate impact.',
      integrity: 'a single photo proves an action happened, not that it worked',
      limitations:
        'Photos alone do not authenticate events. Dates, cities, measurements and reviewer identity are self-reported. Missing records do not establish that no action occurred. Original photo bytes, EXIF and file hashes are never included in this summary.',
      project: {
        id: project.id,
        action: project.action,
        city: PROOF.city(project.city).en,
        country: PROOF.city(project.city).country.en,
        plannedDate: project.date || null,
        ...(personal
          ? { title: project.title, community: project.community, plan: project.plan, budget: project.budget }
          : {}),
      },
      counts: summarise(records),
      records: records.map((s) => {
        const state = ProofCommunity.reviewState(s);
        return {
          id: s.id,
          action: s.action,
          date: PROOF.actionDate(s),
          city: PROOF.city(s.city).en,
          source: s.forensics ? 'local submission' : 'illustrative demo record',
          decision: s.status === 'verified' ? 'accepted' : s.status,
          automaticDecision: state.automatic,
          humanReviewRecorded: !!state.human,
          followupObservations: state.followups,
          selfReportedFields: numericEvidence(s.actionEvidence),
          ...(personal ? { submitter: s.submitter, review: state.human || null } : {}),
          ...(photos && s.thumb ? { photoPreview: s.thumb } : {}),
          ...(coordinates && s.deviceLocation ? { selfReportedDeviceLocation: s.deviceLocation } : {}),
        };
      }),
      observations: (project.observations || []).map((o) => ({
        kind: o.kind,
        date: o.date,
        value: o.value,
        source: o.source,
        ...(personal ? { note: o.note } : {}),
        ...(photos && o.photo ? { photoPreview: o.photo } : {}),
      })),
      included: {
        personalDetailsAndFreeText: personal,
        photoPreviews: photos,
        deviceCoordinates: coordinates,
      },
    };
  }
  function mapLink(base, state, mode, lang) {
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    const q = url.searchParams;
    q.set('tab', 'map');
    q.set('lang', lang === 'zh' ? 'zh' : 'en');
    if (state.country) q.set('map-country', state.country);
    if (state.city != null && PROOF.cities[state.city]) q.set('map-city', PROOF.city(state.city).en);
    const p = ProofPeriod.clean(state);
    ['date', 'from', 'to'].forEach((k) => {
      if (p[k]) q.set('map-' + k, p[k]);
    });
    if (PROOF.actions.some((a) => a.key === state.action)) q.set('map-action', state.action);
    if (['gallery', 'table', 'map-gallery'].includes(mode)) q.set('map-view', mode);
    return url.href;
  }
  function readMapLink(base) {
    const q = new URL(base).searchParams;
    if (![...q.keys()].some((k) => k.startsWith('map-'))) return null;
    let country = q.get('map-country') || null;
    if (country && typeof MAP_DATA !== 'undefined' && !MAP_DATA.countries.some((c) => c.name === country))
      country = null;
    const city = PROOF.cities.findIndex(
      (c) => c.en === q.get('map-city') && (!country || c.country.en === country),
    );
    if (city >= 0) country = PROOF.city(city).country.en;
    const action = PROOF.actions.some((a) => a.key === q.get('map-action')) ? q.get('map-action') : null;
    const mode = ['gallery', 'table', 'map-gallery'].includes(q.get('map-view'))
      ? q.get('map-view')
      : 'map-gallery';
    return {
      state: {
        country,
        city: city >= 0 ? city : null,
        action,
        ...ProofPeriod.clean({ date: q.get('map-date'), from: q.get('map-from'), to: q.get('map-to') }),
      },
      mode,
    };
  }
  return { summarise, summary, mapLink, readMapLink };
})();
