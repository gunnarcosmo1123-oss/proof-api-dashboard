'use strict';
/* Local project records and action-specific field guides. No network or DOM. */
globalThis.ProofCommunity = (() => {
  const bi = (en, zh) => ({ en, zh });
  const guide = (action, fit, permissions, equipment, baseline, evidence, followup, measure) => ({
    action,
    version: '1.0',
    updated: '2026-11-15',
    fit,
    permissions,
    equipment,
    baseline,
    evidence,
    followup,
    measure,
    sources: [
      {
        title: 'Verra · methodology applicability, baselines and monitoring',
        url: 'https://verra.org/program-methodology/vcs-program-standard/overview/',
      },
      {
        title: 'Climate Action Reserve · verification process',
        url: 'https://climateactionreserve.org/how/verification/',
      },
    ],
  });
  const guides = {
    cleanup: guide(
      'cleanup',
      bi(
        'A coastal or riverbank site with a safe collection route and a confirmed disposal partner.',
        '有安全收集路线及明确垃圾接收单位的海岸或河岸。',
      ),
      bi(
        'Check land access, volunteer safety, hazardous-waste rules and lawful disposal. Do not enter unsafe water.',
        '确认土地准入、志愿者安全、危险废物规则及合法处置方式；不要进入危险水域。',
      ),
      bi(
        'Gloves, litter pickers, labelled sacks, a scale and a disposal log.',
        '手套、拾捡夹、分类袋、秤和处置记录。',
      ),
      bi(
        'Photograph fixed viewpoints and describe the route, area and existing litter before collection.',
        '清理前从固定视角拍照，记录路线、范围及现有垃圾。',
      ),
      bi(
        'Record collection date, route, participants, waste categories, weighed mass and the disposal destination; keep scale readings or receipts.',
        '记录日期、路线、参与人数、废物分类、称重和处置去向；保存称重照片或收据。',
      ),
      bi(
        'Return to the same viewpoints after 7–30 days and record reaccumulation. This is a suggested observation interval.',
        '建议 7–30 天后从相同视角复查，记录垃圾重新积累情况。',
      ),
      { label: bi('Collected waste mass', '收集废物质量'), unit: 'kg' },
    ),
    afforest: guide(
      'afforest',
      bi(
        'An ecologically suitable planting site with locally appropriate native species and a maintenance partner.',
        '生态条件适宜、选用本地适生树种并有养护单位的种植地点。',
      ),
      bi(
        'Confirm landowner permission, planting suitability, utility clearance and watering responsibility. Avoid replacing valuable natural habitats.',
        '确认土地所有者许可、种植适宜性、地下设施及浇灌责任；避免取代有价值的自然生境。',
      ),
      bi(
        'Species list, seedlings, planting tools, water, site markers and a count sheet.',
        '树种清单、幼苗、工具、水、地点标记及计数表。',
      ),
      bi(
        'Record the existing habitat, planting boundary, date and fixed photo viewpoints before disturbing the site.',
        '施工前记录现有生境、种植边界、日期及固定拍摄视角。',
      ),
      bi(
        'Record species, number planted, spacing, planting date, site boundary and the agreed maintenance plan.',
        '记录树种、种植数量、间距、日期、地点边界及养护计划。',
      ),
      bi(
        'Suggested checks at 30, 90 and 365 days: count living seedlings, replacements and losses. A planting photo does not show survival or carbon storage.',
        '建议第 30、90、365 天记录存活、补植和死亡数量；种植照片不证明存活或固碳。',
      ),
      { label: bi('Living seedlings at follow-up', '复查时存活幼苗'), unit: bi('seedlings', '株') },
    ),
    solar: guide(
      'solar',
      bi(
        'A structurally suitable roof with viable solar access and an authorised installation team.',
        '结构适宜、日照可用并由获授权人员施工的屋顶。',
      ),
      bi(
        'Check roof ownership, structural assessment, electrical safety and grid/interconnection approvals. Use qualified installers.',
        '检查屋顶权属、结构评估、电气安全和并网许可；由合格安装人员施工。',
      ),
      bi(
        'Installer documentation, equipment specifications, meter readings and a safe photography plan.',
        '安装文件、设备参数、电表读数及安全拍摄方案。',
      ),
      bi(
        'Record the roof condition, shade, prior electricity use and baseline meter period with supporting bills where available.',
        '记录屋顶状况、遮挡、原有用电及基线计量时段，并尽可能保留账单。',
      ),
      bi(
        'Record installed capacity (kWp), panel/inverter specifications, installation date and commissioning documents. Never photograph from an unsafe roof.',
        '记录装机容量（kWp）、面板和逆变器参数、安装日期及投运文件；不要冒险上屋顶拍照。',
      ),
      bi(
        'Record monthly generated kWh and meter dates. A panel photo does not establish generation or avoided emissions.',
        '每月记录发电量 kWh 和计量日期；面板照片不证明实际发电或避免排放。',
      ),
      { label: bi('Generation during the stated period', '注明时段内发电量'), unit: 'kWh' },
    ),
    wetland: guide(
      'wetland',
      bi(
        'A site assessed by local ecological specialists with a restoration objective and a suitable hydrological plan.',
        '经当地生态专家评估、明确恢复目标及水文方案的地点。',
      ),
      bi(
        'Check land tenure, water and habitat permits, local consultation and protected-species safeguards before altering drainage or vegetation.',
        '改变排水或植被前，检查土地权属、水体与生境许可、社区协商及受保护物种措施。',
      ),
      bi(
        'Specialist site plan, boundary map, fixed photo points, water-level markers and monitoring sheets.',
        '专业地点方案、边界图、固定拍摄点、水位标记及监测表。',
      ),
      bi(
        'Record site boundary, water regime, existing vegetation and degradation at dated fixed viewpoints.',
        '在固定视角记录地点边界、水文状况、现有植被、退化情况及日期。',
      ),
      bi(
        'Describe the actual intervention, treated area in hectares, timing, authorisations and professional oversight.',
        '记录实际干预、处理面积（公顷）、时间、授权文件及专业监督。',
      ),
      bi(
        'Suggested seasonal observations: water regime, vegetation, habitat and adverse effects. NDVI alone does not establish wetland recovery.',
        '建议按季节观察水文、植被、生境及不良影响；NDVI 本身不证明湿地恢复。',
      ),
      { label: bi('Area observed (not certified restoration)', '观测面积（非已核证恢复）'), unit: 'ha' },
    ),
    ev: guide(
      'ev',
      bi(
        'A community location with demonstrated charging demand, suitable parking access and adequate electrical capacity.',
        '有充电需求、停车条件适宜且供电能力充足的社区地点。',
      ),
      bi(
        'Confirm property permission, accessibility, electrical design, grid capacity and qualified installation.',
        '确认物业许可、无障碍使用、电气设计、供电容量及合格施工单位。',
      ),
      bi(
        'Demand survey, charger specifications, installation records and a usage-meter plan.',
        '需求调查、充电器参数、施工记录及用量计量计划。',
      ),
      bi(
        'Describe previous charging availability and the expected users; record the pre-installation site.',
        '描述原有充电条件和预期用户，记录安装前地点状况。',
      ),
      bi(
        'Record charger count, rated power (kW), commissioning date, accessibility and installation documentation.',
        '记录充电器数量、额定功率（kW）、投运日期、无障碍条件及安装文件。',
      ),
      bi(
        'Record delivered kWh and usage periods. Usage does not by itself demonstrate displaced petrol travel or net emissions savings.',
        '记录供电量 kWh 及使用时段；使用量本身不证明替代燃油里程或净减排。',
      ),
      { label: bi('Charging electricity during the stated period', '注明时段内充电电量'), unit: 'kWh' },
    ),
    retrofit: guide(
      'retrofit',
      bi(
        'A building with an energy audit or documented efficiency problem and an appropriate retrofit plan.',
        '已开展能效审计或记录效率问题，并有适当改造方案的建筑。',
      ),
      bi(
        'Check building-owner consent, permits, fire/ventilation safety, hazardous materials and qualified contractors.',
        '检查业主同意、许可、消防和通风安全、危险材料及合格承包商。',
      ),
      bi(
        'Energy audit, material specifications, dated work records and comparable energy bills.',
        '能效审计、材料参数、施工日期记录及可比能耗账单。',
      ),
      bi(
        'Record the building condition and a representative energy-use period, including occupancy and weather context.',
        '记录建筑原状及有代表性的能耗基线时段，包括使用人数和天气背景。',
      ),
      bi(
        'Describe treated components, insulation/material specifications, treated area and completion date; keep work records.',
        '描述改造部位、保温或材料参数、处理面积及完工日期，并保留施工记录。',
      ),
      bi(
        'Compare energy use across equivalent periods with weather and occupancy context. An installation photo does not prove energy savings.',
        '结合天气和使用情况比较同等时段能耗；施工照片不证明节能量。',
      ),
      { label: bi('Energy use during the stated period', '注明时段内能耗'), unit: 'kWh' },
    ),
  };
  const field = (key, type, en, zh, integer = false) => ({ key, type, label: bi(en, zh), integer });
  const guideFields = {
    cleanup: [
      field('route', 'text', 'Collection route / area', '收集路线 / 范围'),
      field('massKg', 'number', 'Collected waste (kg)', '收集废物（kg）'),
      field('disposal', 'text', 'Disposal destination / receipt reference', '处置去向 / 收据参考'),
    ],
    afforest: [
      field('species', 'text', 'Species planted', '种植树种'),
      field('planted', 'number', 'Number of seedlings planted', '种植幼苗数量', true),
      field('maintenance', 'text', 'Watering and maintenance responsibility', '浇灌与养护责任'),
    ],
    solar: [
      field('capacityKwp', 'number', 'Installed capacity (kWp)', '装机容量（kWp）'),
      field('installer', 'text', 'Installer / commissioning reference', '安装单位 / 投运文件参考'),
      field('meterPeriod', 'text', 'Electricity meter period / record reference', '电表时段 / 记录参考'),
    ],
    wetland: [
      field('areaHa', 'number', 'Treated area (ha)', '处理面积（ha）'),
      field('permit', 'text', 'Permission / site plan reference', '许可 / 地点方案参考'),
      field('oversight', 'text', 'Ecological oversight', '生态专业监督'),
    ],
    ev: [
      field('chargers', 'number', 'Number of chargers installed', '已安装充电器数量', true),
      field('ratedKw', 'number', 'Rated power per charger (kW)', '单台充电器额定功率（kW）'),
      field('commissioning', 'text', 'Commissioning / access details', '投运 / 使用条件'),
    ],
    retrofit: [
      field('areaM2', 'number', 'Treated area (m²)', '处理面积（m²）'),
      field('materials', 'text', 'Insulation / material specifications', '保温 / 材料参数'),
      field('baselinePeriod', 'text', 'Baseline energy period / bill reference', '基线能耗时段 / 账单参考'),
    ],
  };
  for (const [key, fields] of Object.entries(guideFields)) guides[key].fields = fields;
  const KEY = 'proof-community-v1',
    copy = (value) => JSON.parse(JSON.stringify(value));
  let state = { version: 1, projects: [], reviews: {} };
  let loadError = '';
  const text = (s, max = 800) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
  const validDate = (s) =>
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + 'T00:00:00Z')) &&
    new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const validPhoto = (s) =>
    s == null ||
    s === '' ||
    (typeof s === 'string' && s.length <= 700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s));
  const validCity = (i) => Number.isInteger(i) && i >= 0 && i < PROOF.cities.length;
  const validAction = (k) => PROOF.actions.some((a) => a.key === k);
  function normaliseEvidence(action, values = {}) {
    if (!validAction(action) || !values || typeof values !== 'object' || Array.isArray(values))
      throw new Error('Invalid action evidence details.');
    const result = {};
    for (const field of guides[action].fields) {
      if (!Object.prototype.hasOwnProperty.call(values, field.key)) continue;
      const value = values[field.key];
      if (value == null || value === '') continue;
      if (field.type === 'number') {
        const number = Number(value);
        if (
          !['number', 'string'].includes(typeof value) ||
          !Number.isFinite(number) ||
          number < 0 ||
          (field.integer && !Number.isInteger(number))
        )
          throw new Error(
            field.label.en + ': use a non-negative ' + (field.integer ? 'whole number.' : 'number.'),
          );
        result[field.key] = number;
      } else {
        if (typeof value !== 'string') throw new Error(field.label.en + ': enter text.');
        if (text(value, 300)) result[field.key] = text(value, 300);
      }
    }
    return result;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        if (
          loaded.version !== 1 ||
          !Array.isArray(loaded.projects) ||
          !loaded.reviews ||
          typeof loaded.reviews !== 'object'
        )
          throw new Error('Invalid project storage');
        state.projects = loaded.projects.filter(
          (p) =>
            p &&
            /^PR-[a-z0-9-]+$/.test(p.id) &&
            validAction(p.action) &&
            validCity(p.city) &&
            validDate(p.date) &&
            typeof p.title === 'string' &&
            typeof p.community === 'string' &&
            Array.isArray(p.observations) &&
            p.observations.every(
              (o) =>
                o && ['baseline', 'followup'].includes(o.kind) && validDate(o.date) && validPhoto(o.photo),
            ),
        );
        for (const [id, logs] of Object.entries(loaded.reviews))
          if (
            /^PA-\d+$/.test(id) &&
            Array.isArray(logs) &&
            logs.every(
              (r) =>
                r &&
                ['verified', 'rejected'].includes(r.decision) &&
                typeof r.reviewer === 'string' &&
                typeof r.note === 'string' &&
                typeof r.at === 'string',
            )
          )
            state.reviews[id] = logs;
      }
    }
  } catch (e) {
    loadError = 'Stored projects/reviews could not be read. Existing browser data has not been overwritten.';
  }
  function commit(next) {
    if (loadError) throw new Error(loadError);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      throw new Error(
        'Could not save in this browser (storage unavailable or full). No changes were committed.',
      );
    }
    state = next;
  }
  const uid = () =>
    'PR-' +
    Date.now().toString(36) +
    '-' +
    (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).slice(0, 8);
  function createProject(input) {
    if (
      !validAction(input.action) ||
      !validCity(input.city) ||
      !validDate(input.date) ||
      text(input.title, 100).length < 3 ||
      text(input.community, 100).length < 2
    )
      throw new Error('Choose an action, recorded city, date, project name and community.');
    if (!input.permissionsAcknowledged)
      throw new Error('Acknowledge the local suitability and permissions checks.');
    const project = {
      id: uid(),
      title: text(input.title, 100),
      community: text(input.community, 100),
      action: input.action,
      city: input.city,
      date: input.date,
      budget: text(input.budget, 200),
      plan: text(input.plan),
      prepared: Array.isArray(input.prepared) ? input.prepared.map((x) => text(x, 100)).slice(0, 10) : [],
      guideVersion: guides[input.action].version,
      permissions: 'to-check',
      createdAt: new Date().toISOString(),
      observations: [],
    };
    const next = copy(state);
    next.projects.push(project);
    commit(next);
    return copy(project);
  }
  const listProjects = () => copy(state.projects);
  const rawProject = (id) => state.projects.find((p) => p.id === id);
  function projectFor(id) {
    const p = rawProject(id);
    if (p)
      return { ...copy(p), local: true, submissions: PROOF.submissions.filter((s) => s.projectId === id) };
    const s = id.startsWith('record:') ? PROOF.byId(id.slice(7)) : null;
    if (!s) return null;
    return {
      id,
      title: null,
      community: null,
      action: s.action,
      city: s.city,
      date: PROOF.actionDate(s),
      local: false,
      observations: [],
      submissions: [s],
      guideVersion: '1.0',
    };
  }
  function validateLink(id, action, city, date = null) {
    const p = rawProject(id);
    if (!p || p.action !== action || p.city !== city)
      throw new Error('The selected project must match the action and city.');
    if (
      date != null &&
      (!validDate(date) || p.observations.some((o) => o.kind === 'baseline' && o.date > date))
    )
      throw new Error('The action date must be valid and on or after the project baseline.');
    return p.id;
  }
  function addObservation(id, input) {
    const p = projectFor(id);
    if (!p?.local) throw new Error('Only a locally created project can receive observations.');
    if (
      !['baseline', 'followup'].includes(input.kind) ||
      !validDate(input.date) ||
      text(input.note).length < 5 ||
      !validPhoto(input.photo)
    )
      throw new Error(
        'Choose a valid observation type/date and add a descriptive note (at least 5 characters).',
      );
    const actionDates = p.submissions.map((s) => PROOF.actionDate(s));
    const start = actionDates.length ? actionDates.slice().sort()[0] : p.date,
      end = actionDates.length ? actionDates.slice().sort().at(-1) : p.date;
    if (input.kind === 'baseline' && input.date > start)
      throw new Error('A baseline date must be on or before the first action date.');
    if (input.kind === 'followup' && input.date < end)
      throw new Error('A follow-up date must be on or after the latest action date.');
    const value = input.value === '' || input.value == null ? null : Number(input.value);
    if (value != null && (!Number.isFinite(value) || value < 0))
      throw new Error('Measurements must be finite and non-negative.');
    const next = copy(state),
      target = next.projects.find((p) => p.id === id);
    target.observations.push({
      id: 'OB-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      kind: input.kind,
      date: input.date,
      note: text(input.note),
      photo: input.photo || null,
      value,
      reportedAt: new Date().toISOString(),
      source: 'self-reported',
    });
    commit(next);
    return projectFor(id);
  }
  const reviews = (id) => copy(state.reviews[id] || []);
  function automaticDisposition(s) {
    // Session results retain the engine's original verdict even if an older
    // prototype changed submission.status without recording a review event.
    const result = typeof REG !== 'undefined' ? REG.subs.find((r) => r.submission.id === s.id) : null;
    return result?.verification?.verdict || state.reviews[s.id]?.[0]?.originalStatus || s.status;
  }
  function recordReview(s, input) {
    if (
      !s ||
      !['verified', 'rejected'].includes(input.decision) ||
      text(input.reviewer, 80).length < 2 ||
      text(input.note).length < 10 ||
      !input.acknowledged
    )
      throw new Error(
        'Enter a reviewer name, reason (at least 10 characters) and acknowledge the evidence limitations.',
      );
    const next = copy(state),
      logs = next.reviews[s.id] || (next.reviews[s.id] = []);
    logs.push({
      decision: input.decision,
      reviewer: text(input.reviewer, 80),
      note: text(input.note),
      at: new Date().toISOString(),
      originalStatus: automaticDisposition(s),
      source: 'local-self-attested',
    });
    commit(next);
    return reviews(s.id).at(-1);
  }
  function reviewState(s) {
    const logs = reviews(s.id),
      p = s.projectId ? rawProject(s.projectId) : null;
    return {
      automatic: automaticDisposition(s),
      human: logs.at(-1) || null,
      followups: p
        ? p.observations.filter((o) => o.kind === 'followup' && o.date >= PROOF.actionDate(s)).length
        : 0,
      archive: !s.forensics,
    };
  }
  function applyReviews() {
    for (const s of PROOF.submissions) {
      const log = state.reviews[s.id]?.at(-1);
      if (log) s.status = log.decision;
    }
  }
  return {
    guides,
    validDate,
    normaliseEvidence,
    listProjects,
    createProject,
    projectFor,
    validateLink,
    addObservation,
    reviews,
    recordReview,
    reviewState,
    applyReviews,
    get loadError() {
      return loadError;
    },
  };
})();
