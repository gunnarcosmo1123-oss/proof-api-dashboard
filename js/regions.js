'use strict';
let REGION_STATE = { level: 'country', values: ['Malaysia', 'Kenya'], period: {}, action: null };

function buildRegions() {
  const T = ProofTools,
    { L, node: n, button: b, field } = T;
  const root = document.getElementById('tab-regions');
  root.replaceChildren();
  const head = n('div', 'pt-page-heading');
  head.append(
    n('span', 'cx-kicker', L('Compare recorded community action', '比较已记录社区行动')),
    n('h2', '', L('Regional comparison', '区域比较')),
    n(
      'p',
      '',
      L(
        'Compare countries or cities over the same dates. See where documentation is strong and where more follow-up is needed.',
        '在相同日期范围内比较国家或城市，了解记录较完整的领域和需要后续观测的领域。',
      ),
    ),
  );
  root.appendChild(head);
  const controls = card(
    root,
    L('Choose regions & period', '选择区域与时段'),
    L(
      'Choose two or three countries, or two or three cities. All use the same period.',
      '选择两至三个国家或两至三个城市；均使用相同时段。',
    ),
  );
  const line = n('div', 'pt-region-controls'),
    level = n('select', 'txt-in');
  [
    ['country', L('Countries', '国家')],
    ['city', L('Cities', '城市')],
  ].forEach(([key, title]) => {
    const o = n('option', '', title);
    o.value = key;
    level.appendChild(o);
  });
  level.value = REGION_STATE.level;
  line.appendChild(field(L('Compare by', '比较层级'), level));
  const action = n('select', 'txt-in');
  [
    { key: '', en: L('All action types', '所有行动类型') },
    ...PROOF.actions.map((a) => ({ key: a.key, en: t('act.' + a.key) })),
  ].forEach((a) => {
    const o = n('option', '', a.en);
    o.value = a.key;
    action.appendChild(o);
  });
  action.value = REGION_STATE.action || '';
  line.appendChild(field(L('Action type', '行动类型'), action));
  controls.body.appendChild(line);
  const places = n('div', 'pt-region-selectors');
  controls.body.appendChild(places);
  const period = T.periodControls(REGION_STATE.period, (value) => {
    REGION_STATE.period = value;
    renderResults();
  });
  controls.body.appendChild(period.root);
  const useMap = b(L('Use Action Map dates & action type', '使用行动地图的日期及行动类型'), () => {
    REGION_STATE.period = ProofPeriod.clean(MAP_STATE);
    REGION_STATE.action = MAP_STATE.action;
    action.value = REGION_STATE.action || '';
    period.sync(REGION_STATE.period);
    renderResults();
  });
  controls.body.appendChild(useMap);
  const error = n('p', 'pt-error');
  error.setAttribute('role', 'alert');
  controls.body.appendChild(error);
  const results = n('div', 'pt-region-results');
  results.setAttribute('aria-live', 'polite');
  root.appendChild(results);
  level.addEventListener('change', () => {
    REGION_STATE.level = level.value;
    REGION_STATE.values = level.value === 'country' ? ['Malaysia', 'Kenya'] : [9, 6];
    error.textContent = '';
    renderSelectors();
    renderResults();
  });
  action.addEventListener('change', () => {
    REGION_STATE.action = action.value || null;
    renderResults();
  });
  const options = () =>
    REGION_STATE.level === 'country'
      ? MAP_DATA.countries
          .slice()
          .sort((a, b) =>
            lb({ en: a.name, zh: a.zh || a.name }).localeCompare(lb({ en: b.name, zh: b.zh || b.name })),
          )
          .map((c) => ({ value: c.name, title: lb({ en: c.name, zh: c.zh || c.name }) }))
      : PROOF.cities.map((c, i) => ({ value: i, title: lb(c) + ' · ' + lb(c.country) }));
  const name = (value) => options().find((o) => String(o.value) === String(value))?.title || String(value);
  function renderSelectors() {
    places.replaceChildren();
    REGION_STATE.values.forEach((value, i) => {
      const box = n('div', 'pt-region-choice'),
        select = n('select', 'txt-in');
      options().forEach((o) => {
        const opt = n('option', '', o.title);
        opt.value = o.value;
        select.appendChild(opt);
      });
      select.value = value;
      select.addEventListener('change', () => {
        const next = REGION_STATE.level === 'city' ? +select.value : select.value;
        if (REGION_STATE.values.some((v, index) => index !== i && v === next)) {
          error.textContent = L('Choose different regions for each column.', '请为每列选择不同区域。');
          select.value = REGION_STATE.values[i];
          return;
        }
        error.textContent = '';
        REGION_STATE.values[i] = next;
        renderResults();
      });
      box.appendChild(field(L('Region ', '区域 ') + (i + 1), select));
      if (REGION_STATE.values.length > 2)
        box.appendChild(
          b(L('Remove region ', '移除区域 ') + (i + 1), () => {
            REGION_STATE.values.splice(i, 1);
            renderSelectors();
            renderResults();
          }),
        );
      places.appendChild(box);
    });
    if (REGION_STATE.values.length < 3)
      places.appendChild(
        b(L('Add a region', '添加区域'), () => {
          const next = options().find((o) => !REGION_STATE.values.includes(o.value));
          if (next) {
            REGION_STATE.values.push(next.value);
            renderSelectors();
            renderResults();
          }
        }),
      );
  }
  function showMap(value, actionKey = REGION_STATE.action) {
    const city = REGION_STATE.level === 'city' ? value : null;
    MAP_STATE = {
      country: city != null ? PROOF.city(city).country.en : value,
      city,
      action: actionKey,
      ...ProofPeriod.clean(REGION_STATE.period),
    };
    MAP_VIEW_MODE = 'map-gallery';
    window.__renderMap?.();
    switchTab('map');
  }
  function renderResults() {
    const samples = REGION_STATE.values.map((value) => {
      const records = PROOF.scopeSubs(
        REGION_STATE.level === 'country' ? value : null,
        REGION_STATE.level === 'city' ? value : null,
        null,
        ProofPeriod.clean(REGION_STATE.period),
      ).filter((s) => !REGION_STATE.action || s.action === REGION_STATE.action);
      return { value, records, stats: ProofInsights.summarise(records) };
    });
    results.replaceChildren();
    results.appendChild(
      n(
        'p',
        'pt-region-period',
        L('Shared period: ', '共同时段：') +
          ProofPeriod.label(REGION_STATE.period, LANG === 'zh') +
          ' · ' +
          (REGION_STATE.action ? t('act.' + REGION_STATE.action) : L('All action types', '所有行动类型')),
      ),
    );
    const caution = n('div', 'pt-reporting-note');
    caution.append(
      n('b', '', L('Recorded activity ≠ climate performance', '已记录活动 ≠ 气候绩效')),
      n(
        'p',
        '',
        L(
          'Counts reflect participation and reporting, not ecological need, population-adjusted effort or proven outcomes. Seed records are illustrative. Human review is self-declared and stored on this browser; missing documentation or follow-up is not evidence of failure.',
          '数量反映参与及报告情况，不代表生态需求、人均行动或已证明效果。演示记录仅作说明。人工复核为自行申报并保存在本浏览器；缺少记录或复查不证明项目失败。',
        ),
      ),
    );
    results.appendChild(caution);
    const overview = card(
      results,
      L('Evidence coverage', '证据覆盖'),
      L(
        'Every rate shows its numerator and denominator. Acceptance includes automated prototype decisions.',
        '每项比率都显示分子及分母。接纳状态包含自动原型判定。',
      ),
    );
    const wrap = n('div', 'chart-table'),
      table = n('table', 'pt-region-table'),
      thead = n('thead'),
      heading = n('tr');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', L('Regional evidence comparison table', '区域证据比较表'));
    overview.body.appendChild(
      n(
        'p',
        'pt-table-scroll-hint',
        L('Scroll the table horizontally to compare every region.', '横向滚动表格以比较所有区域。'),
      ),
    );
    heading.appendChild(n('th', '', L('Measure', '指标')));
    samples.forEach((sample) => {
      const th = n('th');
      th.appendChild(b(name(sample.value) + ' →', () => showMap(sample.value), 'link-btn'));
      heading.appendChild(th);
    });
    thead.appendChild(heading);
    table.appendChild(thead);
    const tbody = n('tbody');
    const rate = (num, denominator) =>
      denominator
        ? num + ' / ' + denominator + ' · ' + ((100 * num) / denominator).toFixed(0) + '%'
        : L('Not assessed · 0 eligible records', '未评估 · 0 条可评估记录');
    const rows = [
      ['total', L('Action records · sample size', '行动记录 · 样本量'), (s) => s.total],
      [
        'sources',
        L('Illustrative demo / local submissions', '演示记录 / 本地提交'),
        (s) => s.seed + ' / ' + s.local,
      ],
      [
        'accepted',
        L('Accepted records / all records', '接纳记录 / 所有记录'),
        (s) => rate(s.accepted, s.total),
      ],
      [
        'human',
        L('Human-reviewed records / all records', '人工复核记录 / 所有记录'),
        (s) => rate(s.human, s.total),
      ],
      [
        'documented',
        L('Complete documentation / local records', '完整记录 / 本地记录'),
        (s) => rate(s.documented, s.local),
      ],
      [
        'followup',
        L('Records with linked follow-up / all records', '有关联复查的记录 / 所有记录'),
        (s) => rate(s.followup, s.total),
      ],
      [
        'diversity',
        L('Action types represented / 6', '已记录行动类型 / 6'),
        (s) => s.actions.filter((a) => a.count > 0).length + ' / 6',
      ],
    ];
    rows.forEach(([key, title, format]) => {
      const row = n('tr');
      row.dataset.metric = key;
      row.appendChild(n('th', '', title));
      samples.forEach((s) => row.appendChild(n('td', '', String(format(s.stats)))));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    overview.body.appendChild(wrap);
    const definitions = n('details', 'pt-definitions');
    definitions.appendChild(n('summary', '', L('How these measures are calculated', '指标计算方法')));
    definitions.appendChild(
      n(
        'p',
        '',
        L(
          'Documentation is assessed only for local submissions with forensics: a photo preview, valid claimed date/city and every action-specific guide field filled in. This checks presence, not truth or quality; seed archive fields are not assessed. Human-review coverage counts records with an actual saved local review. Follow-up coverage counts records linked to a project with a self-reported follow-up on or after that action date, including follow-ups outside the selected action-date period. One project follow-up can cover multiple action records. A review does not establish independence, and follow-up does not establish causality.',
          '完整性仅评估含取证信息的本地提交：有照片预览、有效申报日期和城市，且填完该行动指南的全部字段。只检查存在性，不核实真实性或质量；不评估演示档案字段。人工复核覆盖仅统计实际保存了本地复核的记录。复查覆盖统计关联项目中有不早于该行动日期的自行申报后续观测（包括所选行动时段之外的复查）；一次项目复查可覆盖多条行动记录。复核不证明独立性，复查不证明因果关系。',
        ),
      ),
    );
    overview.body.appendChild(definitions);
    samples
      .filter((s) => s.stats.total < 5)
      .forEach((s) =>
        results.appendChild(
          n(
            'p',
            'mapx-small-sample',
            name(s.value) +
              ' · ' +
              (s.stats.total
                ? L(
                    'Small sample: fewer than 5 records; avoid broad comparisons.',
                    '样本不足 5 条，请避免广泛推论。',
                  )
                : L(
                    'No records in this period. Reporting coverage is unknown; this does not mean no action happened.',
                    '此时段无记录；报告覆盖未知，并不代表没有行动。',
                  )),
          ),
        ),
      );
    const mix = card(
      results,
      L('Action mix by region', '各区域行动构成'),
      L(
        'Shares of all filtered records, including pending, rejected and duplicate-flagged records. Click an activity to inspect its evidence on the map.',
        '占所有筛选记录的比例，包含待复核、驳回和重复标记记录。点击活动查看地图中的证据。',
      ),
    );
    const grid = n('div', 'pt-region-mix');
    samples.forEach((s) => {
      const col = n('div', 'pt-region-mix-card');
      col.appendChild(n('h4', '', name(s.value) + ' · n=' + s.stats.total));
      s.stats.actions.forEach((action) => {
        const row = b('', () => showMap(s.value, action.key), 'cx-mix-bar');
        const track = n('span', 'cx-mix-track'),
          fill = n('span');
        const share = s.stats.total ? (action.count / s.stats.total) * 100 : 0;
        fill.style.width = share + '%';
        track.appendChild(fill);
        row.append(
          n('span', '', t('act.' + action.key)),
          track,
          n('b', '', action.count + ' · ' + share.toFixed(0) + '%'),
        );
        row.setAttribute(
          'aria-label',
          name(s.value) + ' · ' + t('act.' + action.key) + ' · ' + action.count + ' / ' + s.stats.total,
        );
        col.appendChild(row);
      });
      grid.appendChild(col);
    });
    mix.body.appendChild(grid);
  }
  window.__renderRegions = renderResults;
  renderSelectors();
  renderResults();
}
