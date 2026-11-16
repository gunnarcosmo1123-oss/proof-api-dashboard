'use strict';
let MAP_STATE = { country: null, city: null, date: null, from: null, to: null, action: null };
let MAP_VIEW = { x: -180, y: -85, w: 360, h: 170 };
let MAP_VIEW_MODE = 'map-gallery';
let MAP_PLAYER = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) MAP_PLAYER?.pause();
});

function buildMap() {
  MAP_PLAYER?.dispose();
  const sec = $('#tab-map');
  sec.replaceChildren();
  if (typeof MAP_DATA === 'undefined') {
    card(sec, t('map.title'), t('map.nomap'));
    return;
  }
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const btn = (text, click, cls = 'btn btn-ghost') => {
    const b = node('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', click);
    return b;
  };
  const label = (text, input) => {
    const l = node('label', 'mapx-field');
    l.append(node('span', '', text), input);
    return l;
  };
  const empty = (root) => root.appendChild(node('p', 'mapx-empty', t('map.list.empty')));
  const world = () => ({ x: -180, y: -85, w: 360, h: 170 });
  const countries = MAP_DATA.countries
    .slice()
    .sort((a, b) => mapCountryName(a).localeCompare(mapCountryName(b)));
  const countryLabel = (name) => {
    const c = countries.find((c) => c.name === name);
    return c ? mapCountryName(c) : name;
  };
  const scopeLabel = () =>
    MAP_STATE.city != null
      ? lb(PROOF.city(MAP_STATE.city)) + ' · ' + countryLabel(MAP_STATE.country)
      : MAP_STATE.country
        ? countryLabel(MAP_STATE.country)
        : t('an.hier.global');
  const periodLabel = () => ProofPeriod.label(MAP_STATE, LANG === 'zh');
  const hasPeriod = () => !!(MAP_STATE.date || MAP_STATE.from || MAP_STATE.to);
  const heading = node('div', 'cx-explore-heading');
  heading.appendChild(node('h2', '', ProofExperience.L('Explore community actions', '探索社区行动')));
  const modes = node('div', 'cx-view-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', ProofExperience.L('Explore view', '探索视图'));
  [
    ['map-gallery', ProofExperience.L('Map + gallery', '地图 + 图库')],
    ['gallery', ProofExperience.L('Gallery', '图库')],
    ['table', ProofExperience.L('Table', '表格')],
  ].forEach(([mode, title]) => {
    const choice = btn(title, () => {
      MAP_VIEW_MODE = mode;
      render();
      if (mode === 'map-gallery') focusLocation();
    });
    choice.dataset.view = mode;
    modes.appendChild(choice);
  });
  heading.appendChild(modes);
  heading.appendChild(
    btn(ProofExperience.L('Share view', '分享视图'), () => ProofTools.shareMap(MAP_STATE, MAP_VIEW_MODE)),
  );
  sec.appendChild(heading);
  const searchSlot = node('div', 'cx-explore-search');
  sec.appendChild(searchSlot);
  const kpis = node('div', 'kpi-grid');
  kpis.id = 'map-kpis';
  sec.appendChild(kpis);
  const layout = node('div', 'map-layout');
  sec.appendChild(layout);
  const mapCard = card(layout, t('map.title'), t('mapx.mapHint'));
  const rankCard = card(layout, t('map.rank'), t('mapx.rankHint'));
  rankCard.root.classList.add('mapx-ranking');
  const tools = node('div', 'mapx-tools');
  mapCard.body.appendChild(tools);
  const searchBox = node('div', 'mapx-search');
  searchSlot.appendChild(searchBox);
  const search = node('input', 'txt-in');
  search.type = 'search';
  search.placeholder = t('mapx.search');
  search.setAttribute('aria-label', t('mapx.search'));
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-controls', 'mapx-search-results');
  search.setAttribute('aria-expanded', 'false');
  search.setAttribute('aria-autocomplete', 'list');
  const results = node('div', 'mapx-search-results');
  results.id = 'mapx-search-results';
  results.setAttribute('role', 'listbox');
  results.hidden = true;
  searchBox.append(search, results);
  const viewTools = node('div', 'mapx-view-tools');
  tools.appendChild(viewTools);
  viewTools.append(
    btn('+', () => zoom(0.65)),
    btn('−', () => zoom(1.5)),
    btn(t('mapx.fit'), () => {
      MAP_VIEW = world();
      applyView();
    }),
  );
  viewTools.children[0].setAttribute('aria-label', t('mapx.zoomIn'));
  viewTools.children[1].setAttribute('aria-label', t('mapx.zoomOut'));
  const mapHost = node('div', 'mapx-host');
  mapCard.body.appendChild(mapHost);
  const legend = node('div', 'map-legend');
  mapCard.body.appendChild(legend);

  const explorer = card(sec, t('mapx.explorer'), t('mapx.explorerHint'));
  explorer.root.id = 'map-explorer';
  const filters = node('div', 'mapx-filters');
  explorer.body.appendChild(filters);
  const countrySelect = node('select', 'txt-in');
  countrySelect.id = 'map-country-filter';
  const option = (select, value, text) => {
    const o = node('option', '', text);
    o.value = value;
    select.appendChild(o);
  };
  option(countrySelect, '', t('mapx.allCountries'));
  countries.forEach((c) => option(countrySelect, c.name, mapCountryName(c)));
  const citySelect = node('select', 'txt-in');
  citySelect.id = 'map-city-filter';
  filters.append(label(t('map.rank.col.country'), countrySelect), label(t('map.city.filter'), citySelect));
  filters.append(
    btn(t('mapx.reset'), () => {
      cancelPlayback();
      MAP_STATE = { country: null, city: null, date: null, from: null, to: null, action: null };
      MAP_VIEW = world();
      search.value = '';
      render();
    }),
  );
  const periodControls = ProofTools.periodControls(
    MAP_STATE,
    (period) => {
      cancelPlayback();
      Object.assign(MAP_STATE, period);
      render();
    },
    { id: 'map-date-filter', exactLabel: t('mapx.date') },
  );
  explorer.body.appendChild(periodControls.root);
  countrySelect.addEventListener('change', () => selectLocation(countrySelect.value || null, null));
  citySelect.addEventListener('change', () => {
    const i = citySelect.value === '' ? null : +citySelect.value;
    selectLocation(i == null ? MAP_STATE.country : PROOF.city(i).country.en, i);
  });
  const context = node('div', 'mapx-context');
  context.setAttribute('role', 'status');
  context.setAttribute('aria-live', 'polite');
  explorer.body.appendChild(context);
  const crumbs = node('div', 'hier-crumb');
  explorer.body.appendChild(crumbs);
  const dateStrip = node('div', 'dstrip mapx-dates');
  const playback = node('div', 'pt-playback');
  let playbackTimer = null,
    playbackDays = [],
    playbackIndex = -1,
    replayPeriod = null;
  const play = btn(ProofExperience.L('Play timeline', '播放时间线'), () => {
    if (playbackTimer) {
      pausePlayback();
      return;
    }
    if (!playbackDays.length) {
      replayPeriod = ProofPeriod.clean(MAP_STATE);
      playbackDays = [
        ...new Set(
          PROOF.scopeSubs(MAP_STATE.country, MAP_STATE.city, null, ProofPeriod.clean(MAP_STATE))
            .filter((s) => !MAP_STATE.action || s.action === MAP_STATE.action)
            .map((s) => PROOF.actionDate(s)),
        ),
      ].sort();
      playbackIndex = -1;
    }
    if (playbackIndex >= playbackDays.length - 1) playbackIndex = -1;
    if (!playbackDays.length) {
      playbackStatus.textContent = ProofExperience.L('No recorded days to replay.', '没有可播放的记录日期。');
      return;
    }
    function tick() {
      if (!sec.classList.contains('active') || document.hidden || !sec.isConnected) {
        pausePlayback();
        return;
      }
      playbackIndex++;
      Object.assign(MAP_STATE, { date: playbackDays[playbackIndex], from: null, to: null });
      if (playbackIndex === playbackDays.length - 1) pausePlayback();
      render();
    }
    playbackTimer = setInterval(tick, +speed.value);
    tick();
    updatePlayback();
  });
  const restorePeriod = btn(ProofExperience.L('Restore selected period', '恢复所选时段'), () => {
    const period = replayPeriod;
    cancelPlayback();
    Object.assign(MAP_STATE, period || ProofPeriod.clean({}));
    render();
  });
  restorePeriod.hidden = true;
  const speed = node('select', 'txt-in');
  [
    ['2000', '0.5×'],
    ['1000', '1×'],
    ['500', '2×'],
  ].forEach(([value, title]) => option(speed, value, title));
  speed.value = '1000';
  speed.setAttribute('aria-label', ProofExperience.L('Timeline speed', '时间线速度'));
  speed.addEventListener('change', pausePlayback);
  const playbackStatus = node('span', 'evidence-note');
  playbackStatus.setAttribute('role', 'status');
  playback.append(play, restorePeriod, speed, playbackStatus);
  explorer.body.appendChild(playback);
  explorer.body.appendChild(dateStrip);
  const actionMix = node('div', 'cx-action-mix');
  explorer.body.appendChild(actionMix);
  const overview = node('div', 'mapx-overview');
  const actions = node('div', 'mapx-action-list');
  explorer.body.appendChild(actions);
  explorer.body.appendChild(overview);
  const coverage = card(sec, t('mapx.coverage'), t('mapx.coverageHint'));
  coverage.root.id = 'map-coverage';
  let svg,
    dateSubs = [],
    scopedBase = [],
    scoped = [],
    suppressClick = false;

  function updatePlayback() {
    play.textContent = playbackTimer
      ? ProofExperience.L('Pause timeline', '暂停时间线')
      : ProofExperience.L('Play timeline', '播放时间线');
    play.setAttribute('aria-pressed', String(!!playbackTimer));
    restorePeriod.hidden = !replayPeriod;
    playbackStatus.textContent = replayPeriod
      ? playbackIndex + 1 + ' / ' + playbackDays.length + ' · ' + periodLabel()
      : ProofExperience.L(
          'Replay recorded days within the selected period. Pause keeps the displayed day.',
          '播放所选时段内有记录的日期；暂停后保留当前日期。',
        );
  }
  function pausePlayback() {
    clearInterval(playbackTimer);
    playbackTimer = null;
    updatePlayback();
  }
  function cancelPlayback() {
    pausePlayback();
    playbackDays = [];
    playbackIndex = -1;
    replayPeriod = null;
    updatePlayback();
  }
  MAP_PLAYER = { pause: pausePlayback, dispose: () => clearInterval(playbackTimer) };

  function selectLocation(country, city) {
    cancelPlayback();
    MAP_STATE.country = country;
    MAP_STATE.city = city;
    search.value = country ? scopeLabel() : '';
    results.hidden = true;
    search.setAttribute('aria-expanded', 'false');
    render();
    focusLocation();
  }
  function normal(s) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  function searchMatches() {
    const q = normal(search.value);
    if (!q) return [];
    return countries
      .map((c) => ({
        country: c.name,
        city: null,
        text: mapCountryName(c),
        aliases: c.name + ' ' + (c.zh || ''),
      }))
      .concat(
        PROOF.cities.map((c, i) => ({
          country: c.country.en,
          city: i,
          text: lb(c) + ' · ' + lb(c.country),
          aliases: c.en + ' ' + c.zh + ' ' + c.country.en + ' ' + c.country.zh,
        })),
      )
      .filter((c) => normal(c.aliases).includes(q))
      .sort((a, b) => Number(normal(b.text) === q) - Number(normal(a.text) === q))
      .slice(0, 10);
  }
  function showResults() {
    results.replaceChildren();
    if (!search.value.trim()) {
      results.hidden = true;
      search.setAttribute('aria-expanded', 'false');
      return;
    }
    const matches = searchMatches();
    results.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    if (!matches.length) results.appendChild(node('p', '', t('mapx.noSearch')));
    matches.forEach((match) => {
      const b = btn(match.text, () => selectLocation(match.country, match.city), 'mapx-search-option');
      b.prepend(ProofTools.icon(match.city == null ? 'map' : 'location'));
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      results.appendChild(b);
    });
  }
  search.addEventListener('input', showResults);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      results.hidden = true;
      search.setAttribute('aria-expanded', 'false');
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      showResults();
      results.querySelector('button')?.focus();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const match = searchMatches()[0];
      if (match) selectLocation(match.country, match.city);
      else showResults();
    }
  });
  results.addEventListener('keydown', (e) => {
    const options = [...results.querySelectorAll('button')],
      i = options.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      options[(i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]?.focus();
    }
    if (e.key === 'Escape') {
      results.hidden = true;
      search.setAttribute('aria-expanded', 'false');
      search.focus();
    }
  });
  searchBox.addEventListener('focusout', (e) => {
    if (!searchBox.contains(e.relatedTarget)) {
      results.hidden = true;
      search.setAttribute('aria-expanded', 'false');
    }
  });

  function constrain(v) {
    v.w = Math.min(360, Math.max(6, v.w));
    v.h = (v.w * 170) / 360;
    v.x = Math.max(-180, Math.min(180 - v.w, v.x));
    v.y = Math.max(-85, Math.min(85 - v.h, v.y));
    return v;
  }
  function applyView() {
    if (!svg) return;
    MAP_VIEW = constrain(MAP_VIEW);
    svg.setAttribute('viewBox', [MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.w, MAP_VIEW.h].join(' '));
    svg
      .querySelectorAll('[data-radius]')
      .forEach((c) => c.setAttribute('r', (+c.dataset.radius * MAP_VIEW.w) / 360));
    svg.querySelectorAll('.mapx-city-label').forEach((n) => {
      n.setAttribute('font-size', (4 * MAP_VIEW.w) / 360);
      n.setAttribute('dy', (-9 * MAP_VIEW.w) / 360);
    });
  }
  function zoom(factor) {
    const v = MAP_VIEW,
      w = Math.max(6, Math.min(360, v.w * factor)),
      h = (w * 170) / 360;
    MAP_VIEW = { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    applyView();
  }
  function focusLocation() {
    if (layout.hidden) return;
    if (MAP_STATE.city != null) {
      const c = PROOF.city(MAP_STATE.city);
      MAP_VIEW = { x: c.lon - 10, y: -c.lat - 170 / 36, w: 20, h: 170 / 18 };
    } else if (MAP_STATE.country) {
      const p = [...svg.querySelectorAll('.map-path')].find((p) => p.dataset.country === MAP_STATE.country);
      if (p) {
        const b = p.getBBox(),
          w = Math.min(360, Math.max(10, b.width * 1.3, (b.height * 1.3 * 360) / 170));
        MAP_VIEW = {
          x: b.x + b.width / 2 - w / 2,
          y: b.y + b.height / 2 - (w * 170) / 720,
          w,
          h: (w * 170) / 360,
        };
      }
    } else MAP_VIEW = world();
    applyView();
  }
  function keyboardActivate(n, fn) {
    n.setAttribute('role', 'button');
    n.setAttribute('tabindex', '0');
    n.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    });
    n.addEventListener('click', () => {
      if (!suppressClick) fn();
    });
  }
  function renderSvg() {
    hideTip();
    mapHost.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const svgn = (tag, attrs) => {
      const n = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      return n;
    };
    svg = svgn('svg', { 'aria-label': t('map.title'), role: 'group' });
    svg.classList.add('map-svg');
    svg.appendChild(svgn('rect', { x: -180, y: -90, width: 360, height: 180, fill: '#f7f9fb' }));
    const stats = PROOF.mapCountryStats(dateSubs),
      fill = (n) => (n ? RAMP_BLUE[Math.min(12, Math.ceil(Math.log2(n + 1) * 2))] : '#eef1f4');
    countries.forEach((c) => {
      const st = stats[c.name],
        selected = MAP_STATE.country === c.name,
        active = !!(st && st.total);
      const p = svgn('path', {
        d: c.d,
        fill: active ? (st.verified ? fill(st.verified) : '#fff2cf') : '#eef1f4',
        stroke: selected ? '#172f48' : hasPeriod() && active ? '#b66a05' : '#cdd4dc',
        'stroke-width': selected ? 2 : hasPeriod() && active ? 1.4 : 0.5,
        'vector-effect': 'non-scaling-stroke',
      });
      p.classList.add('map-path');
      p.dataset.country = c.name;
      p.dataset.active = String(active);
      p.setAttribute(
        'aria-label',
        mapCountryName(c) + ' · ' + (st ? st.total : 0) + ' ' + t('map.kpi.total'),
      );
      p.setAttribute('aria-pressed', String(selected));
      keyboardActivate(p, () => selectLocation(c.name, null));
      const title = svgn('title', {});
      title.textContent = mapCountryName(c);
      p.appendChild(title);
      p.addEventListener('mousemove', (e) => {
        if (drag) return;
        showTip(
          mapHost,
          e,
          [{ title: mapCountryName(c) }].concat(
            st
              ? ['verified', 'flagged', 'rejected', 'pending'].map((k) => ({
                  color: PROOF.statuses[k].color,
                  name: t('status.' + k),
                  value: String(st[k]),
                }))
              : [{ name: t('map.list.empty'), value: '0' }],
          ),
        );
      });
      p.addEventListener('mouseleave', hideTip);
      p.addEventListener('mouseenter', () => highlightCountry(c.name));
      p.addEventListener('mouseleave', () => highlightCity(null));
      p.addEventListener('focus', () => highlightCountry(c.name));
      p.addEventListener('blur', () => highlightCity(null));
      svg.appendChild(p);
    });
    PROOF.cities.forEach((c, i) => {
      const list = dateSubs.filter((s) => s.city === i),
        selected = MAP_STATE.city === i;
      if (!list.length && !selected) return;
      const g = svgn('g', {
        'aria-label': lb(c) + ' · ' + list.length + ' ' + t('map.kpi.total'),
        'aria-pressed': String(selected),
      });
      g.classList.add('map-pin');
      g.dataset.city = i;
      const r = 3 + Math.sqrt(list.length) * 0.8;
      [r + 2, r].forEach((radius, j) => {
        const dot = svgn('circle', {
          cx: c.lon,
          cy: -c.lat,
          fill: j ? '#2a78d6' : 'rgba(42,120,214,.17)',
          stroke: j ? (selected ? '#172f48' : 'white') : 'none',
          'stroke-width': selected ? 2 : 1,
          'vector-effect': 'non-scaling-stroke',
        });
        dot.dataset.radius = radius;
        g.appendChild(dot);
      });
      keyboardActivate(g, () => selectLocation(c.country.en, i));
      const title = svgn('title', {});
      title.textContent = lb(c);
      g.appendChild(title);
      g.addEventListener('mousemove', (e) => {
        if (!drag)
          showTip(mapHost, e, [
            { title: lb(c) + ' · ' + lb(c.country) },
            { name: t('map.kpi.total'), value: String(list.length) },
          ]);
      });
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('mouseenter', () => highlightCity(i));
      g.addEventListener('mouseleave', () => highlightCity(null));
      g.addEventListener('focus', () => highlightCity(i));
      g.addEventListener('blur', () => highlightCity(null));
      svg.appendChild(g);
      if (selected) {
        const text = svgn('text', {
          x: c.lon,
          y: -c.lat,
          'text-anchor': 'middle',
          fill: '#172f48',
          'pointer-events': 'none',
        });
        text.classList.add('mapx-city-label');
        text.textContent = lb(c);
        svg.appendChild(text);
      }
    });
    mapHost.appendChild(svg);
    applyView();
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, view: { ...MAP_VIEW }, moved: false };
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) < 6 && !drag.moved) return;
      drag.moved = true;
      hideTip();
      svg.setPointerCapture(e.pointerId);
      const box = svg.getBoundingClientRect();
      MAP_VIEW = {
        ...drag.view,
        x: drag.view.x - (dx * drag.view.w) / box.width,
        y: drag.view.y - (dy * drag.view.h) / box.height,
      };
      applyView();
    });
    const endDrag = () => {
      if (drag?.moved) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
      drag = null;
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('pointerleave', () => {
      if (drag && !drag.moved) drag = null;
    });
    legend.replaceChildren(node('span', '', t('map.legend')));
    [0, 1, 2, 4, 8, 16].forEach((v) => {
      const sw = node('span', 'swatch');
      sw.style.background = fill(v);
      sw.title = String(v);
      legend.appendChild(sw);
    });
    legend.appendChild(node('span', '', t('map.pin.hint')));
    if (hasPeriod()) legend.appendChild(node('b', 'mapx-date-key', t('mapx.highlight')));
  }
  function statTable(root, rows, choose, compact = false) {
    if (!rows.length) {
      empty(root);
      return;
    }
    const wrap = node('div', 'chart-table'),
      table = node('table'),
      head = node('thead'),
      tr = node('tr');
    (compact
      ? ['map.rank.col.country', 'map.kpi.verified', 'map.kpi.dup', 'map.kpi.rejected', 'map.kpi.avg']
      : [
          'mapx.location',
          'map.kpi.total',
          'map.kpi.verified',
          'map.kpi.dup',
          'map.kpi.rejected',
          'mapx.pending',
          'map.kpi.avg',
        ]
    ).forEach((k) => tr.appendChild(node('th', '', t(k))));
    head.appendChild(tr);
    table.appendChild(head);
    const body = node('tbody');
    rows.forEach((r) => {
      const tr = node('tr');
      tr.dataset.key = r.key;
      const cell = node('td');
      cell.appendChild(btn(r.name ? lb(r.name) : t('map.individual'), () => choose(r), 'link-btn'));
      tr.appendChild(cell);
      (compact
        ? [r.verified, r.flagged, r.rejected, r.count ? fmtNum(r.avg, 1) : '—']
        : [r.count, r.verified, r.flagged, r.rejected, r.pending, r.count ? fmtNum(r.avg, 1) : '—']
      ).forEach((v, i) =>
        tr.appendChild(
          node(
            'td',
            (compact ? i < 3 : i > 0 && i < 5)
              ? 'mapx-status-' +
                  (compact
                    ? ['verified', 'flagged', 'rejected']
                    : ['', 'verified', 'flagged', 'rejected', 'pending'])[i]
              : '',
            String(v),
          ),
        ),
      );
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    root.appendChild(wrap);
  }
  function renderRanking() {
    rankCard.body.replaceChildren();
    rankCard.root.querySelector('.card-sub').textContent = periodLabel() + ' · ' + t('mapx.rankHint');
    statTable(rankCard.body, PROOF.countryRows(dateSubs), (r) => selectLocation(r.key, null), true);
    rankCard.body.querySelectorAll('tr[data-key]').forEach((r) => {
      if (r.dataset.key === MAP_STATE.country) r.classList.add('mapx-selected-row');
    });
  }
  function renderDates() {
    dateStrip.replaceChildren();
    const geo = PROOF.scopeSubs(MAP_STATE.country, MAP_STATE.city, null).filter(
        (s) => !MAP_STATE.action || s.action === MAP_STATE.action,
      ),
      days = {};
    geo.forEach((s) => {
      const k = PROOF.actionDate(s);
      days[k] = (days[k] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(days));
    Object.keys(days)
      .sort()
      .forEach((d) => {
        const b = btn(
          '',
          () => {
            cancelPlayback();
            Object.assign(MAP_STATE, { date: MAP_STATE.date === d ? null : d, from: null, to: null });
            render();
          },
          'dbar' + (hasPeriod() && ProofPeriod.matches(d, MAP_STATE) ? ' sel' : ''),
        );
        b.setAttribute('aria-label', d + ' · ' + days[d] + ' ' + t('map.kpi.total'));
        b.setAttribute('aria-pressed', String(hasPeriod() && ProofPeriod.matches(d, MAP_STATE)));
        const bar = node('span', 'bar'),
          seg = node('span', 'seg');
        seg.style.height = (days[d] / max) * 64 + 'px';
        seg.style.background = '#2a78d6';
        bar.appendChild(seg);
        b.append(bar, node('span', 'lbl', d.slice(5)));
        dateStrip.appendChild(b);
      });
  }
  function renderOverview() {
    overview.replaceChildren();
    const title = node('div', 'mapx-heading');
    title.appendChild(node('h4', '', scopeLabel() + ' · ' + t('mapx.analytics')));
    title.appendChild(btn(t('mapx.openAnalytics'), () => window.__openMapAnalytics({ ...MAP_STATE })));
    overview.appendChild(title);
    const metrics = node('div', 'mapx-measures');
    ['auth', 'action', 'loc'].forEach((k) => {
      const avg = scoped.length ? fmtNum(scoped.reduce((a, s) => a + s.subs[k], 0) / scoped.length, 1) : '—';
      const n = node('div');
      n.append(node('span', '', t('qc.' + k)), node('b', '', avg));
      metrics.appendChild(n);
    });
    overview.appendChild(metrics);
    const breakdown = node('div', 'mapx-breakdown');
    overview.appendChild(breakdown);
    const rows =
      MAP_STATE.city != null
        ? PROOF.orgRows(MAP_STATE.city, scoped)
        : MAP_STATE.country
          ? PROOF.cityRows(MAP_STATE.country, scoped)
          : PROOF.countryRows(scoped);
    statTable(breakdown, rows, (r) => {
      if (MAP_STATE.city != null) {
        window.__openMapAnalytics({ ...MAP_STATE });
        HIER.org = r.key;
        HIER.level = 3;
        window.__renderAnalytics();
      } else if (MAP_STATE.country) selectLocation(MAP_STATE.country, r.key);
      else selectLocation(r.key, null);
    });
  }
  function highlightCity(city) {
    const country = city == null ? null : PROOF.city(city).country.en;
    mapHost
      .querySelectorAll('.map-pin')
      .forEach((pin) => pin.classList.toggle('is-linked', city != null && +pin.dataset.city === city));
    mapHost
      .querySelectorAll('.map-path')
      .forEach((path) =>
        path.classList.toggle('is-linked', country != null && path.dataset.country === country),
      );
    actions
      .querySelectorAll('[data-submission]')
      .forEach((card) => card.classList.toggle('is-linked', city != null && +card.dataset.city === city));
  }
  function highlightCountry(country) {
    mapHost
      .querySelectorAll('.map-path')
      .forEach((path) => path.classList.toggle('is-linked', path.dataset.country === country));
    actions
      .querySelectorAll('[data-submission]')
      .forEach((card) =>
        card.classList.toggle('is-linked', PROOF.city(+card.dataset.city).country.en === country),
      );
  }
  function renderActionMix() {
    actionMix.replaceChildren();
    actionMix.appendChild(node('h4', '', ProofExperience.L('Filter by action type', '按行动类型筛选')));
    const all = btn(
      ProofExperience.L('All action types', '所有行动类型'),
      () => {
        cancelPlayback();
        MAP_STATE.action = null;
        render();
      },
      'chip' + (!MAP_STATE.action ? ' active' : ''),
    );
    actionMix.appendChild(all);
    const chart = node('div', 'cx-mix-bars');
    const max = Math.max(1, ...PROOF.actions.map((a) => scopedBase.filter((s) => s.action === a.key).length));
    PROOF.actions.forEach((action) => {
      const count = scopedBase.filter((s) => s.action === action.key).length;
      const bar = btn(
        '',
        () => {
          cancelPlayback();
          MAP_STATE.action = MAP_STATE.action === action.key ? null : action.key;
          render();
        },
        'cx-mix-bar',
      );
      bar.dataset.actionFilter = action.key;
      bar.setAttribute('aria-pressed', String(MAP_STATE.action === action.key));
      bar.setAttribute('aria-label', t('act.' + action.key) + ' · ' + count);
      const track = node('span', 'cx-mix-track'),
        fill = node('span');
      fill.style.width = (count / max) * 100 + '%';
      track.appendChild(fill);
      bar.append(node('span', '', t('act.' + action.key)), track, node('b', '', String(count)));
      chart.appendChild(bar);
    });
    actionMix.appendChild(chart);
  }
  function renderActions() {
    actions.replaceChildren(node('h4', '', t('map.list.title') + ' · ' + scoped.length));
    if (!scoped.length) {
      empty(actions);
      return;
    }
    const records = scoped.slice().sort((a, b) => b.time - a.time);
    if (MAP_VIEW_MODE !== 'table') {
      const gallery = node('div', 'cx-gallery');
      records.forEach((s) => {
        const card = ProofExperience.actionCard(
          s,
          () => ProofExperience.openStory(s.projectId || 'record:' + s.id),
          highlightCity,
        );
        card.classList.add('mapx-project');
        gallery.appendChild(card);
      });
      actions.appendChild(gallery);
    } else {
      const wrap = node('div', 'chart-table'),
        table = node('table'),
        head = node('thead'),
        row = node('tr');
      [
        ProofExperience.L('Action record', '行动记录'),
        t('mapx.location'),
        t('mapx.date'),
        ProofExperience.L('Evidence stage', '证据阶段'),
        t('map.kpi.avg'),
      ].forEach((title) => row.appendChild(node('th', '', title)));
      head.appendChild(row);
      table.appendChild(head);
      const body = node('tbody');
      records.forEach((s) => {
        const row = node('tr', 'mapx-project');
        row.dataset.submission = s.id;
        row.dataset.city = s.city;
        const name = node('td');
        name.appendChild(
          btn(
            s.id + ' · ' + t('act.' + s.action),
            () => ProofExperience.openStory(s.projectId || 'record:' + s.id),
            'link-btn',
          ),
        );
        row.append(name, node('td', '', lb(PROOF.city(s.city))), node('td', '', PROOF.actionDate(s)));
        const stage = node('td');
        stage.append(lvBadge(s.status), ProofExperience.decisionBadge(s));
        row.append(stage, node('td', '', String(s.score)));
        row.addEventListener('mouseenter', () => highlightCity(s.city));
        row.addEventListener('mouseleave', () => highlightCity(null));
        body.appendChild(row);
      });
      table.appendChild(body);
      wrap.appendChild(table);
      actions.appendChild(wrap);
    }
  }
  function renderCoverage() {
    coverage.body.replaceChildren();
    const report = PROOF.actionCoverage(scopedBase);
    coverage.body.appendChild(node('p', 'mapx-integrity', t('mapx.caution')));
    coverage.body.appendChild(
      node(
        'p',
        'mapx-coverage-scope',
        scopeLabel() + ' · ' + periodLabel() + ' · ' + report.verified + ' ' + t('map.kpi.verified'),
      ),
    );
    if (report.verified < 4)
      coverage.body.appendChild(
        node('p', 'mapx-small-sample', t(report.verified ? 'mapx.limited' : 'mapx.noVerified')),
      );
    const grid = node('div', 'mapx-coverage-grid');
    coverage.body.appendChild(grid);
    report.groups.forEach((group) => {
      const box = node('div', 'mapx-coverage-card');
      const heading = node('h4', '', t('mapx.' + group.key));
      heading.prepend(
        ProofTools.icon({ environment: 'afforest', energy: 'solar', buildings: 'retrofit' }[group.key]),
      );
      box.appendChild(heading);
      group.actions.forEach((a) => {
        const item = node('div', 'mapx-coverage-action');
        item.dataset.action = a.key;
        const line = node('div', 'mapx-heading');
        line.append(node('b', '', t('act.' + a.key)), node('span', '', a.verified + ' / ' + a.recorded));
        item.appendChild(line);
        const meter = node('meter');
        meter.min = 0;
        meter.max = 100;
        meter.value = a.share;
        meter.setAttribute('aria-label', t('act.' + a.key) + ' · ' + t('mapx.share'));
        item.appendChild(meter);
        item.append(
          node(
            'p',
            a.verified && (report.verified < 4 || a.share >= 10) ? 'mapx-recorded' : 'mapx-missing',
            t(
              a.verified
                ? report.verified >= 4 && a.share < 10
                  ? 'mapx.lowCoverage'
                  : 'mapx.recorded'
                : 'mapx.missing',
            ),
          ),
          node('small', '', fmtNum(a.share, 0) + '% · ' + t('mapx.share')),
        );
        if (report.verified && (!a.verified || (report.verified >= 4 && a.share < 10)))
          item.appendChild(node('p', 'mapx-suggestion', t('mapx.suggest.' + a.key)));
        item.appendChild(
          btn(
            ProofExperience.L('Explore this activity →', '探索此活动 →'),
            () => ProofExperience.starter(a.key, { country: MAP_STATE.country, city: MAP_STATE.city }),
            'link-btn cx-starter-link',
          ),
        );
        box.appendChild(item);
      });
      grid.appendChild(box);
    });
    coverage.body.appendChild(node('p', 'evidence-note', t('mapx.ratios')));
    coverage.body.appendChild(
      node(
        'p',
        'evidence-note',
        ProofExperience.L(
          'Coverage includes all action types for this place and date. The action-type filter applies to the activity results, map and ranking.',
          '覆盖统计包含此地点和日期的所有行动类型。行动类型筛选用于活动结果、地图和排行。',
        ),
      ),
    );
  }
  function render() {
    scopedBase = PROOF.scopeSubs(MAP_STATE.country, MAP_STATE.city, null, ProofPeriod.clean(MAP_STATE));
    scoped = scopedBase.filter((s) => !MAP_STATE.action || s.action === MAP_STATE.action);
    dateSubs = PROOF.scopeSubs(null, null, null, ProofPeriod.clean(MAP_STATE)).filter(
      (s) => !MAP_STATE.action || s.action === MAP_STATE.action,
    );
    layout.hidden = MAP_VIEW_MODE !== 'map-gallery';
    modes.querySelectorAll('[data-view]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.view === MAP_VIEW_MODE));
    });
    sec.dataset.view = MAP_VIEW_MODE;
    countrySelect.value = MAP_STATE.country || '';
    citySelect.replaceChildren();
    option(citySelect, '', t('map.city.all'));
    PROOF.cities.forEach((c, i) => {
      if (!MAP_STATE.country || c.country.en === MAP_STATE.country)
        option(citySelect, String(i), lb(c) + (MAP_STATE.country ? '' : ' · ' + lb(c.country)));
    });
    citySelect.value = MAP_STATE.city == null ? '' : String(MAP_STATE.city);
    periodControls.sync(MAP_STATE);
    updatePlayback();
    context.textContent =
      scopeLabel() +
      ' · ' +
      periodLabel() +
      ' · ' +
      scoped.length +
      ' ' +
      t('map.kpi.total') +
      (MAP_STATE.action ? ' · ' + t('act.' + MAP_STATE.action) : '');
    crumbs.replaceChildren(
      btn(
        t('an.hier.global'),
        () => selectLocation(null, null),
        'chip' + (!MAP_STATE.country ? ' active' : ''),
      ),
    );
    if (MAP_STATE.country)
      crumbs.appendChild(
        btn(
          countryLabel(MAP_STATE.country),
          () => selectLocation(MAP_STATE.country, null),
          'chip' + (MAP_STATE.city == null ? ' active' : ''),
        ),
      );
    if (MAP_STATE.city != null)
      crumbs.appendChild(node('span', 'chip active', lb(PROOF.city(MAP_STATE.city))));
    const summary = PROOF._rowStat('scope', null, null, scoped);
    kpis.replaceChildren();
    [
      ['map.kpi.total', summary.count],
      ['map.kpi.verified', summary.verified],
      ['map.kpi.dup', summary.flagged],
      ['map.kpi.rejected', summary.rejected],
      ['map.kpi.avg', summary.count ? fmtNum(summary.avg, 1) : '—'],
    ].forEach(([key, value]) =>
      kpis.appendChild(
        statTile({
          label: t(key),
          value,
          delta: scopeLabel() + ' · ' + periodLabel(),
          deltaCls: 'plain',
        }),
      ),
    );
    renderSvg();
    renderRanking();
    renderDates();
    renderOverview();
    renderActions();
    renderActionMix();
    renderCoverage();
  }
  window.__renderMap = () => {
    cancelPlayback();
    render();
    if (MAP_STATE.country) focusLocation();
  };
  render();
  if (MAP_STATE.country) focusLocation();
}
