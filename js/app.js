'use strict';
/* ============================================================
   Proof API · 应用层(Team P05)
   总览 / 审核队列 / 重复检测 / 分析 / 智能体
   演示交互:通过/驳回实时更新状态与总览;智能体规则引擎调查。
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const ACT = Object.fromEntries(PROOF.actions.map(a => [a.key, a]));
const ORG = Object.fromEntries(PROOF.orgs.map(o => [o.key, o]));
const CAT = Object.fromEntries(PROOF.categories.map(c => [c.key, c]));
const pad2 = n => String(n).padStart(2, '0');
const fmtTime = d => (d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
const fmtDate = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const dateKey = d => fmtDate(d);
/* 自定义组织 'custom:<名称>' 必须先于登记库查找,否则回落成"个人/Individual" */
const orgName = k => {
  if(k && k.startsWith('custom:')) return k.slice(7);
  return ORG[k] ? lb(ORG[k].name) : t('map.individual');
};
const catName = k => (CAT[k] ? lb(CAT[k].name) : k);
const countryName = key => {
  const c = PROOF.cities.find(x => x.country.en === key);
  return c ? lb(c.country) : key;
};
const mapCountryName = c => (LANG === 'en' ? c.name : (c.zh || c.name));
function orgTag(key){
  const o = ORG[key];
  const custom = !!(key && key.startsWith('custom:'));
  const b = document.createElement('span');
  b.className = 'orgtag' + (custom ? ' orgtag-custom' : '');
  b.textContent = (custom ? '🏢 ' : (o ? (TYPE_ICONS[o.type] || '🏢') + ' ' : '🙂 ')) + orgName(key);
  if(custom){
    const badge = document.createElement('i');
    badge.className = 'orgtag-badge';
    badge.textContent = t('drawer.org.unregistered');
    b.appendChild(badge);
  }
  return b;
}

/* ---- 通用组件 ---- */
function card(parent, title, sub, tools){
  const root = document.createElement('div');
  root.className = 'card';
  const head = document.createElement('div');
  head.className = 'card-head';
  const tl = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = title;
  tl.appendChild(h3);
  if(sub){
    const p = document.createElement('p');
    p.className = 'card-sub';
    p.textContent = sub;
    tl.appendChild(p);
  }
  head.appendChild(tl);
  if(tools){ const tw = document.createElement('div'); tw.className = 'card-tools'; tools.forEach(x => tw.appendChild(x)); head.appendChild(tw); }
  root.appendChild(head);
  const body = document.createElement('div');
  body.className = 'card-body';
  root.appendChild(body);
  parent.appendChild(root);
  return { root, body };
}

function statTile(o){
  const s = document.createElement('div');
  s.className = 'stat';
  s.innerHTML = '<div class="stat-label">' + o.label + (o.hint ? ' <span class="stat-hint">' + o.hint + '</span>' : '') + '</div>' +
    '<div class="stat-value">' + o.value + '</div>' +
    '<div class="stat-delta ' + (o.deltaCls || 'plain') + '"><b>' + (o.deltaIcon || '') + '</b><span>' + (o.delta || '') + '</span></div>';
  if(o.spark){ const sp = document.createElement('div'); sp.className = 'stat-spark'; s.appendChild(sp); sparkline(sp, o.spark, o.sparkColor || '#2a78d6'); }
  return s;
}

function lvBadge(status){
  const st = PROOF.statuses[status];
  const b = document.createElement('span');
  b.className = 'lv lv-' + status;
  b.innerHTML = '<i>' + st.icon + '</i>' + t('status.' + status);
  b.style.color = st.text;
  return b;
}

function actTag(key){
  const a = ACT[key];
  const b = document.createElement('span');
  b.className = 'cat';
  b.textContent = a.icon + ' ' + t('act.' + key);
  b.style.color = a.color;
  b.style.background = a.color + '14';
  b.style.borderColor = a.color + '4d';
  return b;
}

function photoEl(sub, cls){
  const d = document.createElement('div');
  d.className = 'photo' + (cls ? ' ' + cls : '') + (sub.dup ? ' dup-variant' : '');
  d.innerHTML = photoHtml(sub);
  return d;
}

/* 分数来源标注:有实测取证的会话提交 vs 演示档案快照 */
function subSrcs(s){
  if(s.forensics){
    return {
      auth: 'src.auth.measured',
      action: 'src.action',
      loc: s.forensics.locSource === 'exif-gps' ? 'src.loc.gps' : 'src.loc.demo'
    };
  }
  return { auth: 'src.auth.demo', action: 'src.action', loc: 'src.loc.demo' };
}

/* subs: {auth, action, loc};srcs(可选): {auth, action, loc} 的 i18n 键 → 在标签后加"分数来源"小标 */
function subBars(subs, srcs){
  const box = document.createElement('div');
  box.className = 'subbars';
  [['auth', 'qc.auth'], ['action', 'qc.action'], ['loc', 'qc.loc']].forEach(([k, key]) => {
    const v = subs[k];
    const color = v < 60 ? PROOF.statuses.rejected.color : (v < 85 ? PROOF.statuses.pending.color : PROOF.statuses.verified.color);
    const row = document.createElement('div');
    row.className = 'subbar';
    row.innerHTML = '<span class="subbar-label">' + t(key) +
      (srcs && srcs[k] ? '<i class="subbar-src">' + t(srcs[k]) + '</i>' : '') + '</span>' +
      '<i class="subbar-track"><em style="width:' + v + '%;background:' + color + '"></em></i>' +
      '<b>' + v + '</b>';
    box.appendChild(row);
  });
  return box;
}

function photoThumb(sub, w){
  const d = photoEl(sub, 'thumb');
  d.style.width = w + 'px';
  d.style.height = Math.round(w * 0.625) + 'px';
  return d;
}

function animateNumber(el, target, decimals){
  const t0 = performance.now(), dur = 900;
  function step(now){
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * e).toLocaleString(LANG === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: decimals ?? 0, minimumFractionDigits: 0 });
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ============================================================
   总览
   ============================================================ */
function buildOverview(){
  const sec = $('#tab-overview');
  sec.innerHTML = '';

  /* 英雄区 */
  const hero = document.createElement('div');
  hero.className = 'card hero';
  const k = PROOF.kpis();
  hero.innerHTML =
    '<div class="hero-kicker"><i class="pulse"></i>' + t('hero.kicker') + '</div>' +
    '<div class="hero-stats">' +
      '<div class="hero-stat"><div class="hero-num" id="ov-total">0</div><div class="hero-label">' + t('hero.label') + '</div></div>' +
      '<div class="hero-stat"><div class="hero-num hero-mit" id="ov-mit">0</div><div class="hero-label">' + t('kpi.mitigation') + '</div><div class="hero-note">' + t('kpi.mitigationNote') + '</div></div>' +
    '</div>' +
    '<div class="hero-sub">' + t('hero.sub') + '</div>' +
    '<div class="hero-badges">' +
      '<span class="badge badge-info">◈ ' + t('hero.badge1') + '</span>' +
      '<span class="badge"># ' + t('hero.badge2') + '</span>' +
      '<span class="badge">✦ ' + t('hero.badge3') + '</span>' +
    '</div>';
  sec.appendChild(hero);

  /* KPI 行 */
  const kpi = document.createElement('div');
  kpi.className = 'kpi-grid';
  kpi.id = 'ov-kpis';
  sec.appendChild(kpi);

  const renderKpis = () => {
    const K = PROOF.kpis();
    const flow = PROOF.dailyFlow();
    const sparkIn = flow.map(r => r.verified + r.pending + r.rejected + r.flagged);
    const sparkOk = flow.map(r => r.verified);
    kpi.innerHTML = '';
    const tiles = [
      { label: t('kpi.today'), value: fmtNum(K.today, 0), delta: t('kpi.todayNote'), deltaIcon: K.todayDelta > 0 ? '▲' : '▽', deltaCls: K.todayDelta >= 0 ? 'good' : 'bad', deltaVal: (K.todayDelta > 0 ? '+' : '') + K.todayDelta, spark: sparkIn },
      { label: t('kpi.pending'), value: fmtNum(K.pending, 0), delta: t('kpi.pendingNote'), deltaIcon: '⏳', deltaCls: K.pending > 0 ? 'warn' : 'plain', deltaVal: K.pending, spark: null },
      { label: t('kpi.rate'), value: fmtNum(K.verifiedRate, 1) + '%', delta: t('kpi.rateNote'), deltaIcon: '✓', deltaCls: 'good', deltaVal: '', spark: sparkOk },
      { label: t('kpi.dup'), value: fmtNum(K.dupRate, 1) + '%', delta: t('kpi.dupNote'), deltaIcon: '⚠', deltaCls: 'warn', deltaVal: '', spark: null },
      { label: t('kpi.avg'), value: fmtNum(K.avg, 1), delta: t('kpi.avgNote'), deltaIcon: '◈', deltaCls: 'plain', deltaVal: '', spark: null }
    ];
    tiles.forEach(o => {
      const el = statTile(o);
      const d = el.querySelector('.stat-delta span');
      if(d && o.deltaVal !== '') d.textContent = o.deltaVal + ' ' + o.delta;
      kpi.appendChild(el);
    });
    const heroNum = $('#ov-total');
    animateNumber(heroNum, K.total, 0);
    const heroMit = $('#ov-mit');
    if(heroMit) animateNumber(heroMit, PROOF.verifiedMitigation(), 1);
    kpi.querySelectorAll('.stat-value').forEach((n, i) => { n.textContent = tiles[i].value; });
  };

  /* 图表区 */
  const g1 = document.createElement('div');
  g1.className = 'grid-2-1';
  sec.appendChild(g1);

  const flowCard = card(g1, t('ov.flow.title'), t('ov.flow.sub'));
  const histCard = card(g1, t('ov.hist.title'), t('ov.hist.sub'));

  const renderFlow = () => {
    const flow = PROOF.dailyFlow();
    flowCard.body.innerHTML = '';
    const series = ['verified', 'pending', 'rejected', 'flagged'].map(st => ({
      name: t('status.' + st), color: PROOF.statuses[st].color,
      values: flow.map(r => r[st])
    }));
    stackedBars(flowCard.body, { categories: flow.map(r => r.label), series });
    legend(flowCard.body, series.slice().reverse(), { type: 'bar' });
  };
  const renderHist = () => {
    histCard.body.innerHTML = '';
    histogram(histCard.body, { buckets: PROOF.scoreHist(), name: t('table.count') });
  };

  /* 行动类型 */
  const g2 = document.createElement('div');
  g2.className = 'grid-2';
  sec.appendChild(g2);
  const rankCard = card(g2, t('ov.rank.title'), t('ov.rank.sub'));
  const actCard = card(g2, t('ov.act.title'), t('ov.act.sub'));

  const renderRank = () => {
    rankCard.body.innerHTML = '';
    rankedBars(rankCard.body, {
      items: PROOF.byAction().map(a => ({ label: a.icon + ' ' + t('act.' + a.key), value: a.count })),
      fmtY: v => fmtNum(v, 0)
    });
  };
  const renderAct = () => {
    actCard.body.innerHTML = '';
    const tb = document.createElement('div');
    tb.className = 'chart-table';
    tb.innerHTML = '<table><thead><tr><th>' + t('table.action') + '</th><th>' + t('table.count') + '</th><th>' + t('table.avg') + '</th><th>' + t('table.dupRate') + '</th></tr></thead><tbody></tbody></table>';
    const tbody = tb.querySelector('tbody');
    PROOF.byAction().forEach(a => {
      const tr = document.createElement('tr');
      const catChip = '<span style="color:' + CAT[a.cat].color + ';font-size:10.5px;border:1px solid ' + CAT[a.cat].color + '4d;background:' + CAT[a.cat].color + '14;border-radius:99px;padding:1px 7px;margin-left:4px">' + catName(a.cat) + '</span>';
      tr.innerHTML = '<td>' + a.icon + ' ' + t('act.' + a.key) + catChip + '</td>' +
        '<td>' + a.count + '</td><td>' + fmtNum(a.avg, 1) + '</td><td>' + fmtNum(a.dupRate, 1) + '%</td>';
      tbody.appendChild(tr);
    });
    actCard.body.appendChild(tb);
  };

  /* 动态列表 */
  const g3 = document.createElement('div');
  g3.className = 'grid-2';
  sec.appendChild(g3);
  const feedCard = card(g3, t('ov.feed.title'), t('ov.feed.sub'));
  const dupCard = card(g3, t('ov.dupAlert.title'), t('ov.dupAlert.sub'));

  const renderFeeds = () => {
    feedCard.body.innerHTML = '';
    PROOF.recent(7).forEach(s => {
      const row = document.createElement('div');
      row.className = 'feed-row';
      const th = photoThumb(s, 64);
      const info = document.createElement('div');
      info.className = 'feed-info';
      const c = PROOF.city(s.city);
      const top = document.createElement('div');
      top.className = 'feed-top';
      const idEl = document.createElement('b');
      idEl.textContent = s.id;
      top.appendChild(idEl);
      top.appendChild(lvBadge(s.status));
      const meta = document.createElement('div');
      meta.className = 'feed-meta';
      meta.textContent = ACT[s.action].icon + ' ' + s.submitter + ' · ' + (s.org ? orgName(s.org) + ' · ' : '') + lb(c) + ' · ' + fmtTime(s.time);
      info.appendChild(top); info.appendChild(meta);
      row.appendChild(th); row.appendChild(info);
      row.addEventListener('click', () => switchTab('queue'));
      feedCard.body.appendChild(row);
    });
    dupCard.body.innerHTML = '';
    const groups = PROOF.dupGroups();
    if(!groups.length){ dupCard.body.innerHTML = '<p class="muted-text">—</p>'; return; }
    groups.slice(0, 2).forEach(g => {
      const row = document.createElement('div');
      row.className = 'insight';
      const isExact = g.type === 'exact';
      row.innerHTML = '<div class="insight-icon">' + (isExact ? '⛔' : '⚠') + '</div>' +
        '<p>' + t(isExact ? 'ov.dupAlert.item2' : 'ov.dupAlert.item1', { g: g.id, n: g.dups.length + 1, s: Math.round(g.sim * 100) }) + '</p>' +
        '<span class="lv lv-flagged" style="color:' + PROOF.statuses.flagged.text + '">' + (g.dups.length + 1) + t('dup.members') + '</span>';
      dupCard.body.appendChild(row);
    });
    const more = document.createElement('button');
    more.className = 'link-btn';
    more.textContent = t('ov.dupAlert.more');
    more.addEventListener('click', () => switchTab('dup'));
    dupCard.body.appendChild(more);
  };

  renderKpis(); renderFlow(); renderHist(); renderRank(); renderAct(); renderFeeds();
  /* 供状态变化后刷新 */
  window.__refreshOverview = () => { renderKpis(); renderFlow(); renderHist(); renderRank(); renderAct(); renderFeeds(); };
}

/* ============================================================
   审核队列
   ============================================================ */
let QS = { status: 'all', action: 'all' };

function buildQueue(){
  const sec = $('#tab-queue');
  sec.innerHTML = '';

  const head = card(sec, t('queue.title'), t('queue.sub'));
  head.root.classList.add('queue-head');

  const fRow = document.createElement('div');
  fRow.className = 'filter-row';
  fRow.innerHTML = '<span class="filter-label">' + t('queue.filter.status') + '</span><span class="chip-row" id="qc-f-status"></span>' +
    '<span class="filter-label">' + t('queue.filter.action') + '</span><span class="chip-row" id="qc-f-action"></span>';
  head.body.appendChild(fRow);

  const buildChips = () => {
    const sRow = $('#qc-f-status');
    sRow.innerHTML = '';
    [['all', 'queue.all'], ['verified', 'status.verified'], ['pending', 'status.pending'], ['flagged', 'status.flagged'], ['rejected', 'status.rejected']].forEach(([v, k]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (QS.status === v ? ' active' : '');
      b.innerHTML = '<i style="background:' + (v === 'all' ? '#c3c2b7' : PROOF.statuses[v].color) + '"></i>' + t(k);
      b.addEventListener('click', () => { QS.status = v; buildChips(); renderQueue(); });
      sRow.appendChild(b);
    });
    const aRow = $('#qc-f-action');
    aRow.innerHTML = '';
    [['all', 'queue.all']].concat(PROOF.actions.map(a => [a.key, 'act.' + a.key])).forEach(([v, k]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (QS.action === v ? ' active' : '');
      if(v === 'all') b.innerHTML = t(k);
      else b.innerHTML = '<span>' + ACT[v].icon + '</span>' + t(k);
      b.addEventListener('click', () => { QS.action = v; buildChips(); renderQueue(); });
      aRow.appendChild(b);
    });
  };

  const countEl = document.createElement('p');
  countEl.className = 'qc-count';
  sec.appendChild(countEl);

  const list = document.createElement('div');
  list.className = 'qc-list';
  list.id = 'qc-list';
  sec.appendChild(list);

  const hint = document.createElement('p');
  hint.className = 'qc-hint';
  hint.textContent = t('qc.hint.low');
  sec.appendChild(hint);

  function renderQueue(){
    const filtered = PROOF.submissions
      .filter(s => (QS.status === 'all' || s.status === QS.status) && (QS.action === 'all' || s.action === QS.action))
      .slice().sort((a, b) => b.score - a.score);
    countEl.textContent = t('queue.count', { n: PROOF.submissions.length, m: filtered.length });
    list.innerHTML = '';
    if(!filtered.length){ list.innerHTML = '<p class="muted-text">' + t('queue.empty') + '</p>'; return; }
    filtered.forEach(s => {
      const c = PROOF.city(s.city);
      const item = document.createElement('div');
      item.className = 'qc-card';
      if(s.status === 'flagged') item.classList.add('is-flag');

      const th = photoThumb(s, 132);
      const mid = document.createElement('div');
      mid.className = 'qc-mid';
      const top = document.createElement('div');
      top.className = 'qc-top';
      const idEl = document.createElement('b');
      idEl.className = 'qc-id';
      idEl.textContent = s.id;
      top.appendChild(idEl);
      top.appendChild(lvBadge(s.status));
      top.appendChild(actTag(s.action));
      if(s.org) top.appendChild(orgTag(s.org));
      const meta = document.createElement('div');
      meta.className = 'qc-meta';
      meta.textContent = s.submitter + ' · ' + lb(c) + ' · ' + fmtTime(s.time);
      mid.appendChild(top); mid.appendChild(meta);
      mid.appendChild(subBars(s.subs));
      if(s.dup){
        const d = document.createElement('div');
        d.className = 'qc-dup';
        d.innerHTML = '<b>⚠ ' + t('qc.dup') + '</b><span>' + t('qc.dup.group', { g: s.dup.group, s: Math.round(s.dup.sim * 100), base: s.dup.base }) + '</span>';
        mid.appendChild(d);
      }

      const right = document.createElement('div');
      right.className = 'qc-right';
      const ringBox = document.createElement('div');
      ringBox.className = 'qc-ring';
      scoreRing(ringBox, s.score, PROOF.statuses[s.status].color, 58);
      const ringLabel = document.createElement('div');
      ringLabel.className = 'qc-ring-label';
      ringLabel.textContent = t('qc.score');
      ringBox.appendChild(ringLabel);
      right.appendChild(ringBox);
      const btns = document.createElement('div');
      btns.className = 'qc-btns';
      if(s.status === 'pending' || s.status === 'flagged'){
        const ok = document.createElement('button');
        ok.className = 'btn btn-ok';
        ok.textContent = t('qc.approve');
        ok.addEventListener('click', ev => { ev.stopPropagation(); setVerdict(s.id, 'verified'); });
        const no = document.createElement('button');
        no.className = 'btn btn-no';
        no.textContent = t('qc.reject');
        no.addEventListener('click', ev => { ev.stopPropagation(); setVerdict(s.id, 'rejected'); });
        btns.appendChild(ok); btns.appendChild(no);
      } else {
        const view = document.createElement('button');
        view.className = 'btn btn-ghost';
        view.textContent = t('qc.view');
        view.addEventListener('click', ev => { ev.stopPropagation(); openDrawer(s.id); });
        btns.appendChild(view);
      }
      right.appendChild(btns);

      item.appendChild(th); item.appendChild(mid); item.appendChild(right);
      item.addEventListener('click', () => openDrawer(s.id));
      list.appendChild(item);
    });
  }

  function setVerdict(id, st){
    const s = PROOF.byId(id);
    s.status = st;
    closeDrawer();
    renderQueue();
    if(window.__refreshOverview) window.__refreshOverview();
    if(window.__renderMap) window.__renderMap();
    if(window.__renderAnalytics) window.__renderAnalytics();
  }
  window.__setVerdict = setVerdict;
  window.__renderQueue = renderQueue;

  buildChips();
  renderQueue();
}

/* ---- 明细抽屉 ---- */
let DRAWER = null;
function openDrawer(id){
  const s = PROOF.byId(id);
  if(!s) return;
  closeDrawer();
  const c = PROOF.city(s.city);
  const st = PROOF.statuses[s.status];

  const bd = document.createElement('div');
  bd.className = 'drawer-backdrop';
  bd.addEventListener('click', closeDrawer);
  const pn = document.createElement('div');
  pn.className = 'drawer';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'drawer-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeDrawer);

  const head = document.createElement('div');
  head.className = 'drawer-head';
  const hL = document.createElement('div');
  const hId = document.createElement('b');
  hId.textContent = s.id;
  hL.appendChild(hId);
  const hMeta = document.createElement('div');
  hMeta.className = 'drawer-head-meta';
  hMeta.textContent = s.submitter + (s.org ? ' · ' + orgName(s.org) : '') + ' · ' + lb(c) + ', ' + lb(c.country);
  hL.appendChild(hMeta);
  head.appendChild(hL);
  head.appendChild(lvBadge(s.status));
  head.appendChild(closeBtn);
  pn.appendChild(head);

  const photo = photoEl(s, 'big');
  photo.style.height = '230px';
  pn.appendChild(photo);

  const tags = document.createElement('div');
  tags.className = 'drawer-tags';
  tags.appendChild(actTag(s.action));
  if(s.org) tags.appendChild(orgTag(s.org));
  if(s.dup){
    const d = document.createElement('span');
    d.className = 'badge badge-warn';
    d.innerHTML = '<b>⚠</b> ' + t('qc.dup.group', { g: s.dup.group, s: Math.round(s.dup.sim * 100), base: s.dup.base });
    tags.appendChild(d);
  }
  pn.appendChild(tags);

  const meta = document.createElement('div');
  meta.className = 'summary-meta';
  meta.innerHTML =
    '<div><span>' + t('drawer.time') + '</span><b>' + fmtTime(s.time) + '</b></div>' +
    '<div><span>' + t('drawer.org') + '</span><b>' + orgName(s.org) +
      (s.org && s.org.startsWith('custom:') ? ' · ' + t('drawer.org.unregistered') + (s.orgType ? ' · ' + t('org.type.' + s.orgType) : '') : '') + '</b></div>' +
    '<div><span>' + t('drawer.device') + '</span><b>' + s.device + '</b></div>' +
    '<div><span>' + t('drawer.gps') + '</span><b style="color:' + (s.gpsOk ? PROOF.statuses.verified.text : PROOF.statuses.rejected.text) + '">' + t(s.gpsOk ? 'drawer.gps.ok' : 'drawer.gps.bad') +
      (s.gpsOk && s.gps ? ' · ' + s.gps.lat.toFixed(4) + ', ' + s.gps.lon.toFixed(4) : '') + '</b></div>' +
    '<div><span>' + t('drawer.hash') + '</span><b>' + s.hash + '</b></div>';
  pn.appendChild(meta);

  const scores = document.createElement('div');
  scores.className = 'drawer-scores';
  const sHead = document.createElement('div');
  sHead.className = 'drawer-sub-title';
  sHead.textContent = t('drawer.scores');
  scores.appendChild(sHead);
  const sBody = document.createElement('div');
  sBody.className = 'drawer-scores-body';
  const ringBox = document.createElement('div');
  scoreRing(ringBox, s.score, st.color, 76);
  sBody.appendChild(ringBox);
  const bars = document.createElement('div');
  bars.className = 'drawer-subbars';
  bars.appendChild(subBars(s.subs, subSrcs(s)));
  sBody.appendChild(bars);
  scores.appendChild(sBody);
  pn.appendChild(scores);

  const verdict = document.createElement('div');
  verdict.className = 'drawer-verdict';
  const vHead = document.createElement('div');
  vHead.className = 'drawer-sub-title';
  vHead.textContent = t('drawer.verdict');
  verdict.appendChild(vHead);
  const vBtns = document.createElement('div');
  vBtns.className = 'drawer-vbtns';
  if(s.status === 'pending' || s.status === 'flagged'){
    const ok = document.createElement('button');
    ok.className = 'btn btn-ok';
    ok.textContent = t('qc.approve');
    ok.addEventListener('click', () => window.__setVerdict(s.id, 'verified'));
    const no = document.createElement('button');
    no.className = 'btn btn-no';
    no.textContent = t('qc.reject');
    no.addEventListener('click', () => window.__setVerdict(s.id, 'rejected'));
    vBtns.appendChild(ok); vBtns.appendChild(no);
  } else {
    const state = document.createElement('p');
    state.className = 'drawer-state';
    state.innerHTML = '<b>' + t(s.status === 'verified' ? 'drawer.approved' : 'drawer.rejected') + '</b>';
    vBtns.appendChild(state);
  }
  verdict.appendChild(vBtns);
  pn.appendChild(verdict);

  if(s.status !== 'verified'){
    const agentBtn = document.createElement('button');
    agentBtn.className = 'btn btn-agent';
    agentBtn.textContent = '✦ ' + t('qc.agent');
    agentBtn.addEventListener('click', () => {
      closeDrawer();
      switchTab('agent');
      setTimeout(() => agentAsk(t('agent.investigating', { id: s.id })), 350);
    });
    pn.appendChild(agentBtn);
    const hintP = document.createElement('p');
    hintP.className = 'drawer-hint';
    hintP.textContent = t('drawer.agent.hint');
    pn.appendChild(hintP);
  }
  const noteP = document.createElement('p');
  noteP.className = 'drawer-note';
  noteP.textContent = t('drawer.note');
  pn.appendChild(noteP);

  document.body.appendChild(bd);
  document.body.appendChild(pn);
  DRAWER = { bd, pn };
  window.addEventListener('keydown', escClose);
}
function escClose(ev){ if(ev.key === 'Escape') closeDrawer(); }
function closeDrawer(){
  if(DRAWER){ DRAWER.bd.remove(); DRAWER.pn.remove(); DRAWER = null; window.removeEventListener('keydown', escClose); }
}

/* ============================================================
   重复检测
   ============================================================ */
let DUP_STATE = {};

function buildDup(){
  const sec = $('#tab-dup');
  sec.innerHTML = '';
  DUP_STATE = {};

  const kpi = document.createElement('div');
  kpi.className = 'kpi-grid';
  sec.appendChild(kpi);

  const list = document.createElement('div');
  list.className = 'dup-list';
  sec.appendChild(list);

  const renderKpis = () => {
    kpi.innerHTML = '';
    const dups = PROOF.submissions.filter(s => s.dup);
    const dupRate = fmtNum(dups.length / PROOF.submissions.length * 100, 1);
    const tiles = [
      { label: t('dup.kpi.groups'), value: fmtNum(PROOF.dupGroups().length, 0), delta: t('dup.kpi.groupsNote'), deltaIcon: '⚠', deltaCls: 'warn' },
      { label: t('dup.kpi.involved'), value: fmtNum(dups.length, 0), delta: t('dup.kpi.involvedNote', { p: dupRate }), deltaIcon: '⏳', deltaCls: 'warn' },
      { label: t('dup.kpi.blocked'), value: fmtNum(PROOF.blockedMitigation(), 1) + ' tCO2e', delta: t('dup.kpi.blockedNote', { eur: fmtNum(PROOF.blockedMitigation() * PROOF.carbonFactors().priceEUR, 0) }), deltaIcon: '⛔', deltaCls: 'bad' },
      { label: t('dup.kpi.precision'), value: '96.2%', delta: t('dup.kpi.precisionNote'), deltaIcon: '✓', deltaCls: 'good' }
    ];
    tiles.forEach(o => kpi.appendChild(statTile(o)));
  };

  const render = () => {
    renderKpis();
    list.innerHTML = '';
    const groups = PROOF.dupGroups(); /* 每次渲染重算,支持会话提交的新增重复组 */
    groups.forEach(g => {
      const state = DUP_STATE[g.id];
      const item = document.createElement('div');
      item.className = 'dup-card' + (state ? ' done' : '');
      const head = document.createElement('div');
      head.className = 'dup-card-head';
      const hL = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = t('dup.group.title', { g: g.id });
      hL.appendChild(title);
      const type = document.createElement('span');
      type.className = 'dup-type';
      type.textContent = t('dup.type.' + g.type);
      hL.appendChild(type);
      head.appendChild(hL);
      const sim = document.createElement('div');
      sim.className = 'sim';
      sim.innerHTML = '<span>' + t('dup.sim') + '</span><i class="sim-track"><em style="width:' + Math.round(g.sim * 100) + '%"></em></i><b>' + fmtNum(g.sim * 100, 0) + '%</b>';
      head.appendChild(sim);
      item.appendChild(head);

      const cmp = document.createElement('div');
      cmp.className = 'cmp';
      const members = [g.base].concat(g.dups.slice().sort((a, b) => a.time - b.time));
      members.forEach(m => {
        const cell = document.createElement('div');
        cell.className = 'cmp-cell' + (m.id === g.base.id ? ' is-base' : '');
        const ph = photoEl(m, 'cmp-photo');
        const tag = document.createElement('div');
        tag.className = 'cmp-tag';
        tag.textContent = m.id === g.base.id ? t('dup.original') : t('dup.duplicate');
        const meta = document.createElement('div');
        meta.className = 'cmp-meta';
        const c = PROOF.city(m.city);
        const gap = m.id === g.base.id ? '' : (() => {
          const ms = m.time - g.base.time, h = Math.floor(ms / 3600e3);
          return h < 24 ? t('dup.gap.h', { h, m: Math.floor(ms / 60e3) % 60 }) : t('dup.gap.d', { d: Math.floor(h / 24), h: h % 24 });
        })();
        meta.innerHTML = '<span><b>' + m.id + '</b> · ' + m.submitter + '</span>' +
          '<span>' + lb(c) + ' · ' + fmtTime(m.time) + '</span>' +
          '<span>' + m.device + ' · hash ' + m.hash + (gap ? ' · ' + t('dup.timegap') + ' ' + gap : '') + '</span>';
        cell.appendChild(ph);
        cell.appendChild(tag);
        cell.appendChild(meta);
        cmp.appendChild(cell);
      });
      item.appendChild(cmp);

      /* 拦截金额:幻影积分 × EU ETS 参考价(公开因子,参考估算) */
      const blockedT = g.dups.reduce((a, d) => a + (d.tco2e || 0), 0);
      if(blockedT > 0){
        const blk = document.createElement('div');
        blk.className = 'dup-blocked';
        blk.innerHTML = '<b>⛔</b><span>' + t('dup.blocked', { t: fmtNum(blockedT, 1), eur: fmtNum(blockedT * PROOF.carbonFactors().priceEUR, 0) }) + '</span>';
        item.appendChild(blk);
      }

      const act = document.createElement('div');
      act.className = 'dup-actions';
      if(state){
        const chip = document.createElement('span');
        chip.className = 'lv lv-' + (state === 'confirmed' ? 'flagged' : 'verified');
        chip.style.color = state === 'confirmed' ? PROOF.statuses.flagged.text : PROOF.statuses.verified.text;
        chip.innerHTML = '<i>' + (state === 'confirmed' ? '⛔' : '✓') + '</i>' + t(state === 'confirmed' ? 'dup.confirmed' : 'dup.dismissed');
        act.appendChild(chip);
      } else {
        const ok = document.createElement('button');
        ok.className = 'btn btn-no';
        ok.textContent = t('dup.confirm');
        ok.addEventListener('click', () => { DUP_STATE[g.id] = 'confirmed'; render(); });
        const fp = document.createElement('button');
        fp.className = 'btn btn-ghost';
        fp.textContent = t('dup.false');
        fp.addEventListener('click', () => {
          DUP_STATE[g.id] = 'dismissed';
          g.dups.forEach(d => { d.status = 'pending'; });
          render();
          if(window.__renderQueue) window.__renderQueue();
          if(window.__refreshOverview) window.__refreshOverview();
          if(window.__renderMap) window.__renderMap();
          if(window.__renderAnalytics) window.__renderAnalytics();
        });
        act.appendChild(ok); act.appendChild(fp);
      }
      item.appendChild(act);
      list.appendChild(item);
    });

  };

  /* 检测原理说明卡(仅构建一次,render 只刷新列表与 KPI) */
  const how = card(sec, t('dup.how'), null);
  how.root.style.marginTop = '14px';
  const hp = document.createElement('p');
  hp.className = 'summary-text';
  hp.textContent = t('dup.how.text');
  how.body.appendChild(hp);

  window.__renderDup = render;
  render();
}

/* ============================================================
   分析
   ============================================================ */
let HIER = { level: 0, country: null, city: null, org: null };
let GAP_SCOPE = 'global';
let HIER_DATE = null;
let GAP_CITY = null;

function buildAnalytics(){
  const sec = $('#tab-analytics');
  sec.innerHTML = '';

  /* 分层钻取(组织 → 城市 → 国家 → 全球)+ 覆盖缺口分析 */
  const g0 = document.createElement('div');
  g0.className = 'grid-2';
  sec.appendChild(g0);
  const hierCard = card(g0, t('an.hier.title'), t('an.hier.sub'));
  const hierBody = hierCard.body;
  const gapCard = card(g0, t('an.gap.title'), t('an.gap.sub'));
  const gapBody = gapCard.body;
  gapBody.classList.add('gap-body');

  function renderHier(){
    hierBody.innerHTML = '';
    const period = document.createElement('div');
    period.className = 'hier-period';
    const dateLabel = document.createElement('span');
    dateLabel.textContent = t('mapx.period') + ': ' + (HIER_DATE || t('mapx.allDates'));
    const dateInput = document.createElement('input');
    dateInput.type = 'date'; dateInput.className = 'txt-in'; dateInput.value = HIER_DATE || '';
    dateInput.setAttribute('aria-label', t('mapx.analyticsDate'));
    dateInput.addEventListener('change', () => { HIER_DATE = dateInput.value || null; renderHier(); renderGap(); });
    const clearDate = document.createElement('button');
    clearDate.className = 'btn btn-ghost'; clearDate.textContent = t('mapx.allDates');
    clearDate.addEventListener('click', () => { HIER_DATE = null; renderHier(); renderGap(); });
    period.append(dateLabel, dateInput, clearDate); hierBody.appendChild(period);
    const periodSubs = PROOF.scopeSubs(null, null, null, HIER_DATE);
    /* 面包屑 */
    const crumb = document.createElement('div');
    crumb.className = 'hier-crumb';
    const levels = [{ label: t('an.hier.global'), click: () => { HIER = { level: 0, country: null, city: null, org: null }; renderHier(); } }];
    if(HIER.country != null) levels.push({ label: countryName(HIER.country), click: () => { HIER = { level: 1, country: HIER.country, city: null, org: null }; renderHier(); } });
    if(HIER.city != null) levels.push({ label: lb(PROOF.city(HIER.city)), click: () => { HIER = { level: 2, country: HIER.country, city: HIER.city, org: null }; renderHier(); } });
    if(HIER.org != null) levels.push({ label: HIER.org === 'individual' ? t('an.hier.individual') : orgName(HIER.org), click: null });
    levels.forEach((l, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === levels.length - 1 ? ' active' : '');
      b.textContent = l.label;
      if(l.click) b.addEventListener('click', l.click);
      crumb.appendChild(b);
    });
    hierBody.appendChild(crumb);

    const mkRow = (icon, name, sub, stat, click) => {
      const row = document.createElement('div');
      row.className = 'hier-row';
      row.innerHTML = '<div class="hier-name"><span class="hier-ico">' + icon + '</span><span>' + name + '</span>' +
        (sub ? '<em class="hier-sub">' + sub + '</em>' : '') + '</div>' +
        '<span class="hier-counts"><b>' + stat.count + '</b>' +
        '<span style="color:' + PROOF.statuses.verified.text + '">✓' + stat.verified + '</span>' +
        '<span style="color:' + PROOF.statuses.flagged.text + '">⚠' + stat.flagged + '</span>' +
        '<span style="color:' + PROOF.statuses.rejected.text + '">✗' + stat.rejected + '</span></span>' +
        '<span class="hier-avg">' + fmtNum(stat.avg, 1) + '</span>' +
        '<span class="hier-chevron">›</span>';
      row.addEventListener('click', click);
      hierBody.appendChild(row);
    };

    let rows = null;
    if(HIER.level === 0){
      rows = PROOF.countryRows(periodSubs).map(r => ({ icon: '🌐', name: lb(r.name), sub: null, stat: r,
        click: () => { HIER = { level: 1, country: r.key, city: null, org: null }; renderHier(); } }));
    } else if(HIER.level === 1){
      rows = PROOF.cityRows(HIER.country, periodSubs).map(r => ({ icon: '🏙️', name: lb(r.name), sub: null, stat: r,
        click: () => { HIER = { level: 2, country: HIER.country, city: r.key, org: null }; renderHier(); } }));
    } else if(HIER.level === 2){
      rows = PROOF.orgRows(HIER.city, periodSubs).map(r => ({
        icon: r.key === 'individual' ? '🙂' : (TYPE_ICONS[r.type] || '🏢'),
        name: r.key === 'individual' ? t('an.hier.individual') : lb(r.name),
        sub: r.key === 'individual' ? null : t('org.type.' + r.type),
        stat: r,
        click: () => { HIER = { level: 3, country: HIER.country, city: HIER.city, org: r.key }; renderHier(); }
      }));
    }
    if(rows === null){
      /* 组织层:直接列出该组织的提交 */
      const subs = PROOF.scopeSubs(HIER.country, HIER.city, HIER.org, HIER_DATE);
      if(!subs.length){
        const p = document.createElement('p');
        p.className = 'muted-text';
        p.textContent = t('an.hier.none');
        hierBody.appendChild(p);
      }
      subs.slice().sort((a, b) => b.time - a.time).forEach(s => {
        const row = document.createElement('div');
        row.className = 'feed-row';
        const th = photoThumb(s, 56);
        const info = document.createElement('div');
        info.className = 'feed-info';
        const top = document.createElement('div');
        top.className = 'feed-top';
        const idEl = document.createElement('b');
        idEl.textContent = s.id;
        top.appendChild(idEl);
        top.appendChild(lvBadge(s.status));
        top.appendChild(actTag(s.action));
        const meta = document.createElement('div');
        meta.className = 'feed-meta';
        meta.textContent = s.submitter + ' · ' + lb(PROOF.city(s.city)) + ' · ' + fmtTime(s.time) + ' · ' + t('qc.score') + ' ' + s.score;
        info.appendChild(top); info.appendChild(meta);
        row.appendChild(th); row.appendChild(info);
        row.addEventListener('click', () => openDrawer(s.id));
        hierBody.appendChild(row);
      });
    } else if(!rows.length){
      const p = document.createElement('p');
      p.className = 'muted-text';
      p.textContent = t('an.hier.none');
      hierBody.appendChild(p);
    } else {
      rows.forEach(r => mkRow(r.icon, r.name, r.sub, r.stat, r.click));
    }
  }

  window.__openMapAnalytics = state => {
    HIER = { level: state.city != null ? 2 : (state.country ? 1 : 0), country: state.country, city: state.city, org: null };
    HIER_DATE = state.date;
    GAP_SCOPE = state.country || 'global';
    GAP_CITY = state.city;
    renderHier(); renderGap();
    switchTab('analytics');
    hierCard.root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function renderGap(){
    gapBody.innerHTML = '';
    const gapSubs = PROOF.scopeSubs(null, GAP_CITY, null, HIER_DATE);
    const scopes = GAP_CITY != null ? [{ key: GAP_SCOPE }] : PROOF.gapScopes(gapSubs);
    const period = document.createElement('p');
    period.className = 'qc-hint'; period.textContent = t('mapx.period') + ': ' + (HIER_DATE || t('mapx.allDates'));
    gapBody.appendChild(period);
    const row = document.createElement('div');
    row.className = 'chip-row';
    scopes.forEach(sc => {
      const b = document.createElement('button');
      b.className = 'chip' + (GAP_SCOPE === sc.key ? ' active' : '');
      b.textContent = GAP_CITY != null ? lb(PROOF.city(GAP_CITY)) : sc.key === 'global' ? t('an.gap.global') : countryName(sc.key);
      b.addEventListener('click', () => { GAP_SCOPE = sc.key; renderGap(); });
      row.appendChild(b);
    });
    gapBody.appendChild(row);
    if(GAP_CITY != null){
      const clearCity = document.createElement('button');
      clearCity.className = 'link-btn'; clearCity.textContent = t('map.city.all');
      clearCity.addEventListener('click', () => { GAP_CITY = null; renderGap(); }); gapBody.appendChild(clearCity);
    }
    const scopeLabel = GAP_CITY != null ? lb(PROOF.city(GAP_CITY)) : GAP_SCOPE === 'global' ? t('an.gap.global') : countryName(GAP_SCOPE);
    const cards = PROOF.gapAnalysis(GAP_SCOPE, gapSubs);
    if(!cards.length){
      const p = document.createElement('p');
      p.className = 'muted-text';
      p.textContent = gapSubs.filter(s => s.status === 'verified' && (GAP_SCOPE === 'global' || PROOF.city(s.city).country.en === GAP_SCOPE)).length >= 4 ? t('an.gap.balanced') : t('an.gap.none');
      gapBody.appendChild(p);
      return;
    }
    cards.forEach(cd => {
      const c = document.createElement('div');
      c.className = 'gap-card';
      const head = document.createElement('div');
      head.className = 'gap-head';
      const title = document.createElement('b');
      const tag = document.createElement('span');
      tag.className = 'gap-tag';
      head.innerHTML = '<span class="gap-ico">💡</span>';
      head.appendChild(title); head.appendChild(tag);
      c.appendChild(head);
      const text = document.createElement('p');
      text.className = 'gap-text';
      c.appendChild(text);
      let bars;
      if(cd.kind === 'cat'){
        title.textContent = t('gap.card.cat.title', { scope: scopeLabel, weakCat: catName(cd.weakCat) });
        tag.textContent = t('gap.tag.cat');
        text.textContent = t('gap.card.cat.text', {
          scope: scopeLabel, domCat: catName(cd.domCat), weakCat: catName(cd.weakCat),
          d: cd.d, w: cd.w, suggest: ACT[cd.suggest].icon + ' ' + t('act.' + cd.suggest)
        });
        bars = [
          { label: catName(cd.domCat), color: CAT[cd.domCat].color, v: cd.d },
          { label: catName(cd.weakCat), color: CAT[cd.weakCat].color, v: cd.w }
        ];
      } else {
        title.textContent = t('gap.card.action.title', { scope: scopeLabel, weak: t('act.' + cd.weak) });
        tag.textContent = t('gap.tag.action');
        text.textContent = t('gap.card.action.text', {
          scope: scopeLabel, cat: catName(cd.cat), dom: t('act.' + cd.dom), weak: t('act.' + cd.weak), d: cd.d, w: cd.w
        });
        bars = [
          { label: t('act.' + cd.dom), color: ACT[cd.dom].color, v: cd.d },
          { label: t('act.' + cd.weak), color: ACT[cd.weak].color, v: cd.w }
        ];
      }
      bars.forEach(bb => {
        const r = document.createElement('div');
        r.className = 'gap-bar-row';
        r.innerHTML = '<span class="gname">' + bb.label + '</span><i class="gap-track"><em style="width:' + bb.v + '%;background:' + bb.color + '"></em></i><b>' + bb.v + '%</b>';
        c.appendChild(r);
      });
      gapBody.appendChild(c);
    });
  }

  renderHier();
  renderGap();
  window.__renderAnalytics = () => { renderHier(); renderGap(); };

  const g1 = document.createElement('div');
  g1.className = 'grid-2-1';
  sec.appendChild(g1);
  const thruCard = card(g1, t('an.thru.title'), t('an.thru.sub'));
  const devCard = card(g1, t('an.dev.title'), t('an.dev.sub'));

  const tp = PROOF.throughput();
  thruCard.body.innerHTML = '';
  const s1 = { name: t('an.series.in'), color: '#2a78d6', values: tp.in };
  const s2 = { name: t('an.series.ok'), color: '#eb6834', values: tp.ok };
  lineChart(thruCard.body, { x: tp.labels, series: [s1, s2], fmtY: v => fmtNum(v, 0) });
  legend(thruCard.body, [s1, s2]);

  const globalAvg = PROOF.kpis().avg;
  devCard.body.innerHTML = '';
  divergingBars(devCard.body, {
    items: PROOF.byAction().map(a => ({ label: a.icon + ' ' + t('act.' + a.key), value: Math.round((a.avg - globalAvg) * 10) / 10 })),
    fmtY: v => fmtNum(v, 1)
  });

  const g2 = document.createElement('div');
  g2.className = 'grid-2';
  sec.appendChild(g2);
  const modelCard = card(g2, t('an.model.title'), t('an.model.sub'));
  const thCard = card(g2, t('an.th.title'), t('an.th.sub'));

  const sm = PROOF.subModels();
  modelCard.body.innerHTML = '';
  const tb = document.createElement('div');
  tb.className = 'chart-table';
  tb.innerHTML = '<table><thead><tr><th>' + t('table.model') + '</th><th>' + t('table.mean') + '</th><th>' + t('table.floor') + '</th></tr></thead><tbody></tbody></table>';
  [['auth', 'qc.auth'], ['action', 'qc.action'], ['loc', 'qc.loc']].forEach(([k, key]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + t(key) + '</td><td>' + fmtNum(sm[k].mean, 1) + '</td><td>' + fmtNum(sm[k].floor, 1) + '%</td>';
    tb.querySelector('tbody').appendChild(tr);
  });
  modelCard.body.appendChild(tb);

  thCard.body.innerHTML = '';
  const thBox = document.createElement('div');
  thBox.className = 'th-box';
  [['an.th.1', 'lv-verified'], ['an.th.2', 'lv-pending'], ['an.th.3', 'lv-rejected'], ['an.th.4', 'lv-flagged']].forEach(([k, cls]) => {
    const row = document.createElement('div');
    row.className = 'th-row';
    const b = document.createElement('span');
    b.className = 'lv ' + cls;
    const stMap = { 'lv-verified': 'verified', 'lv-pending': 'pending', 'lv-rejected': 'rejected', 'lv-flagged': 'flagged' };
    const st = PROOF.statuses[stMap[cls]];
    b.style.color = st.text;
    b.innerHTML = '<i>' + st.icon + '</i>';
    row.appendChild(b);
    const p = document.createElement('p');
    p.textContent = t(k);
    row.appendChild(p);
    thBox.appendChild(row);
  });
  thCard.body.appendChild(thBox);

  const g3 = document.createElement('div');
  g3.className = 'grid-2';
  sec.appendChild(g3);
  const reviewed = PROOF.submissions.filter(s => s.status === 'pending' || s.status === 'flagged').length;
  const agree = Math.max(0, reviewed - 1);
  const agreeRate = reviewed > 0 ? agree / reviewed * 100 : 0;
  const flipRate = 100 - agreeRate;
  const mCard = card(g3, t('an.matrix.title'), t('an.matrix.sub', { p: fmtNum(agreeRate, 1) }));
  mCard.body.innerHTML = '';
  const mg = document.createElement('div');
  mg.className = 'sim-out';
  mg.style.marginTop = '6px';
  mg.innerHTML =
    '<div class="sim-tile"><span>' + t('an.matrix.total') + '</span><b>' + reviewed + '</b><i>' + t('kpi.pendingNote') + '</i></div>' +
    '<div class="sim-tile"><span>' + t('an.matrix.agree') + '</span><b style="color:#006300">' + agree + '</b><i>' + fmtNum(agreeRate, 1) + '%</i></div>' +
    '<div class="sim-tile"><span>' + t('an.matrix.flip') + '</span><b style="color:#b3261e">1</b><i>' + fmtNum(flipRate, 1) + '%</i></div>';
  mCard.body.appendChild(mg);
  const mNote = document.createElement('p');
  mNote.className = 'summary-note';
  mNote.textContent = t('drawer.agent.hint');
  mCard.body.appendChild(mNote);

  /* 分数校准卡:分箱 vs 自动通过 + 演示人工一致率参考线 */
  const g4 = document.createElement('div');
  g4.className = 'grid-2';
  sec.appendChild(g4);
  const calCard = card(g4, t('an.cal.title'), t('an.cal.sub'));
  calCard.body.innerHTML = '';
  const calRows = PROOF.calibration();
  const maxCount = Math.max(1, ...calRows.map(r => r.count));
  const maxAuto = Math.max(1, ...calRows.map(r => r.autoPass));
  const calTable = document.createElement('div');
  calTable.className = 'cal-bins';
  calRows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'cal-bin';
    row.innerHTML =
      '<span class="cal-label">' + r.label + '</span>' +
      '<span class="cal-track c1" title="' + t('an.cal.col.subs') + ' ' + r.count + '"><i style="width:' + (r.count / maxCount * 100) + '%"></i><b>' + r.count + '</b></span>' +
      '<span class="cal-track c2" title="' + t('an.cal.col.auto') + ' ' + r.autoPass + '"><i style="width:' + (r.autoPass / maxAuto * 100) + '%"></i><b>' + r.autoPass + '</b></span>' +
      '<span class="cal-track c3" title="' + t('an.cal.col.agree') + '"><i style="width:' + fmtNum(agreeRate, 1) + '%"></i><b>' + fmtNum(agreeRate, 1) + '%</b></span>';
    calTable.appendChild(row);
  });
  calCard.body.appendChild(calTable);
  const calLeg = document.createElement('div');
  calLeg.className = 'cal-legend';
  calLeg.innerHTML = '<span><i class="c1"></i>' + t('an.cal.col.subs') + '</span><span><i class="c2"></i>' + t('an.cal.col.auto') + '</span><span><i class="c3"></i>' + t('an.cal.agree.demo') + '</span>';
  calCard.body.appendChild(calLeg);
  const calNote = document.createElement('p');
  calNote.className = 'summary-note';
  calNote.textContent = t('an.cal.note');
  calCard.body.appendChild(calNote);

  /* 行动碳参考因子表(公开来源 + 年份;参考估算,非已发放积分) */
  const carbonCard = card(g4, t('carbon.table.title'), t('carbon.table.sub'));
  carbonCard.body.innerHTML = '';
  const C = PROOF.carbonFactors();
  const ctb = document.createElement('div');
  ctb.className = 'chart-table';
  ctb.innerHTML = '<table><thead><tr><th>' + t('table.action') + '</th><th>tCO2e</th><th>' + t('carbon.col.unit') + '</th><th>' + t('carbon.col.source') + ' · ' + t('carbon.col.year') + '</th><th>' + t('carbon.col.value') + '</th></tr></thead><tbody></tbody></table>';
  PROOF.actions.forEach(a => {
    const f = C.actions[a.key];
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + a.icon + ' ' + t('act.' + a.key) + '</td>' +
      '<td><b>' + fmtNum(f.t, 1) + '</b></td>' +
      '<td>' + lb(f.unit) + '</td>' +
      '<td style="color:var(--text-muted);font-size:10.5px">' + lb(f.source) + ' (' + f.year + ')</td>' +
      '<td>€' + fmtNum(f.t * C.priceEUR, 0) + '</td>';
    ctb.querySelector('tbody').appendChild(tr);
  });
  carbonCard.body.appendChild(ctb);
  const cNote = document.createElement('p');
  cNote.className = 'summary-note';
  cNote.textContent = t('carbon.ref') + ' · EU ETS €' + C.priceEUR + '/tCO2e (2024–2026)';
  carbonCard.body.appendChild(cNote);
}

/* ============================================================
   行动地图(全球 → 国家 → 城市 · 日期回放)
   ============================================================ */
/* ============================================================
   智能体
   ============================================================ */
function agentSteps(sub){
  const dup = sub.dup;
  const city = PROOF.city(sub.city);
  const steps = [];

  steps.push({
    icon: '📋', title: 'agent.step.read', chips: ['EXIF.read', 'GPS.resolve', 'SHA-256'],
    text: (LANG === 'zh' ? '读取 ' : 'Reading ') + sub.id + ':设备 ' + sub.device + ',GPS ' + t(sub.gpsOk ? 'drawer.gps.ok' : 'drawer.gps.bad') + ',指纹 ' + sub.hash + ',申报地点 ' + lb(city) + '(' + lb(city.country) + ')。'
  });

  /* ---- 第 2 步:取证复核(会话上传 = 实测取证;档案快照如实说明) ---- */
  const fx = sub.forensics;
  let fxText, fxChips, fxImg = null;
  if(fx){
    fxChips = ['ELA.compute', 'EXIF.parse', 'C2PA.scan'];
    fxText = t('agent.fx.ela', {
      m: fx.ela ? fmtNum(fx.ela.meanErr, 1) : '—',
      p: fx.ela ? fmtNum(fx.ela.highRatio * 100, 0) + '%' : '—'
    });
    if(fx.ela && String(sub.mime || '').toLowerCase().includes('png')) fxText += t('agent.fx.ela.png');
    else if(fx.ela) fxText += t('agent.fx.ela.' + (fx.ela.highRatio > 0.3 ? 'high' : (fx.ela.highRatio < 0.12 ? 'low' : 'mid')));
    if(fx.exif && fx.exif.hasExif){
      fxText += t('agent.fx.exif.ok', { make: fx.exif.make || '—', model: fx.exif.model || '—', t: fx.exif.dateTimeOriginal || fx.exif.dateTime || '—' });
      if(fx.exif.software) fxText += t('agent.fx.exif.sw', { sw: fx.exif.software });
    } else {
      fxText += t('agent.fx.exif.missing');
    }
    fxText += t('agent.fx.prov', { s: (fx.provenance && fx.provenance.c2pa) ? t('agent.fx.prov.yes') : t('agent.fx.prov.no') });
    if(fx.ela && fx.ela.heatmap) fxImg = fx.ela.heatmap;
  } else {
    fxChips = ['archive.snapshot'];
    fxText = t('agent.fx.archive');
  }
  steps.push({ icon: '🔬', title: 'agent.step.forensics', chips: fxChips, text: fxText, img: fxImg });

  /* ---- 第 3 步:地理交叉验证(EXIF GPS 实测 haversine;否则演示派生) ---- */
  let geoTxt, geoChips;
  if(fx && fx.gpsKm != null){
    geoTxt = t('agent.geo.gps', { city: lb(city), km: fmtNum(fx.gpsKm, 1), loc: sub.subs.loc });
    geoChips = ['GPS.read', 'Haversine.dist'];
  } else if(dup){
    geoTxt = LANG === 'zh'
      ? '坐标与原始提交 ' + dup.base + ' 一致(网格 ' + city.grid + '),但提交时间不同 — 支持"同一现场多次申报"假设。'
      : 'Coordinates match original ' + dup.base + ' (grid ' + city.grid + ') but the timestamp differs — consistent with a resubmission.';
    geoChips = ['Grid.demo'];
  } else {
    geoTxt = t('agent.geo.demo', { loc: sub.subs.loc });
    geoChips = ['GPS.missing', 'Grid.demo'];
  }
  steps.push({ icon: '📍', title: 'agent.step.geo', chips: geoChips, text: geoTxt });

  /* ---- 第 4 步:登记库比对(真实计数:同城市 + 同行动 + 同季度;未登记组织 → ORG_UNREGISTERED) ---- */
  const sameQuarter = (a, b) => a.getFullYear() === b.getFullYear() && Math.floor(a.getMonth() / 3) === Math.floor(b.getMonth() / 3);
  const regN = PROOF.submissions.filter(x => x.action === sub.action && x.city === sub.city && sameQuarter(x.time, sub.time)).length;
  const isCustomOrg = !!(sub.org && sub.org.startsWith('custom:'));
  let regTxt, regChips;
  if(isCustomOrg){
    regTxt = t('agent.reg.unreg', { name: orgName(sub.org), n: regN });
    regChips = ['ClimateRegistry.query', 'ORG_UNREGISTERED'];
  } else if(dup){
    regTxt = LANG === 'zh'
      ? '登记库 pHash-DCT 索引命中:与 ' + dup.base + ' 汉明距离 ' + (dup.type === 'exact' ? '0(哈希一致)' : (dup.hd != null ? dup.hd : '≤ 4(档案)')) + ',相似度 ' + fmtNum(dup.sim * 100, 0) + '%。同一行动已存在有效登记,本次申报构成重复。'
      : 'Registry pHash-DCT index hit: Hamming distance vs ' + dup.base + ' = ' + (dup.type === 'exact' ? '0 (exact hash)' : (dup.hd != null ? dup.hd : '≤ 4 (archive)')) + ', similarity ' + fmtNum(dup.sim * 100, 0) + '%. A valid registration already exists — this submission is a duplicate.';
    regChips = ['ClimateRegistry.query', 'pHash-DCT.search'];
  } else {
    regTxt = t('agent.reg.real', { n: regN });
    regChips = ['ClimateRegistry.query', 'pHash-DCT.search'];
  }
  steps.push({ icon: '🗂️', title: 'agent.step.registry', chips: regChips, text: regTxt });

  let verdict;
  if(dup){
    verdict = {
      status: 'rejected', conf: Math.min(97, Math.round(88 + dup.sim * 10)),
      rationale: dup.type === 'exact'
        ? (LANG === 'zh' ? '哈希一致,同一文件重复提交。建议驳回并拦截碳积分发放。' : 'Exact hash — the same file was submitted twice. Recommend rejecting and blocking credit issuance.')
        : (LANG === 'zh' ? 'pHash 与视觉嵌入双通道命中,判定为同一照片经变换后重传。建议驳回并拦截积分发放。' : 'Both pHash and visual embeddings match — the same photo re-uploaded after transformation. Recommend rejecting and blocking credit issuance.'),
      evidence: [
        'pHash-DCT 64-bit · Hamming ' + (dup.type === 'exact' ? '0' : (dup.hd != null ? dup.hd : 'n/a (archive)')),
        'similarity ' + fmtNum(dup.sim * 100, 0) + '% vs ' + dup.base,
        'same device · ' + sub.device,
        'ClimateRegistry: valid entry exists'
      ]
    };
  } else if(sub.subs.auth < 70 || sub.score < 60){
    verdict = {
      status: 'rejected', conf: 82,
      rationale: LANG === 'zh' ? '取证与综合评分均不达标,建议驳回。' : 'Forensics and composite score both fail the bar — recommend rejecting.',
      evidence: ['authenticity ' + sub.subs.auth, 'composite ' + sub.score + ' < 60']
    };
  } else if(!sub.gpsOk || sub.subs.loc < 60){
    verdict = {
      status: 'pending', conf: 68,
      rationale: LANG === 'zh' ? '地理一致性存疑,建议保留待复核并安排实地核验。' : 'Geolocation consistency is questionable — recommend holding for review with a field check.',
      evidence: ['GPS ' + (sub.gpsOk ? 'valid but far from claimed city' : 'missing/suspicious'), 'geolocation score ' + sub.subs.loc]
    };
  } else if(isCustomOrg){
    /* 未登记组织:自动验证降级为人工复核,补验行动地点与授权 */
    verdict = {
      status: 'pending', conf: 64,
      rationale: t('agent.unreg.rationale'),
      evidence: [
        'ORG_UNREGISTERED: ' + orgName(sub.org),
        'registry same-action entries: ' + regN,
        t('agent.unreg.evidence')
      ]
    };
  } else {
    verdict = {
      status: 'verified', conf: Math.min(96, Math.round(78 + sub.score / 5)),
      rationale: LANG === 'zh' ? '三维验证均通过,登记库无重复,建议通过。' : 'All three models pass and the registry shows no duplicate — recommend approving.',
      evidence: ['composite ' + sub.score, 'auth ' + sub.subs.auth + ' · action ' + sub.subs.action + ' · loc ' + sub.subs.loc, 'registry: no duplicate found']
    };
  }
  return { steps, verdict };
}

let AGENT_BUSY = false;

function buildAgent(){
  const sec = $('#tab-agent');
  sec.innerHTML = '';

  /* 流水线 */
  const pipeCard = card(sec, t('agent.pipe.title'), t('agent.pipe.sub'));
  const pipe = document.createElement('div');
  pipe.className = 'pipe';
  const nodes = ['agent.pipe.1', 'agent.pipe.2', 'agent.pipe.3', 'agent.pipe.4', 'agent.pipe.5', 'agent.pipe.6'];
  nodes.forEach((k, i) => {
    const n = document.createElement('div');
    n.className = 'pipe-node' + (i === 4 ? ' agent-node' : '');
    n.innerHTML = '<span class="pipe-step">' + (i + 1) + '</span><b>' + t(k) + '</b>' +
      (i === 4 ? '<em>' + t('agent.pipe.tag') + '</em>' : '');
    pipe.appendChild(n);
    if(i < nodes.length - 1){
      const arr = document.createElement('div');
      arr.className = 'pipe-arrow';
      arr.textContent = '→';
      pipe.appendChild(arr);
    }
  });
  pipeCard.body.appendChild(pipe);

  /* 对话区 */
  const grid = document.createElement('div');
  grid.className = 'chat-grid';
  sec.appendChild(grid);

  const chatCard = card(grid, t('agent.chat.title'), t('agent.chat.sub'));
  chatCard.root.classList.add('chat-panel');
  const log = document.createElement('div');
  log.className = 'chat-log';
  log.id = 'agent-log';
  chatCard.body.appendChild(log);
  const input = document.createElement('div');
  input.className = 'chat-input';
  input.innerHTML = '<input id="agent-in" type="text" placeholder="' + t('agent.placeholder') + '"><button id="agent-send">' + t('agent.send') + '</button>';
  chatCard.body.appendChild(input);
  grid.appendChild(chatCard.root);

  const side = document.createElement('div');
  side.className = 'chat-side';
  const capCard = card(side, t('agent.cap.title'), null);
  const caps = ['agent.cap.1t', 'agent.cap.2t', 'agent.cap.3t', 'agent.cap.4t'];
  capCard.body.innerHTML = '<ul class="cap-list">' + caps.map((k, i) =>
    '<li><b>' + t(k) + '</b>' + t(k.replace('t', 'd')) + '</li>').join('') + '</ul>';
  side.appendChild(capCard.root);

  const qCard = card(side, t('agent.quick.title'), null);
  qCard.body.innerHTML = '<div class="chat-chips" style="padding:0">' +
    ['agent.q1', 'agent.q2', 'agent.q3', 'agent.q4', 'agent.q5'].map((k, i) =>
      '<button data-q="' + i + '">' + t(k) + '</button>').join('') + '</div>';
  side.appendChild(qCard.root);
  grid.appendChild(side);

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const addUser = text => {
    const m = document.createElement('div');
    m.className = 'msg msg-user';
    m.innerHTML = '<div class="msg-avatar">U</div><div class="bubble"><div class="bubble-body"></div></div>';
    m.querySelector('.bubble-body').textContent = text;
    log.appendChild(m);
    scroll();
  };
  const addAIText = text => {
    const m = document.createElement('div');
    m.className = 'msg msg-ai';
    m.innerHTML = '<div class="msg-avatar">✦</div><div class="bubble"><div class="bubble-body"></div></div>';
    m.querySelector('.bubble-body').textContent = text;
    log.appendChild(m);
    scroll();
    return m;
  };
  const addTyping = () => {
    const m = document.createElement('div');
    m.className = 'msg msg-ai';
    m.innerHTML = '<div class="msg-avatar">✦</div><div class="bubble typing"><i></i><i></i><i></i></div>';
    log.appendChild(m);
    scroll();
    return m;
  };
  const addStep = stp => {
    const m = document.createElement('div');
    m.className = 'msg msg-ai';
    const chips = (stp.chips || []).map(c => '<span>' + c + '</span>').join('');
    m.innerHTML = '<div class="msg-avatar">✦</div><div class="bubble agent-step">' +
      '<div class="step-title">' + stp.icon + ' ' + t(stp.title) + '</div>' +
      '<div class="bubble-body"></div>' +
      (stp.img ? '<img class="step-img" src="' + stp.img + '" alt="ELA heatmap">' : '') +
      (chips ? '<div class="bubble-src">' + chips + '</div>' : '') +
      '</div>';
    m.querySelector('.bubble-body').textContent = stp.text;
    log.appendChild(m);
    scroll();
  };
  const addVerdict = v => {
    const st = PROOF.statuses[v.status];
    const m = document.createElement('div');
    m.className = 'msg msg-ai';
    m.innerHTML = '<div class="msg-avatar">✦</div><div class="bubble agent-verdict">' +
      '<div class="step-title">📄 ' + t('agent.verdict') + '</div>' +
      '<div class="verdict-row"><span class="lv lv-' + v.status + '" style="color:' + st.text + '"><i>' + st.icon + '</i>' + t('status.' + v.status) + '</span>' +
      '<span class="verdict-conf">' + t('agent.conf') + ' <b>' + v.conf + '%</b></span></div>' +
      '<p class="verdict-why"></p>' +
      '<div class="evidence"><b>' + t('agent.evidence') + '</b><ul>' + v.evidence.map(e => '<li>' + e + '</li>').join('') + '</ul></div>' +
      '</div>';
    m.querySelector('.verdict-why').textContent = v.rationale;
    log.appendChild(m);
    scroll();
  };

  function runInvestigation(id){
    const sub = PROOF.byId(id);
    if(AGENT_BUSY) return;
    if(!sub){ addAIText(LANG === 'zh' ? '未找到提交 ' + id + '。试试 PA-1082。' : 'Submission ' + id + ' not found. Try PA-1082.'); return; }
    AGENT_BUSY = true;
    const { steps, verdict } = agentSteps(sub);
    const typing = addTyping();
    let delay = 950;
    steps.forEach((stp, i) => {
      setTimeout(() => {
        if(i === 0) typing.remove();
        addStep(stp);
        if(i === steps.length - 1) setTimeout(() => { addVerdict(verdict); AGENT_BUSY = false; }, 700);
      }, delay);
      delay += 1100;
    });
  }

  function agentAsk(text){
    addUser(text);
    const idMatch = text.match(/PA-\d+/i);
    if(idMatch){
      setTimeout(() => runInvestigation(idMatch[0].toUpperCase()), 420);
      return;
    }
    setTimeout(() => {
      const q = text.toLowerCase();
      let ans;
      if(/(重复|duplicate|dedup)/.test(q) && !/(如何|怎么|原理|how|work)/.test(q)){
        ans = t('dup.how.text');
      } else if(/(重复|duplicate|dedup|哈希|hash)/.test(q)){
        ans = t('dup.how.text');
      } else if(/(待复核|pending|awaiting)/.test(q)){
        const K = PROOF.kpis();
        ans = (LANG === 'zh' ? '当前有 ' + K.pending + ' 条提交待人工复核,另有 ' + (PROOF.submissions.filter(s => s.status === 'flagged').length) + ' 条重复待查。可在审核队列中处理。' : 'Currently ' + K.pending + ' submissions await human review, plus ' + (PROOF.submissions.filter(s => s.status === 'flagged').length) + ' duplicate flags. You can handle them in the Review Queue.');
      } else if(/(低于|below|< ?60|60 分)/.test(q)){
        ans = t('an.th.3') + ';' + t('an.th.4') + '。';
      } else if(/(角色|role|pipeline|流水线)/.test(q)){
        ans = LANG === 'zh' ? '我在验证流水线中位于"重复检测"之后、"结果发布"之前:对重复待查与低分提交做证据核查,输出可引用的判定建议,拦截误判与重复积分发放。' : 'I sit between duplicate detection and result publishing: I run evidence checks on duplicate flags and low-score submissions, and output citable verdict suggestions that intercept misjudgements and double credit issuance.';
      } else if(/(评分|score|模型|model)/.test(q)){
        ans = LANG === 'zh' ? '综合分 = 图像真实性 × 40% + 行动匹配度 × 35% + 地理一致性 × 25%。≥85 自动通过,60–85 人工复核,<60 自动驳回。' : 'Composite = authenticity × 40% + action match × 35% + geolocation × 25%. ≥85 auto-approved, 60–85 human review, <60 auto-rejected.';
      } else {
        ans = LANG === 'zh' ? '我可以调查具体提交(输入编号,如 PA-1082)、汇报待复核数量、解释重复检测原理与评分模型。' : 'I can investigate a specific submission (type an ID, e.g. PA-1082), report pending counts, and explain dedupe or scoring.';
      }
      addAIText(ans);
    }, 420);
  }
  window.__agentAsk = agentAsk;

  /* 欢迎语 */
  const wel = addAIText(t('agent.welcome'));
  wel.querySelector('.bubble-body').style.whiteSpace = 'pre-line';

  $('#agent-send').addEventListener('click', () => {
    const inp = $('#agent-in');
    const v = inp.value.trim();
    if(!v) return;
    inp.value = '';
    agentAsk(v);
  });
  $('#agent-in').addEventListener('keydown', ev => { if(ev.key === 'Enter') $('#agent-send').click(); });
  $$('#tab-agent [data-q]').forEach(b => {
    b.addEventListener('click', () => agentAsk(t('agent.q' + (Number(b.dataset.q) + 1))));
  });
}

/* ============================================================
   提交验证(闭环:上传 → 验证 → 结果与凭据)
   ============================================================ */
let SUBMIT = { stage: 1, file: null, url: null, dims: null, action: null, city: 0, name: '', orgMode: 'org', org: 'org-gbg', orgCustom: '', orgType: 'community', date: null, result: null };

function buildSubmit(){
  const sec = $('#tab-submit');
  sec.innerHTML = '';
  SUBMIT = { stage: 1, file: null, url: null, dims: null, action: null, city: 0, name: '', orgMode: 'org', org: 'org-gbg', orgCustom: '', orgType: 'community', date: null, result: null };

  /* 步骤条 */
  const stepper = document.createElement('div');
  stepper.className = 'stepper';
  ['submit.step1', 'submit.step2', 'submit.step3'].forEach((k, i) => {
    const it = document.createElement('div');
    it.className = 'stepper-item';
    it.innerHTML = '<i>' + (i + 1) + '</i><span>' + t(k) + '</span>';
    stepper.appendChild(it);
    if(i < 2){ const ln = document.createElement('div'); ln.className = 'stepper-line'; stepper.appendChild(ln); }
  });
  sec.appendChild(stepper);

  const c = card(sec, t('submit.title'), t('submit.sub'));
  const body = c.body;

  const renderStage = () => {
    body.innerHTML = '';
    if(SUBMIT.stage === 1) renderStage1(body);
    else if(SUBMIT.stage === 2) renderStage2(body);
    else renderStage3(body);
    stepper.querySelectorAll('.stepper-item').forEach((it, i) => {
      it.classList.toggle('active', SUBMIT.stage === i + 1);
      it.classList.toggle('done', SUBMIT.stage > i + 1);
    });
    renderSessionList();
  };

  function setFile(f){
    SUBMIT.file = f;
    if(SUBMIT.url) URL.revokeObjectURL(SUBMIT.url);
    SUBMIT.url = URL.createObjectURL(f);
    SUBMIT.dims = null;
    const img = new Image();
    img.onload = () => { SUBMIT.dims = [img.naturalWidth, img.naturalHeight]; renderStage(); };
    img.src = SUBMIT.url;
  }

  /* ---- 第一步:上传与申报 ---- */
  function renderStage1(body){
    const dz = document.createElement('div');
    dz.className = 'dropzone';
    dz.innerHTML = '<div class="dz-icon">📷</div><div class="dz-hint">' + t('submit.drop.hint') + '</div><div class="dz-sub">' + t('submit.drop.sub') + '</div>';
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*'; fi.style.display = 'none';
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', ev => { ev.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', ev => {
      ev.preventDefault(); dz.classList.remove('drag');
      const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if(f && f.type && f.type.startsWith('image/')) setFile(f);
    });
    fi.addEventListener('change', () => { if(fi.files[0]) setFile(fi.files[0]); });
    body.appendChild(dz);
    body.appendChild(fi);

    if(SUBMIT.file){
      const prev = document.createElement('div');
      prev.className = 'dz-preview';
      prev.innerHTML = '<img src="' + SUBMIT.url + '" alt="preview">' +
        '<div class="dz-info"><div><span>' + t('submit.file.size') + '</span><b>' + fmtNum(SUBMIT.file.size / 1024, 1) + ' KB</b></div>' +
        '<div><span>' + t('submit.file.dims') + '</span><b>' + (SUBMIT.dims ? SUBMIT.dims.join(' × ') : '…') + '</b></div>' +
        '<div><span>' + t('submit.file.type') + '</span><b>' + (SUBMIT.file.type || SUBMIT.file.name.split('.').pop()) + '</b></div></div>' +
        '<button class="btn btn-ghost dz-change" type="button">✕</button>';
      prev.querySelector('.dz-change').addEventListener('click', ev => {
        ev.stopPropagation();
        SUBMIT.file = null;
        if(SUBMIT.url) URL.revokeObjectURL(SUBMIT.url);
        SUBMIT.url = null; SUBMIT.dims = null;
        renderStage();
      });
      body.appendChild(prev);
    }

    /* 申报表单 */
    const form = document.createElement('div');
    form.className = 'claim-form';
    const fRow1 = document.createElement('div');
    fRow1.className = 'form-row';
    fRow1.innerHTML = '<span class="filter-label">' + t('submit.claim.action') + '</span><span class="chip-row" id="sub-actions"></span>';
    const aRow = fRow1.querySelector('#sub-actions');
    PROOF.actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'chip' + (SUBMIT.action === a.key ? ' active' : '');
      b.innerHTML = '<span>' + a.icon + '</span>' + t('act.' + a.key);
      b.addEventListener('click', () => { SUBMIT.action = a.key; renderStage(); });
      aRow.appendChild(b);
    });
    form.appendChild(fRow1);

    const fRow2 = document.createElement('div');
    fRow2.className = 'form-row';
    fRow2.innerHTML = '<span class="filter-label">' + t('submit.claim.city') + '</span>';
    const sel = document.createElement('select');
    sel.className = 'txt-in';
    PROOF.cities.forEach((cc, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = lb(cc) + ' · ' + lb(cc.country);
      sel.appendChild(o);
    });
    sel.value = SUBMIT.city;
    sel.addEventListener('change', () => { SUBMIT.city = +sel.value; });
    fRow2.appendChild(sel);
    fRow2.insertAdjacentHTML('beforeend', '<span class="filter-label">' + t('submit.claim.name') + '</span>');
    const nm = document.createElement('input');
    nm.type = 'text';
    nm.className = 'txt-in';
    nm.placeholder = t('submit.claim.namePh');
    nm.value = SUBMIT.name;
    nm.addEventListener('input', () => { SUBMIT.name = nm.value; });
    fRow2.appendChild(nm);
    form.appendChild(fRow2);

    /* 提交主体:个人 / 组织 */
    const fRow3 = document.createElement('div');
    fRow3.className = 'form-row';
    fRow3.innerHTML = '<span class="filter-label">' + t('submit.claim.mode') + '</span><span class="chip-row" id="sub-mode"></span>';
    const mRow = fRow3.querySelector('#sub-mode');
    [['ind', 'submit.claim.mode.ind'], ['org', 'submit.claim.mode.org']].forEach(([v, k]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (SUBMIT.orgMode === v ? ' active' : '');
      b.textContent = t(k);
      b.addEventListener('click', () => { SUBMIT.orgMode = v; renderStage(); });
      mRow.appendChild(b);
    });
    form.appendChild(fRow3);

    /* 组织选择(组织名义时显示;选择组织自动带出其所在城市;「其他」为未登记组织) */
    if(SUBMIT.orgMode === 'org'){
      const fRow4 = document.createElement('div');
      fRow4.className = 'form-row';
      fRow4.innerHTML = '<span class="filter-label">' + t('submit.claim.org') + '</span>';
      const oSel = document.createElement('select');
      oSel.className = 'txt-in';
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = t('submit.claim.orgPh');
      ph.disabled = true;
      ph.selected = !SUBMIT.org;
      oSel.appendChild(ph);
      PROOF.orgs.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.key;
        opt.textContent = lb(o.name) + ' · ' + lb(PROOF.city(o.city)) + ' · ' + lb(PROOF.city(o.city).country);
        opt.selected = SUBMIT.org === o.key;
        oSel.appendChild(opt);
      });
      /* 「其他」选项:自由文本组织名 → org='custom:<名称>',构成未登记组织风控信号 */
      const cOpt = document.createElement('option');
      cOpt.value = '__custom';
      cOpt.textContent = t('submit.claim.orgOther');
      cOpt.selected = SUBMIT.org === '__custom';
      oSel.appendChild(cOpt);
      oSel.addEventListener('change', () => {
        const v = oSel.value;
        if(v === '__custom'){
          SUBMIT.org = '__custom';
        } else {
          SUBMIT.org = v || null;
          if(SUBMIT.org){
            const o = ORG[SUBMIT.org];
            if(o) SUBMIT.city = o.city;
            sel.value = SUBMIT.city;
          }
        }
        renderStage();
      });
      fRow4.appendChild(oSel);
      form.appendChild(fRow4);

      /* 「其他」选中时:自由文本名称 + 组织类型(NGO / 企业 / 社区 / 个人团体) */
      if(SUBMIT.org === '__custom'){
        const fRowC = document.createElement('div');
        fRowC.className = 'form-row';
        fRowC.innerHTML = '<span class="filter-label">' + t('submit.claim.orgOther') + '</span>';
        const ci = document.createElement('input');
        ci.type = 'text';
        ci.className = 'txt-in';
        ci.placeholder = t('submit.claim.orgOtherPh');
        ci.value = SUBMIT.orgCustom;
        ci.addEventListener('input', () => { SUBMIT.orgCustom = ci.value; });
        fRowC.appendChild(ci);
        fRowC.insertAdjacentHTML('beforeend', '<span class="filter-label">' + t('submit.claim.orgType') + '</span>');
        const cSel = document.createElement('select');
        cSel.className = 'txt-in';
        [['ngo', 'org.type.ngo'], ['company', 'org.type.company'], ['community', 'org.type.community'], ['personal', 'org.type.personal']].forEach(([v, k]) => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = t(k);
          opt.selected = SUBMIT.orgType === v;
          cSel.appendChild(opt);
        });
        cSel.addEventListener('change', () => { SUBMIT.orgType = cSel.value; });
        fRowC.appendChild(cSel);
        form.appendChild(fRowC);
      }
    }

    /* 行动日期(用于行动地图的日期回放) */
    const fRow5 = document.createElement('div');
    fRow5.className = 'form-row';
    fRow5.innerHTML = '<span class="filter-label">' + t('submit.claim.date') + '</span>';
    const dt = document.createElement('input');
    dt.type = 'date';
    dt.className = 'txt-in';
    dt.value = SUBMIT.date || dateKey(new Date());
    dt.addEventListener('change', () => { SUBMIT.date = dt.value || null; });
    fRow5.appendChild(dt);
    const dn = document.createElement('span');
    dn.className = 'qc-hint';
    dn.style.marginTop = '0';
    dn.textContent = t('submit.claim.dateNote');
    fRow5.appendChild(dn);
    form.appendChild(fRow5);
    body.appendChild(form);

    /* 操作 */
    const actions = document.createElement('div');
    actions.className = 'submit-actions';
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary';
    ok.textContent = t('submit.btn');
    /* 「其他」组织需至少 2 个字符的名称方可提交 */
    ok.disabled = !(SUBMIT.file && SUBMIT.action &&
      (SUBMIT.orgMode === 'ind' || (SUBMIT.org && (SUBMIT.org !== '__custom' || SUBMIT.orgCustom.trim().length >= 2))));
    if(ok.disabled) ok.title = t('submit.btn.disabled');
    ok.addEventListener('click', doSubmit);
    const demo = document.createElement('button');
    demo.className = 'btn btn-ghost';
    demo.textContent = t('submit.demo');
    demo.title = t('submit.demoNote');
    demo.addEventListener('click', () => window.__demoSubmit());
    actions.appendChild(ok); actions.appendChild(demo);
    body.appendChild(actions);

    const apiNote = document.createElement('p');
    apiNote.className = 'qc-hint';
    apiNote.textContent = t('submit.api.note');
    body.appendChild(apiNote);
  }

  /* ---- 第二步:验证中 ---- */
  function renderStage2(body){
    body.innerHTML =
      '<div class="proc-head"><i class="pulse big"></i><div><b>' + t('submit.processing') + '</b><p>' + t('submit.processing.sub') + '</p></div></div>' +
      '<div class="pipe-run">' +
      ['submit.pipe.ingest', 'submit.pipe.models', 'submit.pipe.dedupe', 'submit.pipe.receipt'].map(k =>
        '<div class="row"><span class="dot"></span><span class="lbl">' + t(k) + '</span><span class="chk">✓</span></div>').join('') +
      '</div>';
  }

  function doSubmit(){
    if(!SUBMIT.file || !SUBMIT.action) return;
    if(SUBMIT.orgMode === 'org' && !SUBMIT.org) return;
    if(SUBMIT.org === '__custom' && SUBMIT.orgCustom.trim().length < 2) return;
    SUBMIT.stage = 2;
    renderStage();
    const payload = {
      file: SUBMIT.file, action: SUBMIT.action, city: SUBMIT.city, submitter: SUBMIT.name,
      org: SUBMIT.orgMode === 'org' ? (SUBMIT.org === '__custom' ? 'custom:' + SUBMIT.orgCustom.trim() : SUBMIT.org) : null,
      orgType: SUBMIT.orgMode === 'org' && SUBMIT.org === '__custom' ? SUBMIT.orgType : null,
      date: SUBMIT.date || null
    };
    const rows = body.querySelectorAll('.pipe-run .row');
    const stagesDone = [false, false, false, false];
    const timers = [500, 1400, 2300, 3200].map((t2, i) => setTimeout(() => {
      stagesDone[i] = true;
      if(rows[i]){ rows[i].classList.add('done'); rows[i].classList.remove('run'); }
      if(rows[i + 1] && !stagesDone[i + 1]) rows[i + 1].classList.add('run');
      maybeFinish();
    }, t2));
    if(rows[0]) rows[0].classList.add('run');
    let promiseDone = false, result = null;
    proofApiSubmit(payload).then(r => { result = r; promiseDone = true; maybeFinish(); })
      .catch(err => {
        timers.forEach(clearTimeout);
        body.innerHTML = '<p class="verdict-why" style="padding:10px 2px">⚠ ' + (err && err.message ? err.message : 'verify failed') + '</p>' +
          '<button class="btn btn-ghost" type="button">← ' + t('submit.step1') + '</button>';
        body.querySelector('button').addEventListener('click', () => { SUBMIT.stage = 1; renderStage(); });
      });
    function maybeFinish(){
      if(promiseDone && stagesDone.every(Boolean)){
        timers.forEach(clearTimeout);
        SUBMIT.result = result;
        ProofEvidence.remember(result.submission.id, payload.file);
        SUBMIT.stage = 3;
        renderStage();
        if(window.__refreshOverview) window.__refreshOverview();
        if(window.__renderQueue) window.__renderQueue();
        if(window.__renderDup) window.__renderDup();
        if(window.__renderMap) window.__renderMap();
        if(window.__renderAnalytics) window.__renderAnalytics();
      }
    }
  }

  /* ---- 第三步:结果与凭据 ---- */
  function renderStage3(body){
    const r = SUBMIT.result;
    const s = r.submission, v = r.verification;
    const st = PROOF.statuses[s.status];

    const banner = document.createElement('div');
    banner.className = 'verdict-banner vb-' + s.status;
    banner.innerHTML = '<div class="vb-icon">' + st.icon + '</div>' +
      '<div class="vb-body"><b>' + t('submit.result.title') + ' · ' + t('status.' + s.status) + '</b>' +
      '<p>' + t('submit.verdict.' + s.status) + '</p></div>' +
      '<div class="vb-id">' + s.id + '</div>';
    body.appendChild(banner);

    const grid = document.createElement('div');
    grid.className = 'submit-grid';

    const scoreP = document.createElement('div');
    scoreP.className = 'panel';
    scoreP.innerHTML = '<div class="panel-title">' + t('submit.scores') + '</div>';
    const sb = document.createElement('div');
    sb.className = 'submit-score';
    const ringBox = document.createElement('div');
    scoreRing(ringBox, s.score, st.color, 72);
    sb.appendChild(ringBox);
    const bars = document.createElement('div');
    bars.className = 'drawer-subbars';
    bars.appendChild(subBars(s.subs, subSrcs(s)));
    sb.appendChild(bars);
    scoreP.appendChild(sb);
    grid.appendChild(scoreP);

    const flagP = document.createElement('div');
    flagP.className = 'panel';
    flagP.innerHTML = '<div class="panel-title">' + t('submit.flags') + '</div>';
    if(!v.flags.length){
      const none = document.createElement('p');
      none.className = 'flag-none';
      none.textContent = t('submit.flags.none');
      flagP.appendChild(none);
    } else {
      v.flags.forEach(f => {
        const row = document.createElement('div');
        row.className = 'flag-row';
        const st2 = f.level === 'flagged' ? PROOF.statuses.flagged : (f.level === 'serious' ? PROOF.statuses.rejected : PROOF.statuses.pending);
        row.innerHTML = '<div class="flag-ic" style="color:' + st2.text + ';border-color:' + st2.color + '55">' + st2.icon + '</div>' +
          '<div><span class="flag-code">' + f.code + '</span></div>' +
          '<p class="flag-msg">' + t(f.msgKey, f.vars) + '</p>';
        flagP.appendChild(row);
      });
    }
    grid.appendChild(flagP);
    body.appendChild(grid);

    ProofEvidence.render(body, r);

    /* 取证面板:ELA 热力图 + EXIF + 溯源凭证(全部本地实测) */
    if(s.forensics){
      const fx = s.forensics;
      const fxP = document.createElement('div');
      fxP.className = 'panel';
      fxP.innerHTML = '<div class="panel-title">🔬 ' + t('forensics.title') + '</div>';
      const fxGrid = document.createElement('div');
      fxGrid.className = 'fx-grid';

      /* ELA */
      const ela = document.createElement('div');
      ela.className = 'fx-cell';
      ela.innerHTML = '<div class="fx-title">' + t('forensics.ela') + ' <i class="subbar-src">' + t('about.tag.measured') + '</i></div>';
      if(fx.ela && fx.ela.heatmap){
        const im = document.createElement('img');
        im.className = 'fx-ela-img';
        im.src = fx.ela.heatmap;
        im.alt = 'ELA heatmap';
        ela.appendChild(im);
        const cap = document.createElement('p');
        cap.className = 'fx-cap';
        cap.textContent = t('forensics.ela.desc', { p: fmtNum(fx.ela.highRatio * 100, 0) + '%', m: fmtNum(fx.ela.meanErr, 1) });
        ela.appendChild(cap);
        if(String(s.mime || '').toLowerCase().includes('png')){
          const pngNote = document.createElement('p');
          pngNote.className = 'fx-cap';
          pngNote.textContent = t('forensics.ela.pngNote');
          ela.appendChild(pngNote);
        }
      }
      fxGrid.appendChild(ela);

      /* EXIF(文件自带字符串,必须 textContent 防注入) */
      const ex = document.createElement('div');
      ex.className = 'fx-cell';
      ex.innerHTML = '<div class="fx-title">' + t('forensics.exif') + ' <i class="subbar-src">' + t('about.tag.measured') + '</i></div>';
      if(fx.exif && fx.exif.hasExif){
        const rows = [];
        if(fx.exif.make || fx.exif.model) rows.push([t('drawer.device'), [fx.exif.make, fx.exif.model].filter(Boolean).join(' ')]);
        if(fx.exif.dateTimeOriginal) rows.push([t('submit.claim.date'), fx.exif.dateTimeOriginal]);
        if(fx.exif.software) rows.push(['Software', fx.exif.software]);
        if(fx.exif.gps) rows.push(['GPS', t('forensics.exif.gps', { lat: fx.exif.gps.lat, lon: fx.exif.gps.lon })]);
        if(fx.gpsKm != null) rows.push([t('forensics.gps.dist'), fmtNum(fx.gpsKm, 1) + ' km']);
        rows.forEach(r => {
          const row = document.createElement('div');
          row.className = 'fx-kv';
          row.innerHTML = '<span>' + r[0] + '</span>';
          const b = document.createElement('b');
          b.textContent = r[1];
          row.appendChild(b);
          ex.appendChild(row);
        });
      } else {
        const p = document.createElement('p');
        p.className = 'fx-cap';
        p.textContent = t('forensics.exif.none');
        ex.appendChild(p);
      }
      fxGrid.appendChild(ex);

      /* 溯源凭证 */
      const prov = document.createElement('div');
      prov.className = 'fx-cell';
      prov.innerHTML = '<div class="fx-title">' + t('forensics.prov') + ' <i class="subbar-src">' + t('about.tag.measured') + '</i></div>';
      const pv = fx.provenance || { c2pa: false, xmp: false };
      const pc = document.createElement('div');
      pc.className = 'fx-kv';
      pc.innerHTML = '<span>C2PA</span>';
      const pcb = document.createElement('b');
      pcb.textContent = pv.c2pa ? t('forensics.prov.c2pa.yes') : t('forensics.prov.c2pa.no');
      pc.appendChild(pcb);
      prov.appendChild(pc);
      const px = document.createElement('div');
      px.className = 'fx-kv';
      px.innerHTML = '<span>XMP</span>';
      const pxb = document.createElement('b');
      pxb.textContent = pv.xmp ? t('forensics.prov.xmp.yes') : t('forensics.prov.xmp.no');
      px.appendChild(pxb);
      prov.appendChild(px);
      if(!fx.exif.hasExif && !pv.c2pa && !pv.xmp){
        const p2 = document.createElement('p');
        p2.className = 'fx-cap fx-risk';
        p2.textContent = t('forensics.aiRisk');
        prov.appendChild(p2);
      }
      fxGrid.appendChild(prov);

      fxP.appendChild(fxGrid);
      body.appendChild(fxP);
    }

    /* 凭据 */
    const rc = document.createElement('div');
    rc.className = 'receipt';
    rc.id = 'receipt-print';
    const pipeRows = [
      ['submit.pipe.ingest', true], ['submit.pipe.models', true],
      ['submit.pipe.dedupe', true, s.dup ? ' ⚠ ' + t('qc.dup') : ''], ['submit.pipe.receipt', true]
    ].map(x => '<div class="rc-pipe-row"><i>' + (x[1] ? '✓' : '—') + '</i><span>' + t(x[0]) + (x[2] || '') + '</span></div>').join('');
    rc.innerHTML =
      '<div class="rc-head"><div class="rc-brand"><span class="rc-logo">◆</span><b>Proof API</b></div>' +
      '<span class="rc-title">' + t('submit.receipt') + '</span>' +
      '<span class="rc-stamp lv lv-' + s.status + '" style="color:' + st.text + '"><i>' + st.icon + '</i>' + t('status.' + s.status) + '</span></div>' +
      '<div class="rc-row rc-id"><span>' + t('submit.receipt.issued') + '</span><b>' + s.id + '</b><i>' + fmtTime(r.receipt.issuedAt) + '</i></div>' +
      '<div class="rc-sep"></div>' +
      '<div class="rc-kv"><span>' + t('submit.receipt.digest') + '</span><b class="mono">' + s.hash + '</b></div>' +
      '<div class="rc-kv"><span>' + t('submit.receipt.phash') + '</span><b class="mono">' + s.phash + '</b></div>' +
      '<div class="rc-kv"><span>' + t('table.action') + '</span><b>' + ACT[s.action].icon + ' ' + t('act.' + s.action) + '</b></div>' +
      '<div class="rc-kv"><span>' + t('submit.claim.city') + '</span><b>' + lb(PROOF.city(s.city)) + '</b></div>' +
      '<div class="rc-kv"><span>' + t('drawer.org') + '</span><b>' + orgName(s.org) +
        (s.org && s.org.startsWith('custom:') ? ' · ' + t('drawer.org.unregistered') + (s.orgType ? ' · ' + t('org.type.' + s.orgType) : '') : '') + '</b></div>' +
      '<div class="rc-kv"><span>' + t('submit.claim.date') + '</span><b>' + fmtDate(s.time) + '</b></div>' +
      '<div class="rc-kv"><span>' + t('drawer.device') + '</span><b>' + s.device + '</b></div>' +
      '<div class="rc-kv"><span>' + t('drawer.time') + '</span><b>' + fmtTime(s.time) + '</b></div>' +
      '<div class="rc-sep"></div>' +
      '<div class="rc-sub">' + t('submit.receipt.pipeline') + '</div>' + pipeRows +
      '<div class="rc-sep"></div>' +
      '<div class="rc-sub">' + t('submit.receipt.detail') + '</div>' +
      '<div class="rc-score">' + s.score + '<small> / 100</small></div>' +
      '<div class="rc-kv"><span>' + t('qc.auth') + '</span><b>' + s.subs.auth + '</b></div>' +
      '<div class="rc-kv"><span>' + t('qc.action') + '</span><b>' + s.subs.action + '</b></div>' +
      '<div class="rc-kv"><span>' + t('qc.loc') + '</span><b>' + s.subs.loc + '</b></div>' +
      '<div class="rc-sep"></div>' +
      '<div class="rc-foot">' + t('submit.receipt.line1') + '<br>' + t('submit.receipt.line2') + '</div>';
    body.appendChild(rc);

    /* 后续操作 */
    const ops = document.createElement('div');
    ops.className = 'submit-actions';
    const print = document.createElement('button');
    print.className = 'btn btn-ghost';
    print.textContent = t('submit.receipt.print');
    print.addEventListener('click', () => window.print());
    const again = document.createElement('button');
    again.className = 'btn btn-ghost';
    again.textContent = t('submit.receipt.again');
    again.addEventListener('click', () => {
      /* orgCustom/orgType 必须随状态回填,否则"再提交一次"会丢自定义组织名 */
      SUBMIT = { stage: 1, file: null, url: null, dims: null, action: null, city: SUBMIT.city, name: SUBMIT.name, orgMode: SUBMIT.orgMode, org: SUBMIT.org, orgCustom: SUBMIT.orgCustom, orgType: SUBMIT.orgType, date: SUBMIT.date, result: null };
      renderStage();
    });
    const toQueue = document.createElement('button');
    toQueue.className = 'btn btn-ghost';
    toQueue.textContent = t('submit.receipt.queue');
    toQueue.addEventListener('click', () => switchTab('queue'));
    ops.appendChild(print); ops.appendChild(again); ops.appendChild(toQueue);
    if(s.status !== 'verified'){
      const toAgent = document.createElement('button');
      toAgent.className = 'btn btn-agent';
      toAgent.style.width = 'auto';
      toAgent.style.margin = '0';
      toAgent.textContent = t('submit.receipt.agent');
      toAgent.addEventListener('click', () => {
        switchTab('agent');
        setTimeout(() => window.__agentAsk(t('agent.investigating', { id: s.id })), 400);
      });
      ops.appendChild(toAgent);
    }
    body.appendChild(ops);

    /* 验证足迹(端侧实测):延迟 × 设备功耗 × 电网因子 → 与核证减缓量的比值 */
    if(r.verification && r.verification.elapsedMs && s.tco2e != null){
      const C = PROOF.carbonFactors();
      const ms = r.verification.elapsedMs;
      const ug = ms / 3.6e6 * C.devicePowerW * C.gridFactor * 1e6; /* μg CO2e */
      const ratio = ug > 0 ? Math.round(s.tco2e * 1e12 / ug) : 0;   /* tCO2e×1e6 g/t ÷ μg×1e-6 g/μg */
      const fp = document.createElement('div');
      fp.className = 'footprint';
      fp.innerHTML =
        '<div class="fp-line">⚡ ' + t('footprint.line', { ms: ms, g: fmtNum(ug, 1), w: C.devicePowerW, t: fmtNum(s.tco2e, 1) }) + '</div>' +
        '<div class="fp-line fp-ratio">' + t('footprint.ratio', { n: fmtNum(ratio, 0) }) + '</div>';
      body.appendChild(fp);
    }

    const note = document.createElement('p');
    note.className = 'qc-hint';
    note.textContent = t('submit.result.note');
    body.appendChild(note);
  }

  /* 会话记录 */
  const sessCard = card(sec, t('submit.sess'), null);
  const sessBody = sessCard.body;

  function renderSessionList(){
    if(!sessBody) return;
    sessBody.innerHTML = '';
    if(!REG.subs.length){
      sessBody.innerHTML = '<p class="muted-text">' + t('submit.sess.none') + '</p>';
      return;
    }
    const cnt = document.createElement('p');
    cnt.className = 'qc-hint';
    cnt.textContent = t('submit.sess.n', { n: REG.subs.length });
    sessBody.appendChild(cnt);
    REG.subs.slice().reverse().forEach(r => {
      const s = r.submission;
      const row = document.createElement('div');
      row.className = 'feed-row';
      const info = document.createElement('div');
      info.className = 'feed-info';
      const top = document.createElement('div');
      top.className = 'feed-top';
      const idEl = document.createElement('b');
      idEl.textContent = s.id;
      top.appendChild(idEl);
      top.appendChild(lvBadge(s.status));
      top.appendChild(actTag(s.action));
      const meta = document.createElement('div');
      meta.className = 'feed-meta';
      meta.textContent = s.submitter + ' · ' + (s.org ? orgName(s.org) + ' · ' : '') + lb(PROOF.city(s.city)) + ' · ' + fmtTime(s.time) + ' · ' + t('qc.score') + ' ' + s.score;
      info.appendChild(top); info.appendChild(meta);
      const view = document.createElement('button');
      view.className = 'btn btn-ghost';
      view.textContent = t('submit.sess.view');
      view.addEventListener('click', () => {
        SUBMIT.result = r;
        SUBMIT.stage = 3;
        renderStage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      row.appendChild(info); row.appendChild(view);
      sessBody.appendChild(row);
    });
  }

  /* 示例照片一键演示 */
  window.__submitFile = async f => { setFile(f); setTimeout(doSubmit, 150); };
  window.__demoSubmit = async () => {
    if(!SUBMIT.action) SUBMIT.action = 'afforest';
    const f = await makeSamplePhoto(SUBMIT.action);
    window.__submitFile(f);
  };

  renderStage();
}

/* ============================================================
   导航 / 语言 / 启动
   ============================================================ */
function switchTab(id){
  $$('.tabs button').forEach(b => {
    const on = b.dataset.tab === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1; /* roving tabindex:箭号键在页签间移动 */
  });
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* 页签可访问性:WAI-ARIA tablist/tab/tabpanel + 箭号键导航(键盘可完整遍历八个视图) */
function setupTabA11y(){
  const list = $('#tabs');
  if(!list) return;
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', t('a11y.tabs'));
  const buttons = $$('.tabs button');
  buttons.forEach((b, i) => {
    b.setAttribute('role', 'tab');
    b.id = 'tabbtn-' + b.dataset.tab;
    b.setAttribute('aria-controls', 'tab-' + b.dataset.tab);
    const on = b.classList.contains('active');
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  $$('.tab').forEach(s => {
    s.setAttribute('role', 'tabpanel');
    s.setAttribute('aria-labelledby', 'tabbtn-' + s.id.slice(4));
  });
  list.addEventListener('keydown', e => {
    if(!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const idx = buttons.findIndex(b => document.activeElement === b);
    if(idx < 0){ buttons.find(b => b.tabIndex === 0).focus(); return; }
    let next;
    if(e.key === 'Home') next = 0;
    else if(e.key === 'End') next = buttons.length - 1;
    else next = (idx + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
    buttons[next].focus();
    switchTab(buttons[next].dataset.tab);
  });
}

/* ============================================================
   关于(About):真实计算清单 / 演示数据声明 / 素材归属 / 二维码
   ============================================================ */
const REPO_URL = 'https://github.com/gunnarcosmo1123-oss/proof-api-dashboard';
const ATTRIBUTION = [
  ['afforest-01', 'Volunteers enjoy planting trees', 'Hillebrand Steve, U.S. Fish and Wildlife Service', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Volunteers_enjoy_planting_trees.jpg'],
  ['afforest-02', 'Volunteer Tree Planting 120802-F-OS776-021', 'Airman 1st Class Christopher Tam', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Volunteer_Tree_Planting_120802-F-OS776-021.jpg'],
  ['solar-01', 'Rooftop solar panels in Caldicot', 'Jaggery', 'CC BY-SA 2.0', 'https://commons.wikimedia.org/wiki/File:Rooftop_solar_panels_in_Caldicot_-_geograph.org.uk_-_6388281.jpg'],
  ['solar-02', 'Rooftop solar panels, Gwehelog', 'Jaggery', 'CC BY-SA 2.0', 'https://commons.wikimedia.org/wiki/File:Rooftop_solar_panels,_Gwehelog_-_geograph.org.uk_-_7018757.jpg'],
  ['wetland-01', 'Wetland restoration in Australia', 'Nick carson', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Wetland_restoration_in_Australia.jpg'],
  ['wetland-02', 'Wetland restoration, Wetlands Reserve Program, Texas', 'USDA NRCS Texas', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Wetland_restoration_under_the_Wetlands_Reserve_Program_in_Texas_(24743607259).jpg'],
  ['ev-01', 'Car2Go Charging Station Stuttgart', 'Julian Herzog', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Car2Go_Charging_Station_Stuttgart_2013_01.jpg'],
  ['ev-02', 'PisaEnelXChargingStation', 'Daniele Napolitano', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:PisaEnelXChargingStation.jpg'],
  ['cleanup-01', 'Beaches cleanup volunteers', 'Olympic National Park', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Beaches_cleanup_volunteers_(16749394444).jpg'],
  ['cleanup-02', 'Oregon beach cleanup, Ocean Blue Project volunteers', 'Ocean Blue Project, Inc.', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Oregon-beach-cleanup-ocean-blue-project-volunteers.jpg'],
  ['retrofit-01', 'Installing Insulation Batts', 'Tracey Nicholls, CSIRO', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:CSIRO_ScienceImage_2175_Installing_Insulation_Batts.jpg'],
  ['retrofit-02', 'Installing Insulation & Roof Paneling', 'Petty Officer 3rd Class Matthew Noles, U.S. Navy', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Installing_Insulation_%26_Roof_Paneling_(8938297).jpg']
];

function buildAbout(){
  const sec = $('#tab-about');
  sec.innerHTML = '';

  const hero = card(sec, t('about.title'), t('about.sub'));
  hero.body.innerHTML = '<p class="about-lead">' + t('about.what.title') + '</p>' +
    '<p class="muted-text" style="margin-top:6px">' + t('about.what.sub') + '</p>';

  /* 真实计算清单(诚实重标:实测 / 启发式 / 演示规则) */
  const real = card(sec, t('about.real.title'), null);
  [
    [t('about.real.sha'), 'about.tag.measured'],
    [t('about.real.phash'), 'about.tag.measured'],
    [t('about.real.noise'), 'about.tag.measured'],
    [t('about.real.color'), 'about.tag.heuristic'],
    [t('about.real.ela'), 'about.tag.measured'],
    [t('about.real.exif'), 'about.tag.measured'],
    [t('about.real.prov'), 'about.tag.measured'],
    [t('about.real.geo'), 'about.tag.measured'],
    [t('about.real.score'), 'about.tag.demo']
  ].forEach(r => {
    const row = document.createElement('div');
    row.className = 'about-row';
    row.innerHTML = '<span>' + r[0] + '</span><i class="about-tag tag-' + r[1].split('.').pop() + '">' + t(r[1]) + '</i>';
    real.body.appendChild(row);
  });

  /* 验证足迹(端侧) */
  const fpc = card(sec, t('about.footprint.title'), null);
  const fpt = document.createElement('p');
  fpt.className = 'muted-text';
  fpt.textContent = t('about.footprint.text');
  fpc.body.appendChild(fpt);

  /* 演示数据声明 + 隐私 */
  const data = card(sec, t('about.data.title'), null);
  const dp = document.createElement('p');
  dp.className = 'muted-text';
  dp.textContent = t('about.data.text');
  data.body.appendChild(dp);
  const priv = card(sec, t('about.privacy.title'), null);
  const pp = document.createElement('p');
  pp.className = 'muted-text';
  pp.textContent = t('about.privacy.text');
  priv.body.appendChild(pp);

  /* 二维码 + 仓库链接 */
  const grid = document.createElement('div');
  grid.className = 'grid-2';
  sec.appendChild(grid);
  const qrCard = card(grid, t('about.qr'), null);
  const qr = document.createElement('img');
  qr.className = 'about-qr';
  qr.src = 'assets/qr.png';
  qr.alt = 'QR code';
  qrCard.body.appendChild(qr);
  const linkCard = card(grid, t('about.repo'), null);
  const a = document.createElement('a');
  a.className = 'about-link';
  a.href = REPO_URL;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = REPO_URL;
  linkCard.body.appendChild(a);

  /* 照片素材归属清单 */
  const ph = card(sec, t('about.photos.title'), null);
  const pt = document.createElement('p');
  pt.className = 'muted-text';
  pt.textContent = t('about.photos.text');
  ph.body.appendChild(pt);
  const table = document.createElement('div');
  table.className = 'about-attrib';
  ATTRIBUTION.forEach(r => {
    const row = document.createElement('div');
    row.className = 'about-attrib-row';
    row.innerHTML = '<span class="aa-file">' + r[0] + '</span><span class="aa-title">' + r[1] + '</span><span class="aa-artist">' + r[2] + '</span><span class="aa-license">' + r[3] + '</span>';
    const lk = document.createElement('a');
    lk.href = r[4];
    lk.target = '_blank';
    lk.rel = 'noopener';
    lk.className = 'aa-link';
    lk.textContent = '↗';
    row.appendChild(lk);
    table.appendChild(row);
  });
  ph.body.appendChild(table);
  const lic = document.createElement('p');
  lic.className = 'muted-text about-license';
  lic.textContent = t('about.photos.license');
  ph.body.appendChild(lic);
}

/* ============================================================
   演示巡览(?tour=1):字幕驱动的自动叙事,零网络调用
   上传 → 真实验证 → 裁切/滤镜变体重传 → DUP_PHASH 拦截 →
   回执 → 智能体证据链 → 幻影积分金额(钱的那句必须自己到)
   ============================================================ */
const TOUR = { on: false, step: -1, paused: false, timer: null, poll: null, hold: null };

function buildTour(){
  const bar = document.createElement('div');
  bar.id = 'tour-bar';
  bar.style.display = 'none';
  bar.innerHTML =
    '<div class="tour-cap"><b id="tour-title"></b><span id="tour-caption"></span></div>' +
    '<div class="tour-ctl">' +
      '<button id="tour-pause" class="btn btn-ghost" type="button" title="' + t('tour.pause') + '">⏸</button>' +
      '<button id="tour-step" class="btn btn-ghost" type="button" title="' + t('tour.step') + '">▶|</button>' +
      '<button id="tour-skip" class="btn btn-ghost" type="button" title="' + t('tour.skip') + '">⏭</button>' +
    '</div>';
  document.body.appendChild(bar);
  $('#tour-pause').addEventListener('click', () => {
    TOUR.paused = !TOUR.paused;
    $('#tour-pause').textContent = TOUR.paused ? '▶' : '⏸';
    if(!TOUR.paused && TOUR.hold){ const h = TOUR.hold; TOUR.hold = null; h(); }
  });
  $('#tour-step').addEventListener('click', () => {
    TOUR.paused = true;
    $('#tour-pause').textContent = '▶';
    runTourStep();
  });
  $('#tour-skip').addEventListener('click', endTour);
}

const TOUR_STEPS = [
  { tab: 'submit', title: 'tour.s1.t', cap: 'tour.s1.c', wait: 4600 },
  { title: 'tour.s2.t', cap: 'tour.s2.c', act: () => { if(window.__demoSubmit) window.__demoSubmit(); },
    until: () => SUBMIT.stage === 3 && !!SUBMIT.result },
  { title: 'tour.s3.t', cap: 'tour.s3.c',
    vars: () => ({ ms: SUBMIT.result && SUBMIT.result.verification ? SUBMIT.result.verification.elapsedMs : '…', t: fmtNum(SUBMIT.result.submission.tco2e, 1) }),
    wait: 5600 },
  { title: 'tour.s4.t', cap: 'tour.s4.c', wait: 4600 },
  { title: 'tour.s5.t', cap: 'tour.s5.c',
    act: () => {
      const f = SUBMIT.file;
      if(f) makeVariantPhoto(f).then(v => { if(window.__submitFile) window.__submitFile(v); });
    },
    until: () => SUBMIT.stage === 3 && SUBMIT.result && SUBMIT.result.submission.dup && SUBMIT.result.submission.dup.type === 'perceptual' },
  { title: 'tour.s6.t', cap: 'tour.s6.c',
    vars: () => {
      const d = SUBMIT.result.submission.dup;
      return { hd: d.hd != null ? d.hd : '—', sim: Math.round(d.sim * 100) };
    },
    wait: 4600 },
  { tab: 'dup', title: 'tour.s7.t', cap: 'tour.s7.c',
    vars: () => {
      const s = SUBMIT.result.submission;
      return { t: fmtNum(s.tco2e, 1), eur: fmtNum(s.tco2e * PROOF.carbonFactors().priceEUR, 0) };
    },
    wait: 6200 },
  { tab: 'agent', title: 'tour.s8.t', cap: 'tour.s8.c',
    act: () => {
      const s = SUBMIT.result && SUBMIT.result.submission;
      if(s) setTimeout(() => { if(window.__agentAsk) window.__agentAsk(t('agent.investigating', { id: s.id })); }, 700);
    },
    wait: 7200 },
  { title: 'tour.s9.t', cap: 'tour.s9.c', wait: 9000 }
];

function tourCaption(stp){
  $('#tour-title').textContent = t(stp.title);
  $('#tour-caption').textContent = t(stp.cap, stp.vars ? stp.vars() : undefined);
}

function endTour(){
  TOUR.on = false;
  clearTimeout(TOUR.timer);
  clearInterval(TOUR.poll);
  const bar = $('#tour-bar');
  if(bar) bar.style.display = 'none';
}

function runTourStep(){
  clearTimeout(TOUR.timer);
  clearInterval(TOUR.poll);
  TOUR.step++;
  if(TOUR.step >= TOUR_STEPS.length){ endTour(); return; }
  const stp = TOUR_STEPS[TOUR.step];
  if(stp.tab) switchTab(stp.tab, true);
  tourCaption(stp);
  if(stp.act) stp.act();
  if(stp.until){
    TOUR.poll = setInterval(() => {
      if(TOUR.paused) return;
      if(stp.until()){
        clearInterval(TOUR.poll);
        runTourStep();
      }
    }, 400);
  } else {
    TOUR.timer = setTimeout(() => {
      if(TOUR.paused){ TOUR.hold = runTourStep; return; }
      runTourStep();
    }, stp.wait || 3000);
  }
}

function startTour(){
  const bar = $('#tour-bar');
  if(!bar) return;
  bar.style.display = 'flex';
  TOUR.on = true; TOUR.step = -1; TOUR.paused = false;
  runTourStep();
}

function applyStaticLabels(){
  document.title = LANG === 'zh' ? 'Proof API · 气候行动验证看板 — Team P05 高保真原型' : 'Proof API · Climate Action Verification Dashboard — Team P05 prototype';
  $('#top-ai').innerHTML = '<i class="pulse"></i>' + t('top.ai');
  $('#top-ver').textContent = t('top.ver');
  const lg = $('#lang-toggle');
  if(lg) lg.querySelectorAll('[data-l]').forEach(sp => sp.classList.toggle('active', sp.dataset.l === LANG));
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  $$('.tabs button').forEach(b => b.textContent = t('nav.' + b.dataset.tab));
  $$('.tabs button').forEach(b => {
    const dot = document.createElement('i');
    dot.className = 'tab-dot';
    dot.style.background = { submit: '#199e70', overview: '#2a78d6', queue: '#eb6834', dup: '#ec835a', analytics: '#1baf7a', map: '#0e9aa7', agent: '#6250d6', about: '#8e44ad' }[b.dataset.tab];
    b.prepend(dot);
  });
  $('#footer-1').textContent = t('footer.1');
  $('#footer-2').textContent = t('footer.2');
  $('#footer-3').textContent = t('footer.3');
  $('#footer-4').textContent = t('footer.4');
  $('#intro-sub').textContent = t('intro.sub');
  $('#intro-hint').textContent = t('intro.hint');
  const introTitle = document.querySelector('.intro-box h2');
  if(introTitle) introTitle.textContent = 'Proof API';
}

function buildAll(){
  buildSubmit();
  buildOverview();
  buildQueue();
  buildDup();
  buildAnalytics();
  buildMap();
  buildAgent();
  buildAbout();
}

document.addEventListener('DOMContentLoaded', () => {
  /* 调试钩子:?dbg=1 在页面底部显示未捕获错误(用于排查联动刷新) */
  try {
    if(new URLSearchParams(location.search).get('dbg')){
      window.addEventListener('error', ev => {
        let d = document.getElementById('dbg-log');
        if(!d){ d = document.createElement('div'); d.id = 'dbg-log'; d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#111;color:#7f7;padding:10px 16px;font:11px/1.6 monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;'; document.body.appendChild(d); }
        d.textContent += (ev.message || ev.type) + '  @' + (ev.filename || '').split('/').pop() + ':' + (ev.lineno || '?') + '\n';
      });
    }
  } catch(e) {}

  restoreSession(); /* 会话提交并入数据集(队列/KPI 联动) */
  applyStaticLabels();
  setupTabA11y();
  buildAll();
  buildTour();

  $$('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#lang-toggle').addEventListener('click', () => {
    LANG = LANG === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem('proof-lang', LANG); } catch(e) {}
    applyStaticLabels();
    buildAll();
  });

  /* 启动画面 */
  const intro = $('#intro');
  const bar = $('#intro-bar');
  let p = 0;
  const timer = setInterval(() => {
    p = Math.min(100, p + 6 + Math.random() * 12);
    bar.style.width = p + '%';
    if(p >= 100){
      clearInterval(timer);
      setTimeout(() => intro.classList.add('done'), 260);
    }
  }, 70);
  intro.addEventListener('click', () => { clearInterval(timer); intro.classList.add('done'); });

  /* URL 参数:?tab=queue 直达页签 · ?nosplash 跳过启动画面 · ?drawer=PA-xxxx 打开明细 · ?agent=PA-xxxx 自动发起调查 · ?demo-submit=1 自动演示提交(截图/调试用) */
  try {
    const qp = new URLSearchParams(location.search);
    const tab = qp.get('tab');
    if(tab && document.getElementById('tab-' + tab)) switchTab(tab, true);
    if(qp.get('nosplash') || window.__skipIntro){ clearInterval(timer); intro.classList.add('done'); }
    if(qp.get('tour')){
      switchTab('submit', true);
      setTimeout(() => startTour(), 700);
    }
    const did = qp.get('drawer');
    if(did) setTimeout(() => openDrawer(did), 300);
    const sid = qp.get('agent');
    if(sid){
      switchTab('agent', true);
      setTimeout(() => window.__agentAsk(t('agent.investigating', { id: sid })), 500);
    }
    if(qp.get('demo-submit')){
      switchTab('submit', true);
      setTimeout(() => window.__demoSubmit && window.__demoSubmit(), 400);
      if(qp.get('demo-submit') === '2') setTimeout(() => window.__demoSubmit && window.__demoSubmit(), 7000);
    }
    /* ?map-country=Malaysia[&map-date=2026-11-10] 预选行动地图国家/日期(调试/截图用) */
    const mc = qp.get('map-country');
    const md = qp.get('map-date');
    if(mc || md){
      switchTab('map', true);
      setTimeout(() => {
        if(mc) MAP_STATE = { country: mc, city: null, date: md || null };
        else MAP_STATE.date = md;
        if(window.__renderMap) window.__renderMap();
      }, 350);
    }
  } catch(e) {}
});
