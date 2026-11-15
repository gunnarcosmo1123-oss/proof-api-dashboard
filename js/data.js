'use strict';
/* ============================================================
   Proof API · 数据模型(纯函数,确定性种子)
   Team P05 — 演示数据集:64 条照片提交(2026-10-31 ~ 2026-11-13)
   - 验证分(本地启发式,演示规则):图像真实性 / 行动匹配 / 地理一致性
   - 行动分两大类:环境类(净滩清废·湿地修复·植树造林)
                  能源类(电动出行·屋顶光伏·建筑节能)
   - 提交主体:组织(14 个演示组织)或 个人 → 支持
     组织 > 城市 > 国家 > 全球 的分层分析
   - 城市带行动侧重(确定性):制造"某类行动过剩/缺失"的
     真实缺口故事(如肯尼亚植树活跃但湿地修复不足)
   - 5 个重复组(哈希一致 / 感知哈希 / 裁剪滤镜变体)
   - 状态派生:重复→flagged · ≥85→verified · <60→rejected · 其余 pending
   ============================================================ */

function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/* ---- 行动大类 ---- */
const CATEGORIES = [
  { key: 'env',    icon: '🌍', color: '#1baf7a', name: { zh: '环境类', en: 'Environmental' } },
  { key: 'energy', icon: '⚡', color: '#eb6834', name: { zh: '能源类', en: 'Energy' } }
];

/* ---- 行动类型(分类色 = 参考色板浅色步,固定顺序,芯片均带图标+文字) ---- */
const ACTIONS = [
  { key: 'cleanup',  icon: '♻️', color: '#1baf7a', cat: 'env',    w: 18, bases: { auth: 0.91, action: 0.91, loc: 0.87 } },
  { key: 'wetland',  icon: '🌿', color: '#2a78d6', cat: 'env',    w: 14, bases: { auth: 0.87, action: 0.85, loc: 0.83 } },
  { key: 'afforest', icon: '🌳', color: '#008300', cat: 'env',    w: 20, bases: { auth: 0.90, action: 0.88, loc: 0.85 } },
  { key: 'ev',       icon: '⚡', color: '#eb6834', cat: 'energy', w: 15, bases: { auth: 0.86, action: 0.84, loc: 0.82 } },
  { key: 'solar',    icon: '☀️', color: '#eda100', cat: 'energy', w: 22, bases: { auth: 0.90, action: 0.88, loc: 0.85 } },
  { key: 'retrofit', icon: '🏠', color: '#e87ba4', cat: 'energy', w: 11, bases: { auth: 0.84, action: 0.81, loc: 0.80 } }
];

/* ---- 状态(状态色 = 固定状态色板;文字色为其深色步,浅色底上保证对比度) ---- */
const STATUS = {
  verified: { color: '#0ca30c', text: '#006300', icon: '✓' },
  pending:  { color: '#fab219', text: '#8a5300', icon: '⏳' },
  rejected: { color: '#d03b3b', text: '#b3261e', icon: '✗' },
  flagged:  { color: '#ec835a', text: '#b04a17', icon: '⚠' }
};

/* ---- 城市(含经纬度供行动地图打点;w 为生成权重) ---- */
const CITIES = [
  { zh: '深圳', en: 'Shenzhen', country: { zh: '中国', en: 'China' }, grid: 'grid-42',  lat: 22.54,  lon: 114.06, w: 2 },
  { zh: '成都', en: 'Chengdu', country: { zh: '中国', en: 'China' }, grid: 'grid-58',  lat: 30.57,  lon: 104.07, w: 2 },
  { zh: '昆明', en: 'Kunming', country: { zh: '中国', en: 'China' }, grid: 'grid-51',  lat: 25.04,  lon: 102.71, w: 2 },
  { zh: '杭州', en: 'Hangzhou', country: { zh: '中国', en: 'China' }, grid: 'grid-37', lat: 30.27,  lon: 120.16, w: 2 },
  { zh: '厦门', en: 'Xiamen', country: { zh: '中国', en: 'China' }, grid: 'grid-39',   lat: 24.48,  lon: 118.09, w: 2 },
  { zh: '青岛', en: 'Qingdao', country: { zh: '中国', en: 'China' }, grid: 'grid-31',  lat: 36.07,  lon: 120.38, w: 2 },
  { zh: '内罗毕', en: 'Nairobi', country: { zh: '肯尼亚', en: 'Kenya' }, grid: 'grid-KE', lat: -1.29,  lon: 36.82, w: 5 },
  { zh: '雅加达', en: 'Jakarta', country: { zh: '印度尼西亚', en: 'Indonesia' }, grid: 'grid-ID', lat: -6.21,  lon: 106.85, w: 2 },
  { zh: '麦德林', en: 'Medellín', country: { zh: '哥伦比亚', en: 'Colombia' }, grid: 'grid-CO', lat: 6.24,   lon: -75.58, w: 2 },
  { zh: '吉隆坡', en: 'Kuala Lumpur', country: { zh: '马来西亚', en: 'Malaysia' }, grid: 'grid-KL', lat: 3.14, lon: 101.69, w: 2 },
  { zh: '槟城', en: 'Penang', country: { zh: '马来西亚', en: 'Malaysia' }, grid: 'grid-PG', lat: 5.41, lon: 100.33, w: 2 },
  { zh: '孟买', en: 'Mumbai', country: { zh: '印度', en: 'India' }, grid: 'grid-MUM', lat: 19.08, lon: 72.88, w: 3 },
  { zh: '圣保罗', en: 'São Paulo', country: { zh: '巴西', en: 'Brazil' }, grid: 'grid-SP', lat: -23.55, lon: -46.63, w: 3 },
  { zh: '拉各斯', en: 'Lagos', country: { zh: '尼日利亚', en: 'Nigeria' }, grid: 'grid-LOS', lat: 6.52, lon: 3.38, w: 3 }
];

/* ---- 城市行动侧重(确定性故事:制造"某类行动过剩/缺失"的缺口) ---- */
const CITY_FOCUS = {
  0: ['cleanup', 'ev'],
  1: ['afforest'],
  2: ['wetland'],
  3: ['solar'],
  4: ['cleanup'],
  5: ['retrofit', 'retrofit', 'solar'],
  6: ['afforest', 'afforest', 'cleanup'],   /* 内罗毕:植树/净滩活跃,湿地修复缺失 */
  7: ['afforest', 'afforest', 'wetland'],
  8: ['afforest', 'afforest', 'solar'],
  9: ['cleanup', 'cleanup', 'cleanup'],     /* 吉隆坡:净滩活跃,湿地/能源类缺失 */
  10: ['cleanup', 'cleanup', 'cleanup'],    /* 槟城:同上 */
  11: ['solar', 'solar', 'ev'],
  12: ['afforest', 'afforest', 'wetland'],
  13: ['cleanup', 'cleanup', 'ev']
};

/* ---- 碳减缓参考因子(公开来源;参考估算,非已核证减排量/非已发放积分) ----
   每条提交的 tCO2e = 因子 × 1 个行动单元(量级假设随单元说明) */
const CARBON = {
  priceEUR: 80, /* EU ETS 参考价 €80/tCO2e(2024–2026 区间) */
  gridFactor: 0.5568, /* 生态环境部 2023 电网平均排放因子 kgCO2e/kWh */
  devicePowerW: 7, /* 端侧验证功耗假设(移动设备解码 + DCT 量级) */
  actions: {
    afforest: { t: 0.6, unit: { zh: '每 100 株幼苗·年固碳', en: 'per 100 seedlings·yr sequestered' }, source: { zh: 'IPCC 2019 Refinement Vol.4 Ch.4 造林', en: 'IPCC 2019 Refinement Vol.4 Ch.4 afforestation' }, year: 2019 },
    solar:    { t: 1.8, unit: { zh: '每 3 kWp 屋顶光伏·年替代电量', en: 'per 3 kWp rooftop PV·yr displaced' }, source: { zh: '电网因子 × 3 200 kWh 年发电', en: 'grid factor × 3 200 kWh/yr' }, year: 2023 },
    wetland:  { t: 1.2, unit: { zh: '每恢复 1 ha 湿地·年', en: 'per 1 ha restored wetland·yr' }, source: { zh: 'IPCC 2013 Wetlands Supplement Ch.4', en: 'IPCC 2013 Wetlands Supplement Ch.4' }, year: 2013 },
    ev:       { t: 2.0, unit: { zh: '每替换 10 000 km 燃油里程', en: 'per 10 000 km ICE mileage replaced' }, source: { zh: 'IEA 乘用车平均 200 gCO2/km', en: 'IEA average passenger car 200 gCO2/km' }, year: 2024 },
    cleanup:  { t: 0.3, unit: { zh: '每 1 t 海岸垃圾(间接生态效益)', en: 'per 1 t coastal waste (indirect benefit)' }, source: { zh: '原型自估(间接效益,不确定度大)', en: 'prototype estimate (indirect, high uncertainty)' }, year: 2026 },
    retrofit: { t: 1.1, unit: { zh: '每户年省 2 000 kWh', en: 'per 2 000 kWh saved per home·yr' }, source: { zh: '电网因子 × 典型节能量', en: 'grid factor × typical savings' }, year: 2023 }
  }
};

/* ---- 组织 ---- */
const TYPE_ICONS = { ngo: '🌱', company: '🏢', community: '👥', school: '🎓', gov: '🏛', custom: '🏢', personal: '👥' };
const ORGS = [
  { key: 'org-gbg',        name: { zh: '绿色海湾志愿队', en: 'Green Bay Volunteers' }, type: 'community', city: 0,  w: 1.5 },
  { key: 'org-ecoride',    name: { zh: '绿行充电网络', en: 'EcoRide Charging' },       type: 'company',   city: 0,  w: 1.5 },
  { key: 'org-qingrun',    name: { zh: '清润湿地协会', en: 'Qingrun Wetland Society' }, type: 'ngo',       city: 2,  w: 1.5 },
  { key: 'org-sunpower',   name: { zh: '阳光光伏合作社', en: 'SunPower Solar Co-op' },  type: 'company',   city: 3,  w: 1.5 },
  { key: 'org-treefirst',  name: { zh: '一树公益', en: 'TreeFirst Foundation' },       type: 'ngo',       city: 1,  w: 1.5 },
  { key: 'org-homefit',    name: { zh: '安居节能', en: 'HomeFit Energy' },             type: 'company',   city: 5,  w: 3 },
  { key: 'org-kinara',     name: { zh: 'Kinara 海岸守护队', en: 'Kinara Coast Keepers' }, type: 'community', city: 6, w: 5 },
  { key: 'org-hijau',      name: { zh: 'Hijau Nusantara 协会', en: 'Hijau Nusantara' }, type: 'ngo',       city: 7,  w: 2 },
  { key: 'org-sierra',     name: { zh: 'Sierra Verde 社区', en: 'Sierra Verde Collective' }, type: 'community', city: 8, w: 2 },
  { key: 'org-hijaukl',    name: { zh: 'Hijau KL 社区', en: 'Hijau KL Community' },    type: 'community', city: 9,  w: 1.5 },
  { key: 'org-tidal',      name: { zh: '潮汐守护者', en: 'Tidal Guardians' },          type: 'ngo',       city: 10, w: 1.5 },
  { key: 'org-mumbai',     name: { zh: '孟买绿色网格', en: 'Mumbai Green Grid' },      type: 'ngo',       city: 11, w: 2 },
  { key: 'org-amazonia',   name: { zh: 'Amazônia Viva', en: 'Amazônia Viva' },         type: 'ngo',       city: 12, w: 2 },
  { key: 'org-lagosclean', name: { zh: '拉各斯清洁城市', en: 'Lagos Clean Cities' },   type: 'community', city: 13, w: 3 }
];

/* ---- 提交人(绑定组织或为个人 org:null) ---- */
const PEOPLE = [
  { name: '林晓', org: 'org-gbg' }, { name: '王梓', org: 'org-gbg' }, { name: '刘安琪', org: 'org-gbg' },
  { name: '陈雨桐', org: 'org-qingrun' }, { name: '何雨晴', org: 'org-qingrun' },
  { name: '张伟', org: 'org-sunpower' }, { name: '吴悠', org: 'org-sunpower' },
  { name: '刘畅', org: 'org-ecoride' }, { name: '徐嘉', org: 'org-ecoride' },
  { name: '赵一鸣', org: 'org-treefirst' }, { name: '孙启', org: 'org-treefirst' },
  { name: '李楠', org: 'org-homefit' }, { name: '罗伊', org: 'org-homefit' },
  { name: 'Amina Wanjiru', org: 'org-kinara' },
  { name: 'Putri Rahma', org: 'org-hijau' },
  { name: 'Diego Torres', org: 'org-sierra' },
  { name: 'Aiman Rahman', org: 'org-hijaukl' },
  { name: 'Siti Nurul', org: 'org-tidal' },
  { name: 'Priya Nair', org: 'org-mumbai' }, { name: 'Ravi Kumar', org: 'org-mumbai' },
  { name: 'Beatriz Silva', org: 'org-amazonia' },
  { name: 'Chidi Okafor', org: 'org-lagosclean' },
  { name: '黄思远', org: null }, { name: '周子墨', org: null }, { name: '郑浩然', org: null }, { name: 'Grace Kim', org: null }
];

const DEVICES = ['iPhone 15 Pro', 'Pixel 9', 'Redmi K70', 'Galaxy S24', 'Mi 14', 'OnePlus 12'];

/* ---- 真实照片素材(公有领域 / CC 许可,本地化存储,出处见 build/photos-manifest.json) ---- */
const PHOTOS = {
  afforest: ['assets/photos/afforest-01.jpg', 'assets/photos/afforest-02.jpg'],
  solar:    ['assets/photos/solar-01.jpg',    'assets/photos/solar-02.jpg'],
  wetland:  ['assets/photos/wetland-01.jpg',  'assets/photos/wetland-02.jpg'],
  ev:       ['assets/photos/ev-01.jpg',       'assets/photos/ev-02.jpg'],
  cleanup:  ['assets/photos/cleanup-01.jpg',  'assets/photos/cleanup-02.jpg'],
  retrofit: ['assets/photos/retrofit-01.jpg', 'assets/photos/retrofit-02.jpg']
};

/* ---- 生成 ---- */
const ACT_MAP = Object.fromEntries(ACTIONS.map(a => [a.key, a]));

function pickCityIdx(rnd){
  const total = CITIES.reduce((a, c) => a + (c.w || 1), 0);
  let v = rnd() * total;
  for(let i = 0; i < CITIES.length; i++){ v -= (CITIES[i].w || 1); if(v <= 0) return i; }
  return 0;
}
function pickOrg(rnd){
  const total = ORGS.reduce((a, o) => a + (o.w || 1), 0);
  let v = rnd() * total;
  for(const o of ORGS){ v -= (o.w || 1); if(v <= 0) return o; }
  return ORGS[0];
}
/* 75% 概率按城市侧重选行动(制造缺口故事),否则按全球权重 */
function pickAction(rnd, cityIdx){
  const focus = CITY_FOCUS[cityIdx];
  if(focus && rnd() < 0.75) return ACT_MAP[focus[Math.floor(rnd() * focus.length)]];
  const total = ACTIONS.reduce((a, x) => a + x.w, 0);
  let v = rnd() * total;
  for(const a of ACTIONS){ v -= a.w; if(v <= 0) return a; }
  return ACTIONS[0];
}
function randHash(rnd){
  let s = '';
  for(let i = 0; i < 8; i++) s += '0123456789abcdef'[Math.floor(rnd() * 16)];
  return s;
}
function mkScores(rnd, b){
  const j = x => clamp(Math.round(100 * (x + (rnd() - 0.5) * 0.16)), 20, 100);
  return { auth: j(b.auth), action: j(b.action), loc: j(b.loc) };
}
function overallOf(subs, jitter){
  return clamp(Math.round(0.4 * subs.auth + 0.35 * subs.action + 0.25 * subs.loc + jitter), 0, 100);
}

function buildSubmissions(){
  const rnd = mulberry32(20261113);
  const subs = [];
  /* 57 条基线提交:组织/个人 → 城市(与组织一致)→ 行动(城市侧重) */
  for(let i = 0; i < 57; i++){
    const day = 13 - Math.floor(13 * Math.pow(rnd(), 1.55));
    let person, org = null, city;
    if(rnd() < 0.72){
      const o = pickOrg(rnd);
      const members = PEOPLE.filter(p => p.org === o.key);
      person = members[Math.floor(rnd() * members.length)];
      org = o.key;
      city = rnd() < 0.85 ? o.city : pickCityIdx(rnd);
    } else {
      const inds = PEOPLE.filter(p => !p.org);
      person = inds[Math.floor(rnd() * inds.length)];
      city = pickCityIdx(rnd);
    }
    const a = pickAction(rnd, city);
    const s = mkScores(rnd, a.bases);
    const pool = PHOTOS[a.key] || [];
    subs.push({
      id: 'PA-' + (1041 + i),
      submitter: person.name, org,
      action: a.key, city,
      time: new Date(2026, 9, 31 + day, 7 + Math.floor(rnd() * 13), Math.floor(rnd() * 60)),
      subs: s, score: overallOf(s, (rnd() - 0.5) * 4),
      device: DEVICES[Math.floor(rnd() * DEVICES.length)],
      gpsOk: rnd() > 0.10, hash: randHash(rnd), dup: null, status: null,
      photo: pool.length ? pool[i % pool.length] : null
    });
  }
  /* 定向构造:4 条低分(驳回演示)+ 2 条地理异常(强制复核 + 智能体演示) */
  const craft = [
    { i: 6, low: true },
    { i: 13, low: true, gps: false },
    { i: 21, low: true },
    { i: 32, low: true, gps: false },
    { i: 11, loc: true },
    { i: 27, loc: true, gps: false }
  ];
  craft.forEach(c => {
    const s = subs[c.i];
    if(c.low){
      s.subs = { auth: 38 + Math.round(rnd() * 14), action: 42 + Math.round(rnd() * 12), loc: 35 + Math.round(rnd() * 15) };
    }
    if(c.loc) s.subs.loc = 38 + Math.round(rnd() * 16);
    s.score = overallOf(s.subs, (rnd() - 0.5) * 4);
    if(c.gps !== undefined) s.gpsOk = c.gps;
  });
  /* 覆盖补全(确定性):保证重点城市有足够样本支撑缺口分析 */
  const COVER = { 3: 4, 4: 2, 6: 7, 13: 3 }; /* 杭州 / 厦门 / 内罗毕 / 拉各斯的最低样本数 */
  Object.keys(COVER).forEach(cIdx => {
    const i = +cIdx;
    let n = subs.filter(s => s.city === i).length;
    let k = 0;
    while(n < COVER[i] && k < 9){
      const focus = CITY_FOCUS[i] || ['afforest'];
      const a = ACT_MAP[focus[k % focus.length]];
      const o = ORGS.find(x => x.city === i);
      const members = o ? PEOPLE.filter(p => p.org === o.key) : PEOPLE.filter(p => !p.org);
      const person = members.length ? members[k % members.length] : PEOPLE[Math.floor(rnd() * PEOPLE.length)];
      const day = (13 - ((k * 3) + i) % 14 + 14) % 14;
      const s = mkScores(rnd, a.bases);
      const pool = PHOTOS[a.key] || [];
      subs.push({
        id: 'PA-' + (1041 + subs.length),
        submitter: person.name, org: o ? o.key : null,
        action: a.key, city: i,
        time: new Date(2026, 9, 31 + day, 8 + ((k * 5 + i) % 11), (k * 13) % 60),
        subs: s, score: overallOf(s, (rnd() - 0.5) * 4),
        device: DEVICES[(k + i) % DEVICES.length],
        gpsOk: rnd() > 0.10, hash: randHash(rnd), dup: null, status: null,
        photo: pool.length ? pool[(k + i) % pool.length] : null
      });
      n++; k++;
    }
  });
  /* 重复组:1 哈希一致 + 2 感知哈希 + 2 裁剪变体,共 7 条重复提交
     重复成员 = 同城组织成员(组织-城市保持一致的连贯故事) */
  const DUP_PLAN = [
    { type: 'exact', sim: 0.99, dups: 1 },
    { type: 'perceptual', sim: 0.93, dups: 2 },
    { type: 'perceptual', sim: 0.91, dups: 1 },
    { type: 'crop', sim: 0.88, dups: 2 },
    { type: 'crop', sim: 0.87, dups: 1 }
  ];
  const baseIdx = [2, 8, 16, 24, 30];
  baseIdx.forEach((bi, gi) => {
    const plan = DUP_PLAN[gi];
    const base = subs[bi];
    const gid = 'G-' + String(gi + 1).padStart(2, '0');
    for(let d = 0; d < plan.dups; d++){
      const sub = JSON.parse(JSON.stringify(base));
      sub.id = 'PA-' + (1041 + subs.length);
      /* 换一个同城提交人(组织也随人走) */
      let cand = PEOPLE.filter(p => p.name !== base.submitter && (!p.org || ORGS.find(o => o.key === p.org).city === base.city));
      if(!cand.length) cand = PEOPLE.filter(p => p.name !== base.submitter);
      const person = cand[Math.floor(rnd() * cand.length)];
      sub.submitter = person.name;
      sub.org = person.org;
      sub.time = new Date(Math.min(TODAY.getTime(), base.time.getTime() + (d + 1) * (5 + Math.floor(rnd() * 40)) * 3600e3));
      if(plan.type !== 'exact') sub.hash = randHash(rnd);
      sub.score = clamp(Math.round(base.score + (rnd() - 0.5) * 4), 0, 100);
      sub.subs = {
        auth: clamp(base.subs.auth + Math.round(rnd() * 4 - 2), 0, 100),
        action: clamp(base.subs.action + Math.round(rnd() * 4 - 2), 0, 100),
        loc: clamp(base.subs.loc + Math.round(rnd() * 4 - 2), 0, 100)
      };
      sub.dup = { group: gid, sim: Math.min(1, plan.sim + rnd() * 0.02 - 0.01), base: base.id, type: plan.type };
      subs.push(sub);
    }
  });
  subs.forEach(s => {
    if(s.dup) s.status = 'flagged';
    else if(s.score >= 85) s.status = 'verified';
    else if(s.score < 60) s.status = 'rejected';
    else s.status = 'pending';
  });
  subs.sort((a, b) => b.time - a.time);
  /* 碳参考估算附着到每条提交(公开因子 × 1 个行动单元) */
  subs.forEach(s => { s.tco2e = (CARBON.actions[s.action] || { t: 0 }).t; });
  return subs;
}

/* ============================================================
   聚合统计(纯函数,状态可变后仍可重算)
   ============================================================ */
const TODAY = new Date(2026, 10, 13, 18, 0);
const DAY0 = new Date(2026, 9, 31, 0, 0);
const dayIndex = d => Math.floor((d - DAY0) / 86400e3);
const sameDay = (a, b) => a.toDateString() === b.toDateString();

const PROOF = {
  actions: ACTIONS, categories: CATEGORIES, statuses: STATUS,
  cities: CITIES, orgs: ORGS,
  submissions: buildSubmissions(),
  today: TODAY,
  byId(id){ return this.submissions.find(s => s.id === id); },
  city(c){ return this.cities[c]; },
  action(k){ return this.actions.find(a => a.key === k); },
  category(k){ return this.categories.find(c => c.key === k); },
  org(k){
    /* 自定义组织 'custom:<名称>':合成未登记组织记录(type 'custom'),使其进入
       Analytics 钻取与地图项目清单;分组城市由提交的 s.city(表单所选城市)决定 */
    if(k && k.startsWith('custom:')) return { key: k, name: { zh: k.slice(7), en: k.slice(7) }, type: 'custom', city: null };
    return this.orgs.find(o => o.key === k);
  },

  /* ---- 碳参考估算(公开因子 × 行动单元;非已核证减排/非已发放积分) ---- */
  carbon(k){ return CARBON.actions[k] || null; },
  carbonFactors(){ return CARBON; },
  verifiedMitigation(){
    return this.submissions.filter(s => s.status === 'verified').reduce((a, s) => a + (s.tco2e || 0), 0);
  },
  blockedMitigation(){
    /* 重复拦截:flagged 成员本会重复发放的"幻影积分" */
    return this.submissions.filter(s => s.status === 'flagged' && s.dup).reduce((a, s) => a + (s.tco2e || 0), 0);
  },
  calibration(){
    /* 分数校准箱:综合分分箱的提交数与自动通过数(人工一致率为演示复核口径,见 UI 说明) */
    const bins = [
      { label: '85–89', min: 85, max: 90 },
      { label: '90–94', min: 90, max: 95 },
      { label: '95–100', min: 95, max: 101 }
    ];
    return bins.map(b => {
      const list = this.submissions.filter(s => s.score >= b.min && s.score < b.max);
      return { label: b.label, count: list.length, autoPass: list.filter(s => s.status === 'verified').length };
    });
  },

  kpis(){
    const S = this.submissions;
    const today = S.filter(s => sameDay(s.time, TODAY)).length;
    const yest = S.filter(s => sameDay(s.time, new Date(2026, 10, 12, 12, 0))).length;
    const cnt = st => S.filter(s => s.status === st).length;
    const pending = cnt('pending'), verified = cnt('verified'), dup = cnt('flagged');
    return {
      total: S.length, today, yest, todayDelta: today - yest, pending,
      verifiedRate: verified / S.length * 100,
      dupRate: dup / S.length * 100,
      avg: S.reduce((a, s) => a + s.score, 0) / S.length
    };
  },

  dailyFlow(){
    const rows = [];
    for(let i = 0; i < 14; i++){
      const d = new Date(2026, 9, 31 + i, 12, 0);
      rows.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), verified: 0, pending: 0, rejected: 0, flagged: 0 });
    }
    this.submissions.forEach(s => { const di = Math.max(0, Math.min(13, dayIndex(s.time))); rows[di][s.status]++; });
    return rows;
  },

  throughput(){
    const labels = [], inV = [], okV = [];
    for(let i = 0; i < 14; i++){
      const d = new Date(2026, 9, 31 + i, 12, 0);
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
      const day = this.submissions.filter(s => Math.max(0, Math.min(13, dayIndex(s.time))) === i);
      inV.push(day.length);
      okV.push(day.filter(s => s.status === 'verified').length);
    }
    return { labels, in: inV, ok: okV };
  },

  scoreHist(){
    const buckets = [
      { label: '<60', min: 0, max: 59 },
      { label: '60–70', min: 60, max: 70 },
      { label: '70–80', min: 71, max: 80 },
      { label: '80–90', min: 81, max: 89 },
      { label: '≥90', min: 90, max: 100 }
    ];
    return buckets.map(b => ({ label: b.label, value: this.submissions.filter(s => s.score >= b.min && s.score <= b.max).length }));
  },

  byAction(){
    return this.actions.map(a => {
      const list = this.submissions.filter(s => s.action === a.key);
      const avg = list.length ? list.reduce((x, s) => x + s.score, 0) / list.length : 0;
      return {
        key: a.key, cat: a.cat, icon: a.icon, color: a.color, count: list.length,
        avg, dupRate: list.length ? list.filter(s => s.status === 'flagged').length / list.length * 100 : 0
      };
    });
  },

  byCategory(){
    return this.categories.map(c => {
      const keys = this.actions.filter(a => a.cat === c.key).map(a => a.key);
      const list = this.submissions.filter(s => keys.includes(s.action));
      const avg = list.length ? list.reduce((x, s) => x + s.score, 0) / list.length : 0;
      return {
        key: c.key, icon: c.icon, color: c.color, count: list.length, avg,
        dupRate: list.length ? list.filter(s => s.status === 'flagged').length / list.length * 100 : 0
      };
    });
  },

  dupGroups(){
    const map = {};
    this.submissions.forEach(s => {
      if(!s.dup) return;
      (map[s.dup.group] = map[s.dup.group] || []).push(s);
    });
    return Object.keys(map).sort().map(gid => {
      const dups = map[gid];
      const base = this.byId(dups[0].dup.base);
      return {
        id: gid,
        type: dups[0].dup.type,
        sim: Math.max(...dups.map(d => d.dup.sim)),
        base, dups
      };
    });
  },

  recent(n){
    return this.submissions.slice(0, n);
  },

  subModels(){
    const m = st => {
      const vals = this.submissions.map(s => s.subs[st]);
      return {
        mean: vals.reduce((a, v) => a + v, 0) / vals.length,
        floor: vals.filter(v => v < 60).length / vals.length * 100
      };
    };
    return { auth: m('auth'), action: m('action'), loc: m('loc') };
  },

  /* ============================================================
     分层聚合(组织 > 城市 > 国家 > 全球)
     ============================================================ */
  _rowStat(key, name, type, list){
    const cnt = st => list.filter(s => s.status === st).length;
    const verified = cnt('verified'), flagged = cnt('flagged'), rejected = cnt('rejected'), pending = cnt('pending');
    return {
      key, name, type,
      count: list.length, verified, flagged, rejected, pending,
      avg: list.length ? list.reduce((a, s) => a + s.score, 0) / list.length : 0,
      list
    };
  },

  countryRows(submissions = this.submissions){
    const map = {};
    submissions.forEach(s => {
      const c = this.city(s.city);
      const k = c.country.en;
      (map[k] = map[k] || { key: k, name: c.country, list: [] }).list.push(s);
    });
    return Object.values(map).map(r => this._rowStat(r.key, r.name, 'country', r.list))
      .sort((a, b) => b.count - a.count);
  },

  cityRows(countryEn, submissions = this.submissions){
    const map = {};
    submissions.filter(s => this.city(s.city).country.en === countryEn).forEach(s => {
      const c = this.city(s.city);
      (map[s.city] = map[s.city] || { key: s.city, name: { zh: c.zh, en: c.en }, list: [] }).list.push(s);
    });
    return Object.values(map).map(r => this._rowStat(r.key, r.name, 'city', r.list))
      .sort((a, b) => b.count - a.count);
  },

  orgRows(cityIdx, submissions = this.submissions){
    const map = {};
    submissions.filter(s => s.city === cityIdx).forEach(s => {
      const k = s.org || 'individual';
      const o = s.org ? this.org(s.org) : null;
      (map[k] = map[k] || {
        key: k, name: o ? o.name : null, type: o ? o.type : 'individual', list: []
      }).list.push(s);
    });
    return Object.values(map).map(r => this._rowStat(r.key, r.name, r.type, r.list))
      .sort((a, b) => b.count - a.count);
  },

  /* 按 国家(en)/城市索引/组织 key('individual' = 个人) 过滤 */
  scopeSubs(countryEn, cityIdx, orgKey, date = null){
    return this.submissions.filter(s => {
      const c = this.city(s.city);
      if(date != null && this.actionDate(s) !== date) return false;
      if(countryEn != null && c.country.en !== countryEn) return false;
      if(cityIdx != null && s.city !== cityIdx) return false;
      if(orgKey != null){
        if(orgKey === 'individual') return !s.org;
        if(s.org !== orgKey) return false;
      }
      return true;
    });
  },

  /* 行动地图:国家 → 状态计数 + 城市计数 */
  actionDate(submission){
    const d = submission.time;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  actionCoverage(submissions){
    const verified = submissions.filter(s => s.status === 'verified');
    // Reporting groups match the map's three planning cards. Existing taxonomy
    // and Analytics categories remain unchanged (retrofit is grouped separately).
    const groups = [
      { key: 'environment', icon: '🌿', actions: ['cleanup', 'wetland', 'afforest'] },
      { key: 'energy', icon: '⚡', actions: ['ev', 'solar'] },
      { key: 'buildings', icon: '🏠', actions: ['retrofit'] }
    ];
    return { total: submissions.length, verified: verified.length,
      groups: groups.map(group => ({ ...group, actions: group.actions.map(key => {
        const count = verified.filter(s => s.action === key).length;
        return { key, verified: count, recorded: submissions.filter(s => s.action === key).length,
          share: verified.length ? count / verified.length * 100 : 0 };
      }) })) };
  },

  mapCountryStats(submissions = this.submissions){
    const map = {};
    submissions.forEach(s => {
      const c = this.city(s.city);
      const k = c.country.en;
      const r = map[k] = map[k] || { name: c.country, total: 0, verified: 0, flagged: 0, rejected: 0, pending: 0, cities: {} };
      r.total++;
      r[s.status]++;
      r.cities[s.city] = (r.cities[s.city] || 0) + 1;
    });
    return map;
  },

  /* ============================================================
     覆盖缺口分析(基于已验证社区项目)
     ============================================================ */
  gapScopes(submissions = this.submissions){
    const scopes = [{ key: 'global', name: null, verified: submissions.filter(s => s.status === 'verified').length }];
    this.countryRows(submissions).forEach(r => {
      const v = r.verified;
      if(v >= 4) scopes.push({ key: r.key, name: r.name, verified: v });
    });
    return scopes;
  },

  /* 返回缺口卡片:
     { kind:'cat'|'action', dom/weak(类别或行动 key), d/w(占比%),
       suggest(建议发起的行动 key), cat(行动级缺口所属类别) } */
  gapAnalysis(scopeKey, submissions = this.submissions){
    const subs = scopeKey === 'global' ? submissions
      : submissions.filter(s => this.city(s.city).country.en === scopeKey);
    const V = subs.filter(s => s.status === 'verified');
    const cards = [];
    if(V.length < 4) return cards;
    const pct = n => Math.round(n / V.length * 100);
    /* 1) 类别级缺口:某大类占绝对主导,另一大类明显不足 */
    const catStats = this.categories.map(c => {
      const keys = this.actions.filter(a => a.cat === c.key).map(a => a.key);
      const n = V.filter(s => keys.includes(s.action)).length;
      return { key: c.key, n, p: pct(n) };
    }).sort((a, b) => b.n - a.n);
    const domCat = catStats[0], weakCat = catStats[catStats.length - 1];
    if(domCat.p >= 60 && weakCat.p <= 25 && domCat.key !== weakCat.key){
      const weakActs = this.actions.filter(a => a.cat === weakCat.key)
        .map(a => ({ key: a.key, n: V.filter(s => s.action === a.key).length }))
        .sort((x, y) => x.n - y.n);
      cards.push({
        kind: 'cat', domCat: domCat.key, weakCat: weakCat.key,
        d: domCat.p, w: weakCat.p, suggest: weakActs[0].key
      });
    }
    /* 2) 类别内行动级缺口:某行动占主导,同类另一行动明显不足 */
    this.categories.forEach(c => {
      const acts = this.actions.filter(a => a.cat === c.key)
        .map(a => ({ key: a.key, n: V.filter(s => s.action === a.key).length }))
        .sort((x, y) => y.n - x.n);
      const catN = acts.reduce((s2, x) => s2 + x.n, 0);
      if(catN < 4) return;
      const dom = acts[0], weak = acts[acts.length - 1];
      const dp = Math.round(dom.n / catN * 100), wp = Math.round(weak.n / catN * 100);
      if(dp >= 55 && wp <= 18){
        cards.push({
          kind: 'action', cat: c.key, dom: dom.key, weak: weak.key,
          d: dp, w: wp, suggest: weak.key
        });
      }
    });
    cards.sort((a, b) => (b.d - b.w) - (a.d - a.w));
    return cards.slice(0, 4);
  }
};
