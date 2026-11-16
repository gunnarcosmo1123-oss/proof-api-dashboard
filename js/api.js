'use strict';
/* ============================================================
   Proof API · 接口层(UI 与验证引擎的唯一边界)
   ============================================================
   真实 API 接入时:仅替换本文件(或新增 api-real.js 并保持同名
   导出),界面代码零改动。当前为本地演示引擎:

   真实计算(浏览器本地,离线可用):
     · SHA-256 文件指纹(精确重复通道)
     · pHash-DCT 64-bit 感知哈希(32×32 灰度 → 手写 2-D DCT → 低频 8×8 去 DC
       → 中位数阈值;汉明距离 < 8 判相似)
     · 噪声谱方差(拉普拉斯算子 → 真实性启发式)
     · 色彩分布(HSV 六桶余弦相似 → 行动匹配启发式,UI 标注"色彩先验")
     · ELA 误差级分析(JPEG q90 重编码 → 逐像素差 → 热力图 + 高误差区占比)
     · EXIF 解析(手写 JPEG APP1/TIFF:GPS、Make/Model、Software、DateTimeOriginal)
     · 溯源凭证检测(字节流搜 c2pa/JUMBF 与 XMP 命名空间)
     · 地理一致性(EXIF GPS 与申报城市 haversine 距离;无 GPS 时演示派生分)
   演示计算(确定性,标注 demo):
     · 无 EXIF GPS 时的地理分(由指纹派生)
     · 综合分与判定(与数据集同一规则)

   返回结构(将来与真实 API 响应对齐):
   proofApiSubmit(payload) → Promise<{
     ok,
     submission: { id, submitter, org, action, city, time, device, gpsOk,
                   hash, phash, width, height, size, mime, status, dup },
     verification: { score, subs:{auth,action,loc}, verdict,
                     flags:[{code, level, msgKey, vars}] },
     receipt: { issuedAt }
   }>
   payload: { file: File, action, city, submitter, org|null, orgType|null, date:'YYYY-MM-DD'|null }
   其中 org 为组织 key、'custom:<名称>'(表单「其他」,未登记组织)或 null=个人;
   orgType 仅自定义组织携带(ngo/company/community/personal);date 为行动日期(缺省=今天)。
   自定义组织以字符串随 REG 持久化(见 saveRegistry),与数据集同构,不破坏 test-data 不变式。
   ============================================================ */

/* ---- 工具:十六进制 ---- */
function bufToHex(buf){
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(arrayBuffer){
  if(window.crypto && crypto.subtle && crypto.subtle.digest){
    try {
      const d = await crypto.subtle.digest('SHA-256', arrayBuffer);
      return bufToHex(d);
    } catch(e) { /* 回退到演示指纹 */ }
  }
  /* 非安全上下文回退:FNV 类演示指纹(带 demo: 前缀标记) */
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const u8 = new Uint8Array(arrayBuffer);
  for(let i = 0; i < u8.length; i++){ h1 = Math.imul(h1 ^ u8[i], 16777619) >>> 0; h2 = (h2 + u8[i] * (i + 1)) >>> 0; }
  return 'demo:' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/* ---- 图像加载 ---- */
function loadImage(url){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('image decode failed'));
    img.src = url;
  });
}
function drawToCanvas(img, w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  return c;
}

/* ---- pHash 64-bit(感知哈希:32×32 灰度 → 手写 2-D DCT → 低频 8×8(去 DC)→ 中位数阈值) ---- */
/* 1-D DCT-II(标准形式,不做正交归一——阈值比较只看相对大小,缩放无关) */
function dct1d(v){
  const N = v.length, out = new Float64Array(N);
  for(let u = 0; u < N; u++){
    let s = 0;
    for(let x = 0; x < N; x++) s += v[x] * Math.cos(Math.PI * u * (2 * x + 1) / (2 * N));
    out[u] = s;
  }
  return out;
}
/* 纯函数:32×32 灰度 → 64-bit(可 node 单测);去 DC 后 63 个系数,
   末尾补 1 位 0 凑 64 位(该位对所有图像恒同,不影响汉明距离) */
function phashFromGray(gray){
  const N = 32;
  const rows = new Float64Array(N * N);
  for(let y = 0; y < N; y++) rows.set(dct1d(gray.subarray(y * N, y * N + N)), y * N);
  const dct = new Float64Array(N * N);
  const col = new Float64Array(N);
  for(let x = 0; x < N; x++){
    for(let y = 0; y < N; y++) col[y] = rows[y * N + x];
    const t = dct1d(col);
    for(let y = 0; y < N; y++) dct[y * N + x] = t[y];
  }
  /* 低频 8×8 块,排除 DC(0,0);1e-6 以下的浮点残差置零(平坦区域的
     真实系数远大于此,置零保证平坦图得到确定性的全零位串) */
  const low = [];
  for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++){
    if(x === 0 && y === 0) continue;
    const v = dct[y * N + x];
    low.push(Math.abs(v) < 1e-6 ? 0 : v);
  }
  const sorted = low.slice().sort((a, b) => a - b);
  const med = (sorted[31] + sorted[32]) / 2;
  let bits = '';
  for(const v of low) bits += v > med ? '1' : '0';
  bits += '0'; /* 补位凑 64 */
  let hex = '';
  for(let i = 0; i < 64; i += 4) hex += parseInt(bits.substr(i, 4), 2).toString(16);
  return { hex, bits };
}
function phash(img){
  const c = drawToCanvas(img, 32, 32);
  const d = c.getContext('2d').getImageData(0, 0, 32, 32).data;
  const g = new Float64Array(32 * 32);
  for(let i = 0; i < 32 * 32; i++){
    g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  }
  return phashFromGray(g);
}
function hamming(a, b){
  let hd = 0;
  for(let i = 0; i < Math.min(a.length, b.length); i++) if(a[i] !== b[i]) hd++;
  return hd;
}

/* ---- 噪声谱方差(3×3 拉普拉斯) ---- */
function noiseVariance(img){
  const c = drawToCanvas(img, 64, 64);
  const d = c.getContext('2d').getImageData(0, 0, 64, 64).data;
  const w = 64, h = 64;
  const g = new Float32Array(w * h);
  for(let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const lap = new Float32Array(w * h);
  let sum = 0, sum2 = 0, n = 0;
  for(let y = 1; y < h - 1; y++){
    for(let x = 1; x < w - 1; x++){
      const v = 4 * g[y * w + x] - g[y * w + x - 1] - g[y * w + x + 1] - g[(y - 1) * w + x] - g[(y + 1) * w + x];
      lap[y * w + x] = v;
      sum += v; sum2 += v * v; n++;
    }
  }
  const mean = sum / n;
  return Math.max(0, sum2 / n - mean * mean); /* 方差 */
}

/* ---- 色彩分布:HSV 六桶(红/黄/绿/青/蓝/品红)+ 无彩度桶 ---- */
function colorProfile(img){
  const c = drawToCanvas(img, 48, 48);
  const d = c.getContext('2d').getImageData(0, 0, 48, 48).data;
  const buckets = [0, 0, 0, 0, 0, 0, 0]; /* R Y G C B M gray */
  let n = 0;
  for(let i = 0; i < d.length; i += 4){
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const dl = mx - mn;
    let hue = 0;
    if(dl > 0){
      if(mx === r) hue = ((g - b) / dl) % 6;
      else if(mx === g) hue = (b - r) / dl + 2;
      else hue = (r - g) / dl + 4;
      hue = ((hue * 60) + 360) % 360;
    }
    const sat = mx === 0 ? 0 : dl / mx;
    if(sat < 0.12 || mx < 0.12) buckets[6]++;
    else buckets[Math.floor(((hue + 15) % 360) / 60)]++;
    n++;
  }
  return buckets.map(v => v / n);
}
/* 各行动类型的期望色彩分布 —— 手写先验(启发式,非分类模型):
   仅按典型场景的色彩统计做余弦相似。它区分不了"有垃圾的海滩"与"干净的海滩",
   UI 中必须标注「色彩先验(启发式)」,不得冒充分类模型。 */
const ACTION_PROFILE = {
  afforest: [0.03, 0.06, 0.38, 0.18, 0.10, 0.03, 0.22],
  solar:    [0.06, 0.10, 0.10, 0.08, 0.30, 0.06, 0.30],
  wetland:  [0.05, 0.07, 0.28, 0.16, 0.22, 0.05, 0.17],
  ev:       [0.08, 0.08, 0.12, 0.10, 0.22, 0.08, 0.32],
  cleanup:  [0.06, 0.18, 0.14, 0.14, 0.22, 0.06, 0.20],
  retrofit: [0.08, 0.10, 0.10, 0.08, 0.12, 0.08, 0.44]
};
function cosine(a, b){
  let dot = 0, na = 0, nb = 0;
  for(let i = 0; i < a.length; i++){ dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if(!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

/* ============================================================
   图像取证(全部零依赖、本地实测)
   1) EXIF —— 手写 JPEG APP1/TIFF 解析
   2) 溯源凭证 —— 字节流搜 c2pa/JUMBF 与 XMP 命名空间
   3) ELA —— JPEG q90 重编码逐像素误差热力图
   4) haversine —— EXIF GPS 与申报城市距离
   ============================================================ */

/* ---- 字节工具 ---- */
function findBytes(hay, needle){
  outer:
  for(let i = 0; i + needle.length <= hay.length; i++){
    for(let j = 0; j < needle.length; j++) if(hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
const BYTES = s => Array.from(s).map(c => c.charCodeAt(0));

/* ---- EXIF:JPEG 段遍历 + TIFF/IFD0/ExifIFD/GPSIFD ---- */
function parseExif(arrayBuffer){
  const out = { hasExif: false, make: null, model: null, software: null, dateTime: null, dateTimeOriginal: null, gps: null };
  const u8 = new Uint8Array(arrayBuffer);
  if(u8.length < 6 || u8[0] !== 0xFF || u8[1] !== 0xD8) return out; /* 非 JPEG */
  /* 找 APP1/Exif 段 */
  let pos = 2, exif = null;
  while(pos + 4 <= u8.length){
    if(u8[pos] !== 0xFF) break;
    const marker = u8[pos + 1];
    if(marker === 0xDA || marker === 0xD9) break; /* SOS / EOI */
    const len = (u8[pos + 2] << 8) | u8[pos + 3];
    if(len < 2) break;
    if(marker === 0xE1){
      const seg = u8.subarray(pos + 4, pos + 2 + len);
      if(seg.length >= 6 && findBytes(seg, BYTES('Exif')) === 0 && seg[4] === 0 && seg[5] === 0){
        exif = seg.subarray(6); /* TIFF 头起始 */
        break;
      }
    }
    pos += 2 + len;
  }
  if(!exif || exif.length < 8) return out;
  out.hasExif = true;

  /* TIFF:II=小端 / MM=大端;IFD0 → ExifIFD(0x8769)与 GPSIFD(0x8825)指针 */
  const le = exif[0] === 0x49;
  if(exif[0] !== 0x49 && exif[0] !== 0x4D) return out;
  const r16 = o => (o + 1 < exif.length) ? (le ? (exif[o] | (exif[o + 1] << 8)) : ((exif[o] << 8) | exif[o + 1])) : NaN;
  const r32 = o => (o + 3 < exif.length) ? (le
    ? ((exif[o] | (exif[o + 1] << 8) | (exif[o + 2] << 16)) + exif[o + 3] * 0x1000000)
    : (exif[o] * 0x1000000 + (exif[o + 1] << 16) + (exif[o + 2] << 8) + exif[o + 3])) : NaN;
  if(r16(2) !== 42) return out;
  const SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  const readIfd = (offset, into) => {
    if(!(offset >= 0) || offset + 2 > exif.length) return;
    const n = r16(offset);
    for(let i = 0; i < n; i++){
      const e = offset + 2 + i * 12;
      if(e + 12 > exif.length) break;
      const type = r16(e + 2), cnt = r32(e + 4);
      const size = SIZE[type] || 0;
      if(!size) continue;
      let vo = e + 8;
      if(size * cnt > 4){
        vo = r32(e + 8);
        if(!(vo >= 0) || vo + size * cnt > exif.length) continue;
      }
      into[r16(e)] = { type, cnt, off: vo };
    }
  };
  /* 通用取值(作用于任意 tag map) */
  const ascii = (map, tag) => {
    const e = map[tag];
    if(!e) return null;
    let s = '';
    for(let i = e.off; i < e.off + e.cnt && i < exif.length; i++){
      if(exif[i] === 0) break;
      s += String.fromCharCode(exif[i]);
    }
    return s.trim();
  };
  const rat3 = (map, tag) => { /* GPS 度分秒:3 个 RATIONAL */
    const e = map[tag];
    if(!e || e.cnt < 3 || e.type !== 5) return null;
    return r32(e.off) / r32(e.off + 4) + r32(e.off + 8) / r32(e.off + 12) / 60 + r32(e.off + 16) / r32(e.off + 20) / 3600;
  };
  const tags = {};
  readIfd(r32(4), tags);
  out.make = ascii(tags, 0x010F);
  out.model = ascii(tags, 0x0110);
  out.software = ascii(tags, 0x0131);
  out.dateTime = ascii(tags, 0x0132);
  /* ExifIFD → DateTimeOriginal;GPSIFD → 经纬度 */
  const exifIfd = tags[0x8769], gpsIfd = tags[0x8825];
  if(exifIfd){
    const t2 = {};
    readIfd(r32(exifIfd.off), t2);
    out.dateTimeOriginal = ascii(t2, 0x9003);
  }
  if(gpsIfd){
    const t3 = {};
    readIfd(r32(gpsIfd.off), t3);
    const lat = rat3(t3, 0x0002), lon = rat3(t3, 0x0004);
    const latRef = ascii(t3, 0x0001), lonRef = ascii(t3, 0x0003);
    if(lat != null && lon != null && isFinite(lat) && isFinite(lon)){
      out.gps = {
        lat: (latRef === 'S' ? -1 : 1) * lat,
        lon: (lonRef === 'W' ? -1 : 1) * lon
      };
    }
  }
  return out;
}

/* EXIF 时间串 "YYYY:MM:DD HH:MM:SS" → Date(容错) */
function parseExifDate(s){
  if(!s) return null;
  const m = String(s).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if(!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6] || 0);
  return isNaN(d.getTime()) ? null : d;
}

/* ---- 溯源凭证:整文件字节流搜 c2pa / JUMBF / XMP 命名空间 ---- */
function scanProvenance(arrayBuffer){
  const u8 = new Uint8Array(arrayBuffer);
  return {
    c2pa: findBytes(u8, BYTES('c2pa')) >= 0 || findBytes(u8, BYTES('C2PA')) >= 0,
    jumbf: findBytes(u8, BYTES('jumb')) >= 0,
    xmp: findBytes(u8, BYTES('http://ns.adobe.com/xap/1.0/')) >= 0 || findBytes(u8, BYTES('adobe:ns:meta')) >= 0
  };
}

/* ---- ELA 误差级分析:q90 重编码 → 逐像素绝对差 → 放大热力图 ---- */
const ELA_RAMP = (() => {
  const stops = [[0, 13, 17, 28], [64, 29, 78, 216], [128, 124, 58, 237], [192, 225, 29, 72], [224, 245, 158, 11], [255, 255, 244, 214]];
  const ramp = [];
  for(let i = 0; i < 256; i++){
    const f = i / 255 * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(f));
    const t = f - k, A = stops[k], B = stops[k + 1];
    ramp.push([Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t), Math.round(A[3] + (B[3] - A[3]) * t)]);
  }
  return ramp;
})();
function computeELA(img){
  const maxDim = 512;
  const sc = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * sc));
  const h = Math.max(8, Math.round(img.naturalHeight * sc));
  const reencoded = drawToCanvas(img, w, h).toDataURL('image/jpeg', 0.9);
  return loadImage(reencoded).then(rec => {
    const a = drawToCanvas(img, w, h).getContext('2d').getImageData(0, 0, w, h).data;
    const b = drawToCanvas(rec, w, h).getContext('2d').getImageData(0, 0, w, h).data;
    const out = drawToCanvas(img, w, h);
    const px = out.getContext('2d').createImageData(w, h);
    let sum = 0, high = 0;
    for(let i = 0; i < w * h; i++){
      const o = i * 4;
      const d = (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3;
      sum += d;
      if(d > 8) high++;
      const c = ELA_RAMP[Math.min(255, Math.round(d * 9))]; /* 误差放大 ×9 */
      px.data[o] = c[0]; px.data[o + 1] = c[1]; px.data[o + 2] = c[2]; px.data[o + 3] = 255;
    }
    out.getContext('2d').putImageData(px, 0, 0);
    return {
      heatmap: out.toDataURL('image/jpeg', 0.85),
      meanErr: sum / (w * h),
      highRatio: high / (w * h),
      w, h
    };
  });
}

/* ---- haversine 距离(km)与地理一致性映射 ---- */
function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}
function locFromKm(km){
  return Math.round(Math.max(30, Math.min(98, 98 - 2.1 * Math.pow(km, 0.75))));
}

/* ---- 会话重复注册表(含本地持久化与算法版本迁移) ---- */
const REG_KEY = 'proof-session';
/* pHash 算法版本:v1 = aHash(8×8 均值阈值,旧实现);v2 = pHash-DCT(32×32 → 低频 8×8 去 DC → 中位数)。
   版本不符时旧 phash 条目作废(跨算法汉明距离无意义),从会话缩略图异步重建,
   避免升级后旧条目与新上传之间出现错误匹配。 */
const PHASH_VERSION = 2;
function loadRegistry(){
  try {
    const raw = localStorage.getItem(REG_KEY);
    if(!raw) return { subs: [], hashes: [], phashes: [] };
    const data = JSON.parse(raw);
    const stale = (data.version || 1) < PHASH_VERSION ? (data.phashes || []) : [];
    return {
      subs: (data.subs || []).map(r => {
        r.submission.time = new Date(r.submission.time);
        return r;
      }),
      hashes: data.hashes || [],
      phashes: stale.length ? [] : (data.phashes || []).map(p => ({ id: p.id, bits: p.bits })),
      stalePhashes: stale.length ? stale : null
    };
  } catch(e) { return { subs: [], hashes: [], phashes: [] }; }
}
function saveRegistry(){
  /* submission 整体序列化:自定义组织('custom:<名称>')、orgType 与 forensics 随之持久化,刷新不丢;
     version 标记 pHash 算法版本,升级时由 loadRegistry 触发重建 */
  try {
    const data = {
      version: PHASH_VERSION,
      subs: REG.subs.map(r => {
        const s = Object.assign({}, r.submission, { time: r.submission.time.getTime() });
        return { submission: s, verification: r.verification, receipt: r.receipt };
      }),
      hashes: REG.hashes,
      phashes: REG.phashes.map(p => ({ id: p.id, bits: p.bits }))
    };
    localStorage.setItem(REG_KEY, JSON.stringify(data));
  } catch(e) {}
}
const REG = loadRegistry();

/* 旧版本 phash 条目重建:从会话缩略图重新计算 DCT 感知哈希(异步;
   无法重建的条目丢弃感知通道,精确哈希通道不受影响) */
function rebuildStalePhashes(){
  const stale = REG.stalePhashes;
  if(!stale || !stale.length){ REG.stalePhashes = null; return; }
  REG.stalePhashes = null;
  let pending = stale.length;
  const done = () => { if(--pending <= 0) saveRegistry(); };
  stale.forEach(entry => {
    const r = REG.subs.find(x => x.submission.id === entry.id);
    const thumb = r && r.submission.thumb;
    if(!thumb){ done(); return; }
    loadImage(thumb)
      .then(img => {
        try { REG.phashes.push({ id: entry.id, bits: phash(img).bits }); }
        catch(e) { /* 缩略图不可解码 → 丢弃该条目的感知通道 */ }
      })
      .catch(() => {})
      .then(done);
  });
}

/* 会话提交并入演示数据集(队列/KPI/智能体 全部实时联动) */
function registerIntoDataset(result){
  const s = result.submission;
  if(PROOF.byId(s.id)) return;
  PROOF.submissions.unshift(s);
}

/* ---- 主入口:提交照片验证 ---- */
async function proofApiSubmit(payload){
  /* payload: { file: File, action, city, submitter, org|null, date:'YYYY-MM-DD'|null } */
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const projectId = payload.projectId ? ProofCommunity.validateLink(payload.projectId, payload.action, payload.city, payload.date || PROOF.actionDate({time:new Date()})) : null;
  const actionEvidence = typeof ProofCommunity !== 'undefined' ? ProofCommunity.normaliseEvidence(payload.action, payload.actionEvidence || {}) : {};
  const device = payload.deviceLocation;
  const deviceLocation = device && Number.isFinite(device.lat) && Math.abs(device.lat) <= 90 &&
    Number.isFinite(device.lon) && Math.abs(device.lon) <= 180 && Number.isFinite(device.accuracyMeters) && device.accuracyMeters >= 0
    ? { lat: device.lat, lon: device.lon, accuracyMeters: device.accuracyMeters, capturedAt: device.capturedAt,
      source: 'browser geolocation, user-attached; not photo EXIF' } : null;
  const file = payload.file;
  const buf = await file.arrayBuffer();
  const url = URL.createObjectURL(file);
  let img;
  try { img = await loadImage(url); }
  finally { URL.revokeObjectURL(url); }

  /* 1) 真实指纹 */
  const hash = await sha256(buf);
  const ph = phash(img);
  const nv = noiseVariance(img);
  const prof = colorProfile(img);

  /* 2) 重复检测(真实) */
  let dup = null;
  const exactHit = REG.hashes.find(h => h.hash === hash);
  let phHit = null, phHd = 99;
  REG.phashes.forEach(p => {
    const hd = hamming(ph.bits, p.bits);
    if(hd < phHd){ phHd = hd; phHit = p; }
  });
  if(exactHit) dup = { sim: 1, hd: 0, base: exactHit.id, type: 'exact' };
  else if(phHit && phHd <= 8) dup = { sim: Math.max(0.5, 1 - phHd / 64), hd: phHd, base: phHit.id, type: 'perceptual' };

  /* 3) 真实性启发式(噪声谱方差 → 演示映射) */
  const auth = Math.round(Math.min(98, Math.max(40, 55 + nv * 3.2)));
  /* 4) 行动匹配启发式:HSV 色彩先验(启发式,非分类模型;UI 标注"色彩先验") */
  const expected = ACTION_PROFILE[payload.action] || ACTION_PROFILE.solar;
  const cos = cosine(prof, expected);
  const actionScore = Math.round(Math.min(98, Math.max(30, 40 + cos * 58)));

  /* 5) 图像取证(全部本地实测):EXIF 解析 / 溯源凭证扫描 / ELA 误差级分析 */
  const exif = parseExif(buf);
  const provenance = scanProvenance(buf);
  let ela = null;
  try { ela = await computeELA(img); } catch(e) { /* ELA 失败不影响提交 */ }

  /* 6) 地理一致性:优先 EXIF GPS 与申报城市 haversine 距离;无 GPS 时演示派生分 */
  let gpsKm = null, locSource = 'demo';
  if(exif.gps && PROOF.cities[payload.city]){
    const c = PROOF.cities[payload.city];
    gpsKm = haversineKm(exif.gps.lat, exif.gps.lon, c.lat, c.lon);
    locSource = 'exif-gps';
  }
  const hSeed = parseInt(hash.slice(0, 8), 16) || 1;
  const loc = gpsKm != null ? locFromKm(gpsKm) : (62 + (hSeed % 35));

  const score = Math.round(0.4 * auth + 0.35 * actionScore + 0.25 * loc);
  const flags = [];
  if(dup) flags.push(dup.type === 'exact'
    ? { code: 'DUP_EXACT', level: 'flagged', msgKey: 'submit.flag.DUP_EXACT', vars: {} }
    : { code: 'DUP_PHASH', level: 'flagged', msgKey: 'submit.flag.DUP_PHASH', vars: { base: dup.base, hd: phHd } });
  if(nv < 1.6 && !dup) flags.push({ code: 'AUTH_SMOOTH', level: 'serious', msgKey: 'submit.flag.AUTH_SMOOTH', vars: {} });
  if(cos < 0.55 && !dup) flags.push({ code: 'ACTION_MISMATCH', level: 'serious', msgKey: 'submit.flag.ACTION_MISMATCH', vars: {} });
  /* EXIF 实测诚信信号(Software 加工痕迹 / 拍摄时间早于申报行动日期) */
  if(exif.software && /photoshop|lightroom|gimp|pixelmator/i.test(exif.software))
    flags.push({ code: 'EXIF_EDITED', level: 'warning', msgKey: 'submit.flag.EXIF_EDITED', vars: { sw: exif.software } });
  if(exif.dateTimeOriginal && payload.date){
    const taken = parseExifDate(exif.dateTimeOriginal);
    const claimed = parseExifDate(payload.date + ' 00:00:00');
    if(taken && claimed && taken < claimed)
      flags.push({ code: 'EXIF_TIME_MISMATCH', level: 'warning', msgKey: 'submit.flag.EXIF_TIME_MISMATCH', vars: { t: exif.dateTimeOriginal } });
  }
  /* EXIF GPS 与申报城市距离(实测) */
  if(gpsKm != null && gpsKm > 300)
    flags.push({ code: 'GEO_MISMATCH', level: 'serious', msgKey: 'submit.flag.GEO_MISMATCH', vars: { km: Math.round(gpsKm) } });
  else if(gpsKm != null && gpsKm > 20)
    flags.push({ code: 'GEO_OFFSET', level: 'warning', msgKey: 'submit.flag.GEO_OFFSET', vars: { km: Math.round(gpsKm) } });
  if(loc < 70 && !dup && gpsKm == null) flags.push({ code: 'GEO_LOW', level: 'warning', msgKey: 'submit.flag.GEO_LOW', vars: {} });

  /* 判定规则:重复 → flagged;低分 → rejected;有任何红旗 → 人工复核;
     与数据集规则一致:红旗永远阻断"自动通过" */
  let verdict;
  if(dup) verdict = 'flagged';
  else if(score < 60) verdict = 'rejected';
  else if(flags.length) verdict = 'pending';
  else if(score >= 85) verdict = 'verified';
  else verdict = 'pending';

  /* 5b) 上传照片缩略图(240px JPEG dataURL,队列/抽屉/重复对比显示真实照片) */
  let thumb = null;
  try {
    thumb = drawToCanvas(img, 240, 150).toDataURL('image/jpeg', 0.72);
  } catch(e) { /* 缩略图失败不影响提交 */ }

  /* 7) 组装提交对象(与数据集同构;自定义组织 org='custom:<名称>' 字符串随对象整体持久化) */
  const nextId = (() => {
    let mx = 1040;
    PROOF.submissions.forEach(s => { const n = parseInt(s.id.slice(3), 10); if(n > mx) mx = n; });
    return 'PA-' + (mx + 1);
  })();
  const groupId = dup ? (() => {
    let mx = 0;
    PROOF.submissions.forEach(s => { if(s.dup){ const n = parseInt(s.dup.group.slice(2), 10); if(n > mx) mx = n; } });
    return 'G-' + String(mx + 1).padStart(2, '0');
  })() : null;
  /* 行动日期:提交表单传入 YYYY-MM-DD(缺省=今天);时间取当前时刻 */
  let time = new Date();
  if(payload.date){
    const m = String(payload.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) time = new Date(+m[1], +m[2] - 1, +m[3], time.getHours(), time.getMinutes());
  }
  const submission = {
    id: nextId,
    submitter: payload.submitter || t('submit.me'),
    org: payload.org || null,
    orgType: payload.orgType || null, /* 仅 'custom:<名称>' 组织携带(ngo/company/community/personal) */
    tco2e: (PROOF.carbon(payload.action) || { t: 0 }).t, /* 碳参考估算(公开因子,非已发放积分) */
    projectId,
    guideVersion: typeof ProofCommunity !== 'undefined' ? ProofCommunity.guides[payload.action].version : null,
    actionEvidence,
    ...(deviceLocation ? { deviceLocation } : {}),
    action: payload.action,
    city: payload.city,
    time,
    subs: { auth, action: actionScore, loc },
    score,
    device: 'Web client',
    gpsOk: !!exif.gps,
    gps: exif.gps ? { lat: +exif.gps.lat.toFixed(5), lon: +exif.gps.lon.toFixed(5) } : null,
    hash: hash.slice(0, 16),
    phash: ph.hex,
    width: img.naturalWidth, height: img.naturalHeight,
    size: file.size, mime: file.type || 'image/*',
    thumb,
    dup: dup ? Object.assign({ group: groupId }, dup) : null,
    forensics: {
      ela: ela ? { meanErr: +ela.meanErr.toFixed(2), highRatio: +ela.highRatio.toFixed(4), heatmap: ela.heatmap } : null,
      exif: {
        hasExif: exif.hasExif, make: exif.make, model: exif.model, software: exif.software,
        dateTime: exif.dateTime, dateTimeOriginal: exif.dateTimeOriginal, gps: exif.gps
      },
      provenance,
      locSource,
      gpsKm: gpsKm != null ? Math.round(gpsKm * 10) / 10 : null
    },
    status: verdict
  };
  const result = {
    ok: true,
    submission,
    verification: {
      score, subs: { auth, action: actionScore, loc }, verdict, flags,
      elapsedMs: Math.max(1, Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0))
    },
    receipt: { issuedAt: new Date() }
  };

  /* 8) 登记:会话注册表 + 演示数据集 */
  REG.subs.push(result);
  REG.hashes.push({ id: submission.id, hash });
  REG.phashes.push({ id: submission.id, bits: ph.bits });
  saveRegistry();
  registerIntoDataset(result);
  return result;
}

/* 生成一张"裁剪 + 滤镜变体"照片(演示感知重复检测:同内容、不同文件字节) */
function makeVariantPhoto(file){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    loadImage(url).then(img => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas');
      const w = Math.round(img.naturalWidth * 0.985);
      const h = Math.round(img.naturalHeight * 0.985);
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.filter = 'brightness(1.03) contrast(1.02) saturate(1.04)';
      /* 轻微裁切(每边 1.5%,实测 pHash 汉明距离 ≈ 4–6,落在 ≤ 8 阈值内)
         + 轻微亮度/对比/饱和微调(模拟滤镜重传) */
      g.drawImage(img,
        Math.round(img.naturalWidth * 0.0075), Math.round(img.naturalHeight * 0.0075),
        Math.round(img.naturalWidth * 0.985), Math.round(img.naturalHeight * 0.985),
        0, 0, w, h);
      /* 输出 PNG:与样本原图同格式,字节不同仅来自裁切/滤镜(JPEG 重编码会
         在 pHash 上引入额外距离,可能把同图推过阈值) */
      c.toBlob(b => {
        if(!b){ rej(new Error('variant encode failed')); return; }
        res(new File([b], 'variant-' + (file.name || 'photo') + '.png', { type: 'image/png' }));
      }, 'image/png');
    }, rej);
  });
}

/* 生成一张合成示例照片(演示用,canvas 绘制 → File) */
function makeSamplePhoto(action){
  return new Promise((res, rej) => {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 300;
    const g = c.getContext('2d');
    const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
    const skyH = action === 'afforest' || action === 'wetland' ? 150 : 210;
    const sky = g.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, '#b9d9f2'); sky.addColorStop(1, '#eef7ff');
    g.fillStyle = sky; g.fillRect(0, 0, 480, skyH);
    g.fillStyle = '#f2d98c';
    g.beginPath(); g.arc(70 + rnd() * 340, 40 + rnd() * 60, 22, 0, Math.PI * 2); g.fill();
    const ground = (action === 'afforest' || action === 'wetland') ? '#4f8f3f' : '#9aa78b';
    g.fillStyle = ground; g.fillRect(0, skyH, 480, 300 - skyH);
    if(action === 'afforest' || action === 'wetland'){
      for(let i = 0; i < 18; i++){
        const x = 15 + rnd() * 450, h = 46 + rnd() * 96;
        g.fillStyle = rnd() > 0.5 ? '#2f6b34' : '#245428';
        g.beginPath(); g.moveTo(x, skyH - h + 20); g.lineTo(x - 18, skyH + 20); g.lineTo(x + 18, skyH + 20); g.closePath(); g.fill();
        g.fillStyle = '#6b4a2f'; g.fillRect(x - 3, skyH + 14, 6, 8);
      }
      if(action === 'wetland'){
        g.fillStyle = '#5a87a5'; g.fillRect(0, skyH - 20, 480, 20);
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
        for(let i = 0; i < 5; i++){ g.beginPath(); const y = skyH - 15 + rnd() * 8; g.moveTo(20, y); g.quadraticCurveTo(140, y - 6, 240, y); g.quadraticCurveTo(340, y + 6, 460, y); g.stroke(); }
      }
    } else if(action === 'solar'){
      g.fillStyle = '#8d7b6a'; g.fillRect(120, 190, 240, 30);
      g.fillStyle = '#1d3557'; g.fillRect(140, 130, 200, 60);
      g.strokeStyle = '#6c7a89'; g.lineWidth = 2;
      for(let i = 1; i < 3; i++){ g.beginPath(); g.moveTo(140 + i * 66, 130); g.lineTo(140 + i * 66, 190); g.stroke(); }
      for(let i = 1; i < 3; i++){ g.beginPath(); g.moveTo(140, 130 + i * 20); g.lineTo(340, 130 + i * 20); g.stroke(); }
    } else if(action === 'cleanup'){
      g.fillStyle = '#d9c39a'; g.fillRect(0, 200, 480, 20);
      g.fillStyle = '#3f6d9e'; g.fillRect(180, 190, 44, 50); g.fillStyle = '#5b87b5'; g.fillRect(172, 178, 60, 16);
      for(let i = 0; i < 14; i++){ g.fillStyle = '#8a7a5a'; g.beginPath(); g.arc(20 + rnd() * 440, 210 + rnd() * 14, 2 + rnd() * 3, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = '#c7cdd4'; g.fillRect(120, 90, 240, 120);
      for(let i = 0; i < 4; i++) for(let j = 0; j < 3; j++){
        g.fillStyle = rnd() > 0.7 ? '#f6d57c' : '#7fb2d6';
        g.fillRect(140 + j * 70, 108 + i * 26, 40, 16);
      }
      if(action === 'ev'){ g.fillStyle = '#2a78d6'; g.fillRect(150, 240, 120, 34); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(185, 274, 14, 0, Math.PI * 2); g.arc(285, 274, 14, 0, Math.PI * 2); g.fill(); }
    }
    c.toBlob(b => {
      if(!b){ rej(new Error('toBlob failed')); return; }
      res(new File([b], 'sample-' + action + '.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

/* 恢复会话提交(页面加载时并入数据集;先迁移旧版本 phash 条目) */
function restoreSession(){
  rebuildStalePhashes();
  REG.subs.forEach(r => registerIntoDataset(r));
}
