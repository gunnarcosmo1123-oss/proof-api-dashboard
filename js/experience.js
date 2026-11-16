'use strict';
/* Public community experience. All records and photographs stay in this browser. */
globalThis.ProofExperience = (() => {
  const C = ProofCommunity;
  const L = (en, zh) => (LANG === 'zh' ? zh : en);
  const n = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const b = (text, fn, cls = 'btn btn-ghost') => {
    const e = n('button', cls, text);
    e.type = 'button';
    e.addEventListener('click', fn);
    return e;
  };
  const p = (root, text, cls = 'cx-note') => root.appendChild(n('p', cls, text));
  const field = (title, input) => {
    const e = n('label', 'cx-field');
    input.setAttribute('aria-label', title);
    e.append(n('span', '', title), input);
    return e;
  };
  const input = (type, value = '', required = false) => {
    const e = n('input', 'txt-in');
    e.type = type;
    e.value = value;
    e.required = required;
    return e;
  };
  const textArea = () => {
    const e = n('textarea', 'txt-in');
    e.rows = 3;
    e.maxLength = 800;
    return e;
  };
  const link = (title, url) => {
    const e = n('a', '', title);
    e.href = url;
    e.target = '_blank';
    e.rel = 'noopener noreferrer';
    return e;
  };
  const items = (root, values) => {
    const ul = n('ul', 'cx-guide-list');
    values.forEach((v) => ul.appendChild(n('li', '', v)));
    root.appendChild(ul);
    return ul;
  };
  let storyId = null,
    returnTab = 'map',
    activeDialog = null;
  function image(s, cls = '') {
    const wrap = n('div', 'cx-photo ' + cls);
    if (s.thumb || s.photo) {
      const im = n('img');
      im.src = s.thumb || s.photo;
      im.alt = L('Evidence photograph: ', '证据照片：') + t('act.' + s.action);
      im.loading = 'lazy';
      wrap.appendChild(im);
    } else wrap.innerHTML = photoSvg(s);
    return wrap;
  }
  function credit(s) {
    const c =
      typeof ATTRIBUTION !== 'undefined' && s.photo ? ATTRIBUTION.find((c) => s.photo.includes(c[0])) : null;
    const wrap = n('p', 'cx-credit');
    if (c) {
      wrap.append(
        document.createTextNode(L('Illustrative photo · ', '示意照片 · ') + c[2] + ' · ' + c[3] + ' · '),
        link(L('Source', '来源'), c[4]),
      );
    } else
      wrap.textContent = s.thumb
        ? L('Local evidence preview · stored on this device', '本地证据预览 · 保存于此设备')
        : L('Generated scene · illustrative only', '生成场景 · 仅供示意');
    return wrap;
  }
  function recordKind(s) {
    return s.forensics
      ? L('Local submission', '本地提交')
      : L('Demo record · illustrative photo', '演示记录 · 示意照片');
  }
  function titleFor(project) {
    return project.title || t('act.' + project.action) + ' · ' + lb(PROOF.city(project.city));
  }
  function communityFor(project) {
    const s = project.submissions[0];
    return project.community || (s?.org ? orgName(s.org) : s?.submitter) || L('Local community', '当地社区');
  }
  function decisionBadge(s) {
    const state = C.reviewState(s);
    const label = state.human
      ? L('Human reviewed · local', '人工已复核 · 本地')
      : state.automatic === 'verified'
        ? L('Automated checks passed', '自动检查通过')
        : L('Review needed', '需要复核');
    const badge = n(
      'span',
      'cx-evidence-badge ' +
        (state.human ? 'has-review' : state.automatic === 'verified' ? 'has-auto' : 'needs-review'),
      label,
    );
    return badge;
  }
  function actionCard(s, onOpen = () => openStory(s.projectId || 'record:' + s.id), onHighlight = () => {}) {
    const project = s.projectId ? C.projectFor(s.projectId) : null;
    const card = b('', onOpen, 'cx-action-card');
    card.dataset.submission = s.id;
    card.dataset.city = s.city;
    card.dataset.action = s.action;
    card.setAttribute('aria-label', t('act.' + s.action) + ' · ' + lb(PROOF.city(s.city)) + ' · ' + s.id);
    card.appendChild(image(s));
    const body = n('div', 'cx-action-body');
    body.append(
      n('span', 'cx-kicker', t('act.' + s.action)),
      n('h3', '', project ? titleFor(project) : t('act.' + s.action) + ' · ' + lb(PROOF.city(s.city))),
    );
    const badges = n('div', 'cx-evidence-badges');
    badges.append(lvBadge(s.status), decisionBadge(s));
    body.appendChild(badges);
    body.append(
      n(
        'p',
        'cx-card-meta',
        (project ? communityFor(project) : s.org ? orgName(s.org) : s.submitter) +
          ' · ' +
          PROOF.actionDate(s),
      ),
      n('small', 'cx-record-kind', recordKind(s)),
    );
    card.appendChild(body);
    card.addEventListener('mouseenter', () => onHighlight(s.city));
    card.addEventListener('mouseleave', () => onHighlight(null));
    card.addEventListener('focus', () => onHighlight(s.city));
    card.addEventListener('blur', () => onHighlight(null));
    return card;
  }
  function refresh() {
    if (window.__renderMap) window.__renderMap();
    if (window.__renderQueue) window.__renderQueue();
    if (window.__refreshOverview) window.__refreshOverview();
    if (window.__renderAnalytics) window.__renderAnalytics();
    if (window.__renderRegions) window.__renderRegions();
    buildHome();
    if (storyId) renderStory();
  }
  function buildHome() {
    const root = document.querySelector('#tab-home');
    if (!root) return;
    root.replaceChildren();
    const hero = n('section', 'cx-home-hero');
    const copy = n('div', 'cx-home-copy');
    copy.append(
      n('p', 'cx-kicker', L('COMMUNITY CLIMATE ACTION', '社区气候行动')),
      n('h2', '', L('Local action.\nA clearer record.', '身边的行动，\n更清晰的记录。')),
    );
    p(
      copy,
      L(
        'Discover what communities are doing, document your own action, and follow the evidence over time.',
        '发现社区正在开展的行动，记录你的实践，并持续追踪证据。',
      ),
      'cx-lead',
    );
    const controls = n('div', 'cx-cta-row');
    controls.append(
      b(
        L('Explore actions →', '探索行动 →'),
        () => {
          MAP_VIEW_MODE = 'map-gallery';
          switchTab('map');
          window.__renderMap();
        },
        'btn btn-primary',
      ),
      b(L('Submit evidence', '提交证据'), () => switchTab('submit')),
    );
    copy.appendChild(controls);
    const review = b(
      L('Review evidence →', '审核证据 →'),
      () => switchTab('queue'),
      'link-btn cx-review-entry',
    );
    copy.appendChild(review);
    p(
      copy,
      L(
        'Offline by default · photos stay on your device · optional local AI',
        '默认离线 · 照片留在设备上 · 可选端侧 AI',
      ),
      'cx-home-trust',
    );
    hero.appendChild(copy);
    const photo = n('figure', 'cx-home-visual');
    const heroPhoto = { action: 'afforest', photo: 'assets/photos/afforest-02.jpg' };
    photo.append(image(heroPhoto), credit(heroPhoto));
    hero.appendChild(photo);
    root.appendChild(hero);
    const steps = n('div', 'cx-home-steps');
    [
      [L('01 · Discover', '01 · 发现'), L('Find local actions and communities.', '寻找当地的行动与社区。')],
      [
        L('02 · Document', '02 · 记录'),
        L('Use an action-specific evidence guide.', '使用针对行动类型的证据指南。'),
      ],
      [
        L('03 · Follow through', '03 · 跟进'),
        L('Return to the site and record what changed.', '回到现场，记录实际变化。'),
      ],
    ].forEach(([title, desc]) => {
      const item = n('div');
      item.append(n('h3', '', title), n('p', '', desc));
      steps.appendChild(item);
    });
    root.appendChild(steps);
    const heading = n('div', 'cx-section-heading');
    heading.append(
      n('div', '', L('Explore community actions', '探索社区行动')),
      b(L('See the action map →', '查看行动地图 →'), () => switchTab('map'), 'link-btn'),
    );
    root.appendChild(heading);
    p(
      root,
      L(
        'Seed records below are simulated. Commons photographs illustrate action types and do not document these demo communities.',
        '以下初始记录为模拟数据，Commons 照片仅示意行动类型，并不代表这些演示社区的真实项目。',
      ),
    );
    const gallery = n('div', 'cx-gallery');
    PROOF.actions.slice(0, 6).forEach((a) => {
      const s =
        PROOF.submissions.find((s) => s.action === a.key && !s.dup && s.status === 'verified') ||
        PROOF.submissions.find((s) => s.action === a.key && !s.dup);
      if (s) gallery.appendChild(actionCard(s));
    });
    root.appendChild(gallery);
    const local = C.listProjects();
    if (local.length) {
      const heading = n('div', 'cx-section-heading');
      heading.append(
        n('h3', '', L('Your local projects', '你的本地项目')),
        n('span', 'cx-muted', L('Saved in this browser', '保存在此浏览器')),
      );
      root.appendChild(heading);
      const list = n('div', 'cx-project-list');
      local
        .slice()
        .reverse()
        .forEach((project) => {
          const item = b('', () => openStory(project.id), 'cx-local-project');
          item.append(
            n('b', '', project.title),
            n('span', '', project.community + ' · ' + lb(PROOF.city(project.city))),
            n('small', '', t('act.' + project.action)),
          );
          list.appendChild(item);
        });
      root.appendChild(list);
    }
    const foot = n('section', 'cx-home-integrity');
    foot.append(
      n('h3', '', L('An action record is the beginning.', '行动记录只是开始。')),
      n(
        'p',
        '',
        L(
          'A photo can document an action. Long-term outcomes need a baseline, repeat observations and appropriate review.',
          '照片可以记录行动；长期效果还需要基线、重复观测和适当复核。',
        ),
      ),
      b(L('Read the evidence guides', '阅读证据指南'), () => switchTab('guides'), 'link-btn'),
    );
    root.appendChild(foot);
    if (C.loadError) p(root, C.loadError, 'cx-error');
  }
  function guidePanel(action, { compact = false, start = true, scope = {} } = {}) {
    const guide = C.guides[action],
      root = n(compact ? 'details' : 'section', 'cx-guide');
    if (!guide) return root;
    root.dataset.guide = action;
    root.appendChild(
      n(
        compact ? 'summary' : 'h3',
        '',
        t('act.' + action) + ' · ' + L('Evidence field guide', '证据实地指南'),
      ),
    );
    p(
      root,
      L('Proof API field guide', 'Proof API 实地指南') +
        ' v' +
        guide.version +
        ' · ' +
        guide.updated +
        ' · ' +
        L('Planning guidance, not a certification methodology', '规划指引，并非认证方法学'),
      'cx-credit',
    );
    const grid = n('div', 'cx-guide-grid');
    [
      [L('Suitable setting', '适用场景'), guide.fit],
      [L('Permissions & safeguards', '许可与保护措施'), guide.permissions],
      [L('Equipment & resources', '设备与资源'), guide.equipment],
      [L('Before · baseline', '之前 · 基线'), guide.baseline],
      [L('During · action evidence', '实施 · 行动证据'), guide.evidence],
      [L('After · follow-up', '之后 · 跟进'), guide.followup],
    ].forEach(([title, body]) => {
      const section = n('div');
      section.append(n('h4', '', title), n('p', '', lb(body)));
      grid.appendChild(section);
    });
    root.appendChild(grid);
    p(
      root,
      L('Suggested observation measure: ', '建议观测指标：') +
        lb(guide.measure.label) +
        ' (' +
        (typeof guide.measure.unit === 'string' ? guide.measure.unit : lb(guide.measure.unit)) +
        ').',
    );
    p(
      root,
      L(
        'Check local conditions with qualified people. These templates do not establish additionality, permanence, carbon savings or eligibility for credits.',
        '请与合格人员核查当地条件。这些模板不证明额外性、持久性、减排量或碳信用资格。',
      ),
    );
    const refs = n('details', 'cx-guide-sources');
    refs.appendChild(n('summary', '', L('Source frameworks & applicability', '参考框架及适用性')));
    p(
      refs,
      L(
        'The links describe verification frameworks. This is our own field checklist; neither organisation has approved it. Read the applicable official methodology and version before making a certification claim.',
        '以下链接介绍核查框架。本清单由我们编制，未经这些机构认可。提出认证主张前，请阅读适用的官方方法学及版本。',
      ),
    );
    guide.sources.forEach((source) => {
      const row = n('p');
      row.appendChild(link(source.title, source.url));
      refs.appendChild(row);
    });
    root.appendChild(refs);
    if (start)
      root.appendChild(
        b(L('Explore this activity →', '探索此活动 →'), () => starter(action, scope), 'btn btn-primary'),
      );
    return root;
  }
  function buildGuides() {
    const root = document.querySelector('#tab-guides');
    if (!root) return;
    root.replaceChildren(
      n('p', 'cx-kicker', L('PLAN · DOCUMENT · FOLLOW UP', '规划 · 记录 · 跟进')),
      n('h2', 'cx-page-title', L('A practical guide for every action.', '每种行动，都有实用指南。')),
    );
    p(
      root,
      L(
        'Start with local suitability and permissions. Choose an action to see the evidence to collect before, during and after.',
        '从当地适宜性和许可开始。选择行动，查看实施前、实施中和之后应记录的证据。',
      ),
    );
    const grid = n('div', 'cx-guides-list');
    PROOF.actions.forEach((a) => grid.appendChild(guidePanel(a.key, { compact: true })));
    root.appendChild(grid);
  }
  function modal(title) {
    if (activeDialog) activeDialog.close();
    const previous = document.activeElement,
      dialog = n('dialog', 'cx-dialog');
    dialog.setAttribute('aria-labelledby', 'cx-dialog-title');
    const head = n('div', 'cx-dialog-head'),
      h = n('h2', '', title);
    h.id = 'cx-dialog-title';
    const close = b('×', () => dialog.close(), 'cx-close');
    close.setAttribute('aria-label', L('Close', '关闭'));
    head.append(h, close);
    dialog.appendChild(head);
    const body = n('div', 'cx-dialog-body');
    dialog.appendChild(body);
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (activeDialog === dialog) activeDialog = null;
      if (previous?.isConnected) previous.focus();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          dialog.close();
      }
    });
    document.body.appendChild(dialog);
    activeDialog = dialog;
    dialog.showModal();
    return { dialog, body };
  }
  function starter(action, scope = {}) {
    const guide = C.guides[action];
    if (!guide) return;
    const { dialog, body } = modal(L('Start a community project', '开始社区项目'));
    dialog.dataset.kind = 'starter';
    const form = n('form', 'cx-starter');
    body.appendChild(form);
    let step = 0;
    const status = n('p', 'cx-error');
    status.setAttribute('role', 'alert');
    const progress = n('ol', 'cx-wizard-steps');
    const names = [L('Suitability', '适宜性'), L('Project plan', '项目规划'), L('Evidence', '证据')];
    names.forEach((name) => progress.appendChild(n('li', '', name)));
    form.appendChild(progress);
    const pages = names.map(() => n('section', 'cx-wizard-page'));
    pages.forEach((page) => form.appendChild(page));
    pages[0].append(
      n('h3', '', t('act.' + action)),
      n('p', '', lb(guide.fit)),
      n('h4', '', L('Permissions & safeguards', '许可与保护措施')),
      n('p', '', lb(guide.permissions)),
      n('h4', '', L('Bring or arrange', '携带或准备')),
      n('p', '', lb(guide.equipment)),
    );
    const acknowledge = input('checkbox');
    const ackLabel = field(
      L(
        'I will check site suitability, permissions and safety before doing this activity.',
        '开展活动前，我会检查地点适宜性、许可与安全。',
      ),
      acknowledge,
    );
    ackLabel.classList.add('cx-check');
    pages[0].appendChild(ackLabel);
    const name = input('text', t('act.' + action) + ' · ' + L('community project', '社区项目'), true);
    name.maxLength = 100;
    const community = input('text', '', true);
    community.minLength = 2;
    community.maxLength = 100;
    const city = n('select', 'txt-in');
    city.required = true;
    const placeholder = n('option', '', L('Choose a recorded city', '选择已记录城市'));
    placeholder.value = '';
    city.appendChild(placeholder);
    PROOF.cities.forEach((c, i) => {
      if (!scope.country || c.country.en === scope.country) {
        const o = n('option', '', lb(c) + ' · ' + lb(c.country));
        o.value = i;
        city.appendChild(o);
      }
    });
    if (city.options.length === 1)
      PROOF.cities.forEach((c, i) => {
        const o = n('option', '', lb(c) + ' · ' + lb(c.country));
        o.value = i;
        city.appendChild(o);
      });
    if (scope.city != null) city.value = String(scope.city);
    const date = input('date', fmtDate(new Date()), true),
      budget = input('text'),
      plan = textArea();
    budget.maxLength = 200;
    pages[1].append(
      field(L('Project name', '项目名称'), name),
      field(L('Community / organisation', '社区 / 组织'), community),
      field(L('Project city', '项目城市'), city),
      field(L('Planned action date', '计划行动日期'), date),
      field(L('Resources or budget (optional)', '资源或预算（可选）'), budget),
      field(L('Local plan (optional)', '当地方案（可选）'), plan),
    );
    pages[2].append(n('h3', '', L('Your evidence plan', '你的证据计划')));
    items(pages[2], [lb(guide.baseline), lb(guide.evidence), lb(guide.followup)]);
    const prepared = [];
    [
      L('Baseline plan prepared', '已准备基线方案'),
      L('Evidence collection arranged', '已安排行动证据收集'),
      L('Follow-up responsibility assigned', '已指定跟进负责人'),
    ].forEach((text, i) => {
      const c = input('checkbox');
      pages[2].appendChild(field(text, c));
      prepared.push(c);
    });
    const storage = input('checkbox');
    const consent = field(
      L(
        'Save this project and preview evidence in this browser. Nothing is uploaded or shared.',
        '将项目及证据预览保存在此浏览器，不上传、不分享。',
      ),
      storage,
    );
    consent.classList.add('cx-check');
    pages[2].appendChild(consent);
    p(
      pages[2],
      L(
        'This creates a local project draft. Planning checkboxes do not prove that permissions were granted or outcomes achieved.',
        '这将创建本地项目草稿。规划复选框不证明已获许可或已取得效果。',
      ),
    );
    form.appendChild(status);
    const controls = n('div', 'cx-cta-row');
    const back = b(L('Back', '上一步'), () => show(step - 1));
    const next = b(
      L('Continue →', '继续 →'),
      () => {
        if (step === 0 && !acknowledge.checked) {
          status.textContent = L(
            'Acknowledge the suitability and permission checks first.',
            '请先确认适宜性和许可检查。',
          );
          return;
        }
        if (step === 1 && ![name, community, city, date].every((e) => e.reportValidity())) return;
        show(step + 1);
      },
      'btn btn-primary',
    );
    const create = n('button', 'btn btn-primary', L('Save project & add evidence →', '保存项目并添加证据 →'));
    create.type = 'submit';
    controls.append(back, next, create);
    form.appendChild(controls);
    function show(i) {
      step = i;
      pages.forEach((page, j) => {
        page.hidden = i !== j;
        progress.children[j].classList.toggle('active', i === j);
      });
      back.hidden = i === 0;
      next.hidden = i === 2;
      create.hidden = i !== 2;
      status.textContent = '';
      pages[i].querySelector('input,select')?.focus();
    }
    show(0);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (step !== 2) return;
      if (!storage.checked) {
        status.textContent = L(
          'Choose local browser storage to save a project draft.',
          '请选择本地浏览器存储后保存草稿。',
        );
        return;
      }
      try {
        const project = C.createProject({
          action,
          city: Number(city.value),
          date: date.value,
          title: name.value,
          community: community.value,
          budget: budget.value,
          plan: plan.value,
          permissionsAcknowledged: acknowledge.checked,
          prepared: prepared.flatMap((c, i) => (c.checked ? ['baseline', 'evidence', 'followup'][i] : [])),
        });
        dialog.close();
        buildHome();
        window.__startProjectSubmission(project);
      } catch (error) {
        status.textContent = error.message;
      }
    });
  }
  function stages(root, s, allowReview = true) {
    const state = C.reviewState(s),
      box = n('section', 'cx-stages');
    box.setAttribute('aria-label', L('Evidence review stages', '证据复核阶段'));
    const auto = state.automatic === 'verified';
    const rows = [
      [
        L('01 · Automated checks', '01 · 自动检查'),
        auto
          ? L('Automated checks passed', '自动检查通过')
          : L('Flags or review required', '存在标记或需要复核'),
        state.archive
          ? L('Demo archive: original computation cannot be replayed.', '演示档案：无法重放原始计算。')
          : L(
              'Local heuristics; optional CLIP is a separate second opinion.',
              '本地启发式；可选 CLIP 是独立第二意见。',
            ),
      ],
      [
        L('02 · Human review', '02 · 人工复核'),
        state.human
          ? L('Human reviewed · local', '人工已复核 · 本地')
          : L('No human review recorded', '尚无人工复核记录'),
        state.human
          ? state.human.reviewer +
            ' · ' +
            state.human.at.slice(0, 10) +
            ' · ' +
            t('status.' + state.human.decision)
          : L('An automated acceptance is not a human sign-off.', '自动接纳并非人工签署。'),
      ],
      [
        L('03 · Outcome observations', '03 · 效果观测'),
        state.followups
          ? L('Outcome follow-up available', '已有后续效果观测')
          : L('No outcome follow-up recorded', '尚无后续效果观测'),
        state.followups
          ? state.followups +
            ' · ' +
            L('Self-reported observations; impact is not certified.', '自行申报观测；效果未经认证。')
          : L(
              'A baseline and repeated observations are needed to assess change.',
              '评估变化需要基线及重复观测。',
            ),
      ],
    ];
    const list = n('ol');
    rows.forEach(([title, value, desc]) => {
      const li = n('li');
      li.append(n('span', 'cx-kicker', title), n('b', '', value), n('p', '', desc));
      list.appendChild(li);
    });
    box.appendChild(list);
    const checks = n('details', 'cx-check-details');
    checks.appendChild(
      n('summary', '', L('What was checked? What remains unresolved?', '检查了什么？哪些问题尚未解决？')),
    );
    const fx = s.forensics;
    items(checks, [
      s.hash
        ? L(
            'Fingerprint recorded. This identifies a file, not the event it depicts.',
            '已记录文件指纹；它标识文件，并非照片中的事件。',
          )
        : L('No fingerprint available.', '无可用文件指纹。'),
      s.dup
        ? L(
            'Duplicate flag present. Review the original record and explanation.',
            '存在重复标记，请检查原始记录及解释。',
          )
        : L(
            'No duplicate was found in the local registry; this is not a global search.',
            '本地登记中未找到重复；并非全球检索。',
          ),
      fx?.exif?.gps
        ? L(
            'EXIF GPS is available; compare it with the claimed location and account for its limits.',
            '有 EXIF GPS；需与申报地点比较并考虑其局限。',
          )
        : L(
            'No measured EXIF location confirmation. Claimed city is not verified.',
            '没有实测 EXIF 地点确认；申报城市未经核实。',
          ),
      L(
        'Colour/noise heuristics and CLIP semantic matching do not authenticate a photograph.',
        '色彩、噪声启发式及 CLIP 语义匹配不能鉴定照片真伪。',
      ),
      L(
        'Permissions, baseline quality, additionality and long-term outcomes need project evidence and appropriate review.',
        '许可、基线质量、额外性及长期效果需要项目证据和适当复核。',
      ),
    ]);
    box.appendChild(checks);
    if (allowReview)
      box.appendChild(
        b(
          state.human
            ? L('Record another review', '记录再次复核')
            : L('Record a human review', '记录人工复核'),
          () => review(s.id, s.status === 'rejected' ? 'rejected' : 'verified'),
          'link-btn cx-review-stage-action',
        ),
      );
    root.appendChild(box);
    return box;
  }
  function review(id, decision = 'verified') {
    const s = PROOF.byId(id);
    if (!s) return;
    const { dialog, body } = modal(L('Record a human review', '记录人工复核'));
    dialog.dataset.kind = 'review';
    p(body, s.id + ' · ' + t('act.' + s.action) + ' · ' + lb(PROOF.city(s.city)));
    p(
      body,
      L(
        'Local prototype: reviewer identity is self-declared. This decision is not third-party certification and does not issue credits.',
        '本地原型：复核者身份为自行申报。该决定并非第三方认证，也不签发碳信用。',
      ),
    );
    stages(body, s, false);
    const form = n('form');
    const name = input('text', '', true);
    name.minLength = 2;
    name.maxLength = 80;
    const note = textArea();
    note.required = true;
    note.minLength = 10;
    const select = n('select', 'txt-in');
    ['verified', 'rejected'].forEach((key) => {
      const o = n(
        'option',
        '',
        key === 'verified'
          ? L('Accept evidence record', '接纳证据记录')
          : L('Reject evidence record', '驳回证据记录'),
      );
      o.value = key;
      select.appendChild(o);
    });
    select.value = decision;
    const ack = input('checkbox');
    ack.required = true;
    form.append(
      field(L('Reviewer name (self-declared)', '复核者姓名（自行申报）'), name),
      field(L('Decision', '决定'), select),
      field(L('Reason and unresolved limitations', '理由及尚未解决的局限'), note),
      field(
        L('I reviewed the evidence and acknowledge the limitations above.', '我已复核证据，并确认以上局限。'),
        ack,
      ),
    );
    const error = n('p', 'cx-error');
    error.setAttribute('role', 'alert');
    const save = n('button', 'btn btn-primary', L('Save local review', '保存本地复核'));
    save.type = 'submit';
    form.append(error, save);
    body.appendChild(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        window.__setVerdict(id, select.value, {
          reviewer: name.value,
          note: note.value,
          acknowledged: ack.checked,
        });
        dialog.close();
        refresh();
      } catch (e) {
        error.textContent = e.message;
      }
    });
  }
  function openStory(id) {
    if (!C.projectFor(id)) return;
    const active = document.querySelector('#tabs button.active')?.dataset.tab;
    if (active && active !== 'story') returnTab = active;
    storyId = id;
    renderStory();
    const tab = document.querySelector('#tabs [data-tab=story]');
    tab.hidden = false;
    switchTab('story', true);
    try {
      const url = new URL(location.href);
      url.searchParams.set('tab', 'story');
      url.searchParams.set('story', id);
      [...url.searchParams.keys()].filter(key => key.startsWith('map-')).forEach(key => url.searchParams.delete(key));
      history.pushState({ story: id }, '', url);
    } catch (e) {}
    document.querySelector('#tab-story h2')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function backFromStory() {
    switchTab(returnTab === 'story' ? 'map' : returnTab);
    try {
      const url = new URL(location.href);
      url.searchParams.delete('story');
      url.searchParams.set('tab', returnTab);
      history.replaceState({}, '', url);
    } catch (e) {}
  }
  function renderStory() {
    const root = document.querySelector('#tab-story');
    if (!root) return;
    root.replaceChildren();
    const project = storyId ? C.projectFor(storyId) : null;
    if (!project) {
      root.append(
        n('h2', '', L('Project not available on this device', '此设备上没有此项目')),
        n(
          'p',
          '',
          L(
            'Local project stories are only stored in the browser where they were created.',
            '本地项目故事仅保存在创建它的浏览器。',
          ),
        ),
        b(L('Explore actions', '探索行动'), () => switchTab('map')),
      );
      return;
    }
    root.appendChild(b(L('← Back to actions', '← 返回行动'), backFromStory, 'link-btn'));
    const head = n('header', 'cx-story-head');
    head.append(n('p', 'cx-kicker', t('act.' + project.action)), n('h2', 'cx-page-title', titleFor(project)));
    head.querySelector('h2').tabIndex = -1;
    p(
      head,
      communityFor(project) +
        ' · ' +
        lb(PROOF.city(project.city)) +
        ' · ' +
        lb(PROOF.city(project.city).country),
      'cx-lead',
    );
    p(
      head,
      project.local
        ? L(
            'Local project · saved in this browser · dates and observations are self-reported',
            '本地项目 · 保存于此浏览器 · 日期和观测为自行申报',
          )
        : project.submissions[0]?.forensics
          ? L(
              'Local standalone action record · project grouping has not been assigned',
              '本地独立行动记录 · 尚未指定项目分组',
            )
          : L(
              'Demo/archive action story · no baseline, follow-up or human review is inferred',
              '演示或档案行动故事 · 不推定存在基线、后续观测或人工复核',
            ),
    );
    root.appendChild(head);
    const grid = n('div', 'cx-story-layout'),
      main = n('div'),
      aside = n('aside', 'cx-story-aside');
    grid.append(main, aside);
    root.appendChild(grid);
    const first = project.submissions[0];
    if (first) {
      const figure = n('figure', 'cx-story-hero');
      figure.append(image(first), credit(first));
      main.appendChild(figure);
      p(main, L('Review stages for latest action record: ', '最新行动记录的复核阶段：') + first.id);
      stages(main, first);
      const before = project.observations.filter(o => o.kind === 'baseline' && o.photo && o.date < PROOF.actionDate(first)).sort((a, b) => b.date.localeCompare(a.date))[0];
      const after = project.observations.filter(o => o.kind === 'followup' && o.photo && before && o.date > before.date).sort((a, b) => b.date.localeCompare(a.date))[0];
      if(before && (after?.photo || first.thumb || first.photo)){
        main.appendChild(n('h3', 'cx-section-heading', L('Compare the recorded views', '比较已记录视图')));
        ProofTools.slider(main, before.photo, after?.photo || first.thumb || first.photo, {
          before: L('Baseline · ', '基线 · ') + before.date,
          after: (after ? L('Follow-up · ', '复查 · ') : L('Action · ', '行动 · ')) + (after?.date || PROOF.actionDate(first))
        });
      }
    } else
      p(
        main,
        L(
          'Your project is a draft. Add the first action evidence to start its record.',
          '你的项目还是草稿；添加第一条行动证据来开始记录。',
        ),
        'cx-empty',
      );
    const stats = n('div', 'cx-story-facts');
    [
      [L('Action records', '行动记录'), project.submissions.length],
      [
        L('Baseline observations', '基线观测'),
        project.observations.filter((o) => o.kind === 'baseline').length,
      ],
      [
        L('Follow-up observations', '后续观测'),
        project.observations.filter((o) => o.kind === 'followup').length,
      ],
    ].forEach(([label, value]) => {
      const e = n('div');
      e.append(n('b', '', String(value)), n('span', '', label));
      stats.appendChild(e);
    });
    aside.appendChild(stats);
    aside.appendChild(b(L('Download project summary', '下载项目摘要'), () => ProofTools.exportProject(project)));
    if (project.plan) {
      aside.append(n('h3', '', L('Local plan', '当地方案')), n('p', '', project.plan));
    }
    if (project.budget) p(aside, L('Resources / budget: ', '资源 / 预算：') + project.budget);
    if (project.local) {
      p(
        aside,
        L(
          'Permissions: still to check. Planning acknowledgement is not a permit.',
          '许可：仍需检查。规划确认并非许可证。',
        ),
      );
      aside.append(
        b(
          L('Add action evidence', '添加行动证据'),
          () => window.__startProjectSubmission(project),
          'btn btn-primary',
        ),
        b(L('Add baseline or follow-up', '添加基线或后续观测'), () => observationForm(project)),
      );
    }
    aside.appendChild(
      guidePanel(project.action, {
        compact: true,
        start: !project.local,
        scope: { country: PROOF.city(project.city).country.en, city: project.city },
      }),
    );
    main.appendChild(n('h3', 'cx-section-heading', L('The evidence timeline', '证据时间线')));
    const timeline = n('ol', 'cx-timeline');
    main.appendChild(timeline);
    const events = project.observations.map((o) => ({ date: o.date, kind: o.kind, observation: o }));
    project.submissions.forEach((s) => {
      events.push({ date: PROOF.actionDate(s), kind: 'action', submission: s });
      C.reviews(s.id).forEach((r) =>
        events.push({ date: r.at.slice(0, 10), kind: 'review', review: r, submission: s }),
      );
    });
    events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        ['baseline', 'action', 'review', 'followup'].indexOf(a.kind) -
          ['baseline', 'action', 'review', 'followup'].indexOf(b.kind),
    );
    if (!project.observations.some((o) => o.kind === 'baseline')) {
      const missing = n('li', 'cx-timeline-missing');
      missing.append(
        n('h4', '', L('Baseline · not recorded', '基线 · 尚无记录')),
        n('p', '', lb(C.guides[project.action].baseline)),
      );
      timeline.appendChild(missing);
    }
    events.forEach((event) => {
      const li = n('li', 'cx-timeline-event');
      li.dataset.kind = event.kind;
      const titles = {
        baseline: L('Before · baseline observation', '之前 · 基线观测'),
        action: L('Action evidence', '行动证据'),
        review: L('Human review · local', '人工复核 · 本地'),
        followup: L('After · follow-up observation', '之后 · 后续观测'),
      };
      li.append(n('time', '', event.date), n('h4', '', titles[event.kind]));
      if (event.observation) {
        const o = event.observation;
        li.append(n('p', '', o.note));
        if (o.photo) {
          const im = n('img', 'cx-observation-photo');
          im.src = o.photo;
          im.alt = titles[event.kind];
          li.appendChild(im);
        }
        if (o.value != null) {
          const m = C.guides[project.action].measure;
          li.appendChild(
            n(
              'p',
              'cx-measurement',
              lb(m.label) + ': ' + o.value + ' ' + (typeof m.unit === 'string' ? m.unit : lb(m.unit)),
            ),
          );
        }
        p(li, L('Self-reported; no independent outcome validation.', '自行申报；未经独立效果核验。'));
      }
      if (event.kind === 'action') {
        const s = event.submission;
        li.append(lvBadge(s.status), decisionBadge(s), n('p', '', s.id + ' · ' + s.submitter));
        if (s.actionEvidence && Object.keys(s.actionEvidence).length) {
          const details = n('dl', 'cx-reported-details');
          C.guides[s.action].fields.forEach((field) => {
            const value = s.actionEvidence[field.key];
            if (value == null) return;
            details.append(n('dt', '', lb(field.label)), n('dd', '', String(value)));
          });
          li.appendChild(details);
          p(
            li,
            L(
              'Activity details are self-reported, not independently verified.',
              '行动详情为自行申报，未经独立核实。',
            ),
          );
        }
        li.appendChild(b(L('Inspect evidence & review', '检查证据并复核'), () => openDrawer(s.id)));
      }
      if (event.review) {
        const r = event.review;
        li.append(n('b', '', r.reviewer + ' · ' + t('status.' + r.decision)), n('p', '', r.note));
        p(
          li,
          L(
            'Reviewer identity is self-declared in this local prototype.',
            '本地原型中的复核者身份为自行申报。',
          ),
        );
      }
      timeline.appendChild(li);
    });
    if (!project.observations.some((o) => o.kind === 'followup')) {
      const missing = n('li', 'cx-timeline-missing');
      missing.append(
        n('h4', '', L('Follow-up · not recorded', '后续观测 · 尚无记录')),
        n('p', '', lb(C.guides[project.action].followup)),
      );
      timeline.appendChild(missing);
    }
    p(
      root,
      L(
        'A project link is explicit: nearby records and duplicate photographs are never automatically merged into a project. A recorded action or follow-up is not proof of ecological benefit or issued credits.',
        '项目链接为明确指定；附近记录和重复照片不会自动合并为同一项目。记录行动或后续观测，不等于证明生态效益或签发碳信用。',
      ),
    );
  }
  async function preview(file) {
    if (!file) return null;
    if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024)
      throw new Error(L('Choose an image under 12 MB.', '请选择小于 12 MB 的图片。'));
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url),
        scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
      return drawToCanvas(
        img,
        Math.max(1, Math.round(img.naturalWidth * scale)),
        Math.max(1, Math.round(img.naturalHeight * scale)),
      ).toDataURL('image/jpeg', 0.72);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function observationForm(project) {
    const { dialog, body } = modal(L('Add a dated observation', '添加有日期的观测'));
    dialog.dataset.kind = 'observation';
    const form = n('form'),
      kind = n('select', 'txt-in');
    [
      ['baseline', L('Before · baseline', '之前 · 基线')],
      ['followup', L('After · follow-up', '之后 · 后续观测')],
    ].forEach(([value, title]) => {
      const o = n('option', '', title);
      o.value = value;
      kind.appendChild(o);
    });
    const date = input('date', fmtDate(new Date()), true),
      note = textArea();
    note.required = true;
    note.minLength = 5;
    const measure = C.guides[project.action].measure,
      value = input('number');
    value.min = '0';
    value.step = 'any';
    const photo = input('file');
    photo.accept = 'image/*';
    const consent = input('checkbox');
    consent.required = true;
    form.append(
      field(L('Observation type', '观测类型'), kind),
      field(L('Acquisition date (self-reported)', '采集日期（自行申报）'), date),
      field(
        L(
          'What did you observe? Include the measurement period if relevant.',
          '你观察到了什么？如适用，请注明计量时段。',
        ),
        note,
      ),
      field(
        lb(measure.label) +
          ' · ' +
          (typeof measure.unit === 'string' ? measure.unit : lb(measure.unit)) +
          ' ' +
          L('(optional)', '（可选）'),
        value,
      ),
      field(L('Evidence photo (optional, max 12 MB)', '证据照片（可选，最多 12 MB）'), photo),
      field(
        L(
          'Store a reduced preview locally. I have permission to record this evidence.',
          '将缩小预览保存在本地；我有权记录此证据。',
        ),
        consent,
      ),
    );
    p(
      form,
      L(
        'Observations are self-reported and never automatically verified. Original photo bytes are not retained here.',
        '观测为自行申报，不会自动核实；此处不保留原始照片字节。',
      ),
    );
    const error = n('p', 'cx-error');
    error.setAttribute('role', 'alert');
    const save = n('button', 'btn btn-primary', L('Save observation', '保存观测'));
    save.type = 'submit';
    form.append(error, save);
    body.appendChild(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      save.disabled = true;
      try {
        const image = await preview(photo.files[0]);
        C.addObservation(project.id, {
          kind: kind.value,
          date: date.value,
          note: note.value,
          value: value.value,
          photo: image,
        });
        dialog.close();
        refresh();
      } catch (e) {
        error.textContent = e.message;
      } finally {
        save.disabled = false;
      }
    });
  }
  function submissionProject(root, state, rerender) {
    const box = n('div', 'cx-submission-project'),
      select = n('select', 'txt-in');
    const standalone = n('option', '', L('Standalone action record', '独立行动记录'));
    standalone.value = '';
    select.appendChild(standalone);
    C.listProjects().forEach((p) => {
      const o = n('option', '', p.title + ' · ' + lb(PROOF.city(p.city)));
      o.value = p.id;
      select.appendChild(o);
    });
    select.value = state.projectId || '';
    select.addEventListener('change', () => {
      const project = select.value ? C.projectFor(select.value) : null;
      state.projectId = project?.id || null;
      if (project) {
        state.action = project.action;
        state.city = project.city;
        state.orgMode = 'ind';
        state.date = state.date || project.date;
      }
      rerender();
    });
    box.appendChild(field(L('Link evidence to a local project', '将证据链接到本地项目'), select));
    if (state.projectId)
      p(
        box,
        L(
          'Action and city follow the linked project. Choose a standalone record to change them.',
          '行动和城市沿用链接项目；如需更改，请选择独立记录。',
        ),
      );
    root.appendChild(box);
    if (state.action)
      root.appendChild(
        guidePanel(state.action, {
          compact: true,
          scope: { city: state.city, country: PROOF.city(state.city).country.en },
        }),
      );
    if (state.action) {
      if (state.actionEvidence?.action !== state.action)
        state.actionEvidence = { action: state.action, values: {} };
      const fields = n('details', 'cx-action-details');
      fields.appendChild(
        n('summary', '', L('Activity details · optional, self-reported', '行动详情 · 可选，自行申报')),
      );
      C.guides[state.action].fields.forEach((spec) => {
        const control = input(spec.type, state.actionEvidence.values[spec.key] ?? '');
        if (spec.type === 'number') {
          control.min = '0';
          control.step = spec.integer ? '1' : 'any';
        } else control.maxLength = 300;
        control.addEventListener('input', () => {
          state.actionEvidence.values[spec.key] = control.value;
        });
        fields.appendChild(field(lb(spec.label), control));
      });
      p(
        fields,
        L(
          'These details add context to the evidence record. They are not measured or validated by CLIP and do not prove impact.',
          '这些详情为证据记录提供背景；并非由 CLIP 测量或验证，也不证明效果。',
        ),
      );
      root.appendChild(fields);
    }
  }
  return {
    L,
    image,
    credit,
    actionCard,
    decisionBadge,
    buildHome,
    buildGuides,
    guidePanel,
    starter,
    stages,
    review,
    openStory,
    renderStory,
    refresh,
    submissionProject,
    get storyId() {
      return storyId;
    },
    restoreStory(id) {
      storyId = id;
      renderStory();
      document.querySelector('#tabs [data-tab=story]').hidden = false;
      switchTab('story', true);
    },
  };
})();
