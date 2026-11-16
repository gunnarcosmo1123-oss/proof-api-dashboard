'use strict';
/* Local-only evidence UI. No model import, fetch or worker until an explicit click. */
window.ProofEvidence = (() => {
  const originals = new Map(), opinions = new Map(), pairs = new Map();
  const tx = (en, zh) => typeof LANG !== 'undefined' && LANG === 'zh' ? zh : en;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if(cls) node.className = cls;
    if(text != null) node.textContent = text;
    return node;
  };
  const button = (text, fn) => {
    const b = el('button', 'btn btn-ghost', text);
    b.type = 'button'; b.addEventListener('click', fn); return b;
  };
  const note = (root, text, cls = 'evidence-note') => root.appendChild(el('p', cls, text));
  const metric = (root, label, value) => {
    const item = el('div', 'evidence-metric');
    item.append(el('span', '', label), el('b', '', value)); root.appendChild(item);
  };
  function remember(id, file){ originals.set(id, file); }
  async function matchesSubmission(file, s){
    const digest = await sha256(await file.arrayBuffer());
    // Receipts abbreviate SHA-256 to 16 characters; use the full registry digest.
    const registered = REG.hashes.find(entry => entry.id === s.id);
    return registered ? digest === registered.hash : digest.slice(0, 16) === s.hash;
  }

  async function prepareOffline(options = {}){
    if(!/^https?:$/.test(location.protocol) || !isSecureContext || !('caches' in window) || !('serviceWorker' in navigator)){
      throw new Error(tx('Offline app/model caching needs HTTPS or localhost and Cache API support. The offline heuristics remain available (including file://).', '应用/模型离线缓存需要 HTTPS 或 localhost 以及 Cache API 支持。离线启发式仍可使用（包括 file://）。'));
    }
    const registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    const installing = registration.installing || registration.waiting;
    if(installing && installing.state !== 'activated') await new Promise((resolve,reject)=>{
      const timer = setTimeout(()=>{installing.removeEventListener('statechange',check);reject(new Error('Offline worker activation timed out. Please retry.'));},30000);
      function check(){
        if(installing.state === 'activated' || installing.state === 'redundant'){
          clearTimeout(timer);installing.removeEventListener('statechange',check);
          if(installing.state === 'activated')resolve();else reject(new Error('Offline worker could not be installed.'));
        }
      }
      installing.addEventListener('statechange',check);check();
    });
    await navigator.serviceWorker.ready;
    const worker = registration.active;
    if(!worker) throw new Error('The offline service worker could not start.');
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {channel.port1.close();reject(new Error('Offline asset caching timed out. Please retry.'));}, 90000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timer); channel.port1.close();
        if(data.ok) resolve(); else reject(new Error('Offline asset caching failed: ' + data.reason));
      };
      worker.postMessage(options.appOnly ? { type: 'prepare-offline', appOnly: true } : 'prepare-offline', [channel.port2]);
    });
  }

  function modelPanel(parent, result){
    const s = result.submission;
    const root = el('section', 'panel evidence-panel model-panel');
    root.setAttribute('aria-label', tx('On-device model second opinion', '端侧模型第二意见'));
    root.appendChild(el('h3', 'panel-title', tx('🧠 A real model. Your device.', '🧠 真实模型，在你的设备运行。')));
    note(root, tx('Optional CLIP second opinion. The default result above comes from offline heuristics. Your photo stays on this device; only model files are downloaded.', '可选 CLIP 第二意见。上方默认结果来自离线启发式。照片留在本机；网络仅用于下载模型文件。'));
    const badges = el('div', 'evidence-badges');
    badges.append(el('span', '', tx('Opt-in only', '仅主动启用')), el('span', '', tx('No image upload', '不上传照片')), el('span', '', 'CLIP · WASM / CPU'));
    root.appendChild(badges);
    note(root, tx('First run downloads about 150 MB of weights, then caches them on this browser. The runtime is bundled and loaded only on demand. Reuse avoids repeated transfers; energy use depends on your device and grid.', '首次运行下载约 150 MB 权重并在本浏览器缓存。运行库随应用提供，按需加载。重复使用可减少传输；能耗取决于设备与电网。'));
    const controls = el('div', 'evidence-controls');
    const run = button(tx('🧠 Run real model', '🧠 运行真实模型'), () => execute(false));
    run.id = 'run-real-model';
    const offline = button(tx('↻ Verify cache-only rerun', '↻ 验证仅缓存重跑'), () => execute(true));
    offline.hidden = true;
    const cancel = button(tx('Cancel model run', '取消模型运行'), () => {
      if(activeWorker) activeWorker.terminate();
      if(activeTimer) clearTimeout(activeTimer);
      activeWorker = null; generation++; busy(false);
      status.textContent = tx('Model cancelled. The heuristic result remains in use.', '模型已取消，继续使用启发式结果。');
    });
    cancel.hidden = true;
    controls.append(run, offline, cancel); root.appendChild(controls);
    const status = el('p', 'evidence-status', tx('Model has not been loaded for this result. Downloads start only when you run it.', '尚未为此结果加载模型，仅在主动运行时开始下载。'));
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    root.appendChild(status);
    const output = el('div', 'model-output'); root.appendChild(output);
    let activeWorker = null, activeTimer = null, generation = 0;
    function busy(on){ run.disabled = on; offline.disabled = on; cancel.hidden = !on; root.setAttribute('aria-busy', String(on)); }
    const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    const attach = button(tx('Reattach original photo', '重新选择原始照片'), () => input.click());
    attach.hidden = originals.has(s.id);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if(!file || !file.type.startsWith('image/')) return;
      if(!await matchesSubmission(file, s)){
        status.textContent = tx('This file does not match the submitted SHA-256. Reattach the same original photo.', '文件 SHA-256 与提交不一致，请选择同一原始照片。'); return;
      }
      remember(s.id, file); attach.hidden = true;
      status.textContent = tx('Original reattached locally. Ready to run CLIP.', '原始照片已在本地恢复，可以运行 CLIP。');
    });
    root.append(attach, input);
    // Inspect only browser-local metadata. This never fetches model files.
    if('caches' in window) caches.has(PROOF_MODEL.cache).then(async exists => {
      if(!exists) return;
      const keys = await (await caches.open(PROOF_MODEL.cache)).keys();
      const paths = keys.map(k => new URL(k.url).pathname);
      const required = ['config.json','tokenizer.json','tokenizer_config.json','preprocessor_config.json','onnx/model_quantized.onnx'];
      if(required.every(file => paths.some(p => p.endsWith('/'+file)))){
        offline.hidden = false;
        if(!opinions.has(s.id) && !run.disabled) status.textContent = tx('Model files found in this browser cache. A cache-only run verifies offline readiness. Browser storage can be cleared or evicted.', '本浏览器缓存中已找到模型文件。仅缓存重跑可验证离线就绪；浏览器存储可能被清理或回收。');
      }
    }).catch(() => {});

    async function execute(cacheOnly){
      const file = originals.get(s.id);
      if(!file){ status.textContent = tx('The original photo is not retained after reload. Reattach it locally to run the model.', '刷新后不保留原始照片，请在本地重新选择后运行模型。'); attach.hidden = false; return; }
      const token = ++generation;
      busy(true); output.replaceChildren();
      status.classList.remove('evidence-failure');
      status.textContent = tx('Preparing offline assets and browser cache…', '正在准备离线资源与浏览器缓存…');
      try {
        if(!('Worker' in window)) throw new Error('Web Workers are not supported by this browser.');
        if(!cacheOnly) await prepareOffline();
        else if(!isSecureContext || !('caches' in window)) throw new Error('The Cache API is unavailable.');
        if(token !== generation) return;
        const bytes = await file.arrayBuffer();
        activeWorker = new Worker('js/model-worker.js');
        const worker = activeWorker;
        const timeout = setTimeout(() => fail(tx('Model load/inference timed out after 5 minutes.', '模型加载或推理超过 5 分钟。')), 300000);
        activeTimer = timeout;
        function done(){ clearTimeout(timeout); if(activeTimer === timeout) activeTimer = null; worker.terminate(); if(activeWorker === worker) activeWorker = null; if(token === generation) busy(false); }
        function fail(reason){
          done(); if(token !== generation) return;
          status.classList.add('evidence-failure');
          status.textContent = tx('Using the offline heuristic engine. Model unavailable: ', '继续使用离线启发式引擎。模型不可用：') + reason;
        }
        worker.onerror = event => { event.preventDefault(); fail(event.message || 'The model worker failed to load.'); };
        worker.onmessage = ({ data }) => {
          if(token !== generation) return;
          if(data.type === 'progress'){
            const amount = data.total ? ' · ' + (data.loaded / 1048576).toFixed(1) + ' / ' + (data.total / 1048576).toFixed(1) + ' MB' : '';
            status.textContent = (cacheOnly ? tx('Reading cached model: ', '读取缓存模型：') : tx('Loading model: ', '加载模型：')) + data.file + amount;
          } else if(data.type === 'inferring') status.textContent = tx('Running CLIP locally in a worker…', 'CLIP 正在本地工作线程中推理…');
          else if(data.type === 'error') fail(data.reason);
          else if(data.type === 'result'){
            done(); opinions.set(s.id, data); display(data);
          }
        };
        worker.postMessage({ bytes, mime: file.type, cacheOnly }, [bytes]);
      } catch(e){
        if(token !== generation) return;
        busy(false); status.classList.add('evidence-failure');
        status.textContent = tx('Using the offline heuristic engine. Model unavailable: ', '继续使用离线启发式引擎。模型不可用：') + e.message;
      }
    }

    function display(data){
      offline.hidden = false; output.replaceChildren();
      status.textContent = data.cacheOnly
        ? tx('✓ Offline readiness verified: a fresh worker completed a cache-only run. No remote model fetches allowed.', '✓ 离线就绪已验证：新工作线程仅用缓存完成推理，禁止远程模型请求。')
        : (navigator.onLine ? tx('✓ Real inference complete. Weights cached. Verify a cache-only rerun, or disconnect and rerun.', '✓ 真实推理完成，权重已缓存。可验证仅缓存重跑，或断网后重跑。') : tx('✓ Real inference completed offline using cached weights.', '✓ 已使用缓存权重在离线状态完成真实推理。'));
      const metrics = el('div', 'evidence-metrics');
      metric(metrics, tx('Inference · measured', '推理 · 实测'), data.inferenceMs.toFixed(1) + ' ms');
      metric(metrics, tx('Load / initialization', '加载 / 初始化'), (data.loadMs / 1000).toFixed(2) + ' s');
      metric(metrics, tx('Cached model files', '已缓存模型文件'), String(data.cachedFiles));
      output.appendChild(metrics);
      const claimPrompt = PROOF_MODEL.prompts.find(p => p.action === s.action);
      const claimed = data.predictions.find(p => p.label === claimPrompt.text);
      note(output, tx('Claimed action probability: ', '申报行动概率：') + (claimed.score * 100).toFixed(2) + '% · “' + claimPrompt.text + '”');
      const selectLabel = el('label', 'evidence-select', tx('Show predictions ', '显示预测 '));
      const select = el('select', 'txt-in'); select.setAttribute('aria-label', tx('Top-k predictions', 'Top-k 预测'));
      [3,6].forEach(n => { const o = el('option', '', 'Top ' + n); o.value = n; select.appendChild(o); });
      selectLabel.appendChild(select); output.appendChild(selectLabel);
      const list = el('ol', 'model-probabilities'); output.appendChild(list);
      const render = () => {
        list.replaceChildren();
        data.predictions.slice(0, Number(select.value)).forEach(p => {
          const item = el('li', p.label === claimPrompt.text ? 'is-claimed' : '');
          item.dataset.probability = p.score;
          const row = el('div', 'probability-label');
          row.append(el('span', '', p.label), el('b', '', (p.score * 100).toFixed(2) + '%'));
          const meter = el('meter'); meter.min = 0; meter.max = 1; meter.value = p.score; meter.setAttribute('aria-label', p.label);
          item.append(row, meter); list.appendChild(item);
        });
      };
      select.addEventListener('change', render); render();
      note(output, tx('Actual CLIP softmax probabilities across these six candidate prompts. They are relative to this set, not calibrated confidence that an action occurred. CLIP does not detect AI-generated photos or establish authenticity, location, or impact. The heuristic verdict is unchanged.', '这里显示 CLIP 对这六条候选提示的真实 softmax 概率，是候选集合内的相对值，并非行动发生的校准置信度。CLIP 不检测 AI 生成照片，也不证明真实性、地点或效果。启发式判定保持不变。'));
      note(output, PROOF_MODEL.id + ' @ ' + PROOF_MODEL.revision.slice(0, 12) + ' · ' + PROOF_MODEL.runtime, 'evidence-provenance');
    }
    if(opinions.has(s.id)) display(opinions.get(s.id));
    parent.appendChild(root);
  }

  // Windowed grayscale SSIM: deterministic structural resemblance, not a
  // calibrated viewpoint or authenticity probability. RGB greenness is separate.
  function imageStats(pixels){
    const gray = new Float64Array(pixels.length / 4);
    let green = 0;
    for(let i = 0; i < gray.length; i++){
      const r = pixels[i*4], g = pixels[i*4+1], b = pixels[i*4+2];
      gray[i] = .299*r + .587*g + .114*b;
      if(g > r * 1.08 && g > b * 1.08 && g-r > 8 && g > 35) green++;
    }
    return { gray, green: green / gray.length };
  }
  function comparePixels(a, b, width = 128){
    const left = imageStats(a), right = imageStats(b);
    if(a.length !== b.length || !a.length || left.gray.length % width) throw new Error('Pair dimensions do not match.');
    let sum = 0, count = 0;
    for(let y=0; y<left.gray.length/width; y+=8) for(let x=0; x<width; x+=8){
      const av=[], bv=[];
      for(let dy=0; dy<8 && y+dy<left.gray.length/width; dy++) for(let dx=0; dx<8 && x+dx<width; dx++){
        const i=(y+dy)*width+x+dx; av.push(left.gray[i]); bv.push(right.gray[i]);
      }
      const n=av.length, ma=av.reduce((s,v)=>s+v,0)/n, mb=bv.reduce((s,v)=>s+v,0)/n;
      let va=0, vb=0, cov=0;
      for(let i=0;i<n;i++){ va+=(av[i]-ma)**2; vb+=(bv[i]-mb)**2; cov+=(av[i]-ma)*(bv[i]-mb); }
      va/=n; vb/=n; cov/=n;
      sum+=((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225)); count++;
    }
    return { match: Math.max(0,Math.min(1,sum/count)), beforeGreen:left.green, afterGreen:right.green };
  }
  async function compareFiles(before, after){
    const urls = [URL.createObjectURL(before), URL.createObjectURL(after)];
    try {
      const images = await Promise.all(urls.map(loadImage));
      const aspect = images.map(i => i.naturalWidth/i.naturalHeight);
      if(Math.abs(aspect[0]/aspect[1]-1) > .08) throw new Error(tx('Aspect ratios differ by more than 8%. Retake or align the same viewpoint and framing.', '宽高比相差超过 8%，请以相同视角和构图重新拍摄或对齐。'));
      const height = Math.max(8,Math.round(128/aspect[0]));
      const pixels = images.map(i => drawToCanvas(i,128,height).getContext('2d').getImageData(0,0,128,height).data);
      const stats = comparePixels(pixels[0],pixels[1]);
      const hashes = await Promise.all([before,after].map(async f => sha256(await f.arrayBuffer())));
      return { ...stats, identical:hashes[0]===hashes[1] };
    } finally { urls.forEach(URL.revokeObjectURL); }
  }

  function lineChart(parent, points, options){
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 620 205'); svg.setAttribute('role',options.onSelect?'group':'img');
    svg.setAttribute('aria-label',options.title); svg.classList.add('evidence-chart');
    const mk=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!=null)n.textContent=text;svg.appendChild(n);return n;};
    const times=points.map(p=>Date.parse(p.date+'T00:00:00Z')), min=Math.min(...times), max=Math.max(...times);
    const px=i=>48+(max===min?0:(times[i]-min)/(max-min))*550, py=v=>160-(v-options.min)/(options.max-options.min)*130;
    [options.min,(options.min+options.max)/2,options.max].forEach(v=>{
      mk('line',{x1:48,y1:py(v),x2:598,y2:py(v),stroke:'#e2e8ee'});
      mk('text',{x:40,y:py(v)+4,'text-anchor':'end',fill:'#596879','font-size':11},options.format(v));
    });
    mk('polyline',{points:points.map((p,i)=>px(i)+','+py(p.value)).join(' '),fill:'none',stroke:'#16805c','stroke-width':2,'stroke-dasharray':options.dashed?'5 4':'none'});
    const dots=[];
    function select(index){
      dots.forEach((dot,i)=>{dot.setAttribute('aria-pressed',String(i===index));dot.classList.toggle('is-selected',i===index);});
      options.onSelect?.(points[index],index);
    }
    points.forEach((p,i)=>{
      const dot=mk('circle',{cx:px(i),cy:py(p.value),r:options.onSelect?7:4,fill:'#16805c'});
      dots.push(dot);
      if(options.onSelect){
        dot.setAttribute('tabindex','0');dot.setAttribute('role','button');
        dot.setAttribute('aria-label',p.date+' · '+options.format(p.value));
        dot.classList.add('ndvi-point');
        dot.addEventListener('click',()=>select(i));
        dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}});
      }
      const title=document.createElementNS(ns,'title');title.textContent=p.date+' · '+options.format(p.value);dot.appendChild(title);
    });
    [0,points.length-1].forEach(i=>mk('text',{x:px(i),y:185,'text-anchor':i?'end':'start',fill:'#596879','font-size':11},points[i].date));
    parent.appendChild(svg);
    return {select};
  }

  function pairPanel(parent, result){
    const s=result.submission;
    if(!pairs.has(s.id)) pairs.set(s.id,{before:null,after:originals.get(s.id)||null,beforeDate:'',afterDate:fmtDate(s.time),confirmed:false});
    const state=pairs.get(s.id);
    const root=el('section','panel evidence-panel pair-panel');
    root.appendChild(el('h3','panel-title',tx('🌱 From action to outcome', '🌱 从行动到效果')));
    note(root, 'a single photo proves an action happened, not that it worked', 'evidence-integrity');
    note(root,tx('That is the scope of an action record; a photo alone cannot authenticate an event. Pair repeat photos from the same viewpoint, then follow change over time.', '这是行动记录的范围；单张照片本身无法证实事件真实性。请配对同一视角的重复照片，再持续观察变化。'));
    const grid=el('div','pair-grid'); root.appendChild(grid);
    ['before','after'].forEach(key=>{
      const cell=el('div','pair-cell');
      cell.appendChild(el('h4','',key==='before'?tx('Before · baseline','之前 · 基线'):tx('After · submitted evidence','之后 · 提交证据')));
      const preview=el('div','pair-preview');
      const file=state[key];
      if(file){const img=el('img');img.alt=key==='before'?'Before evidence':'After evidence';img.src=URL.createObjectURL(file);img.onload=()=>URL.revokeObjectURL(img.src);preview.appendChild(img);}
      else if(key==='after' && s.thumb){const img=el('img');img.src=s.thumb;img.alt='Stored after preview';preview.appendChild(img);}
      else preview.appendChild(el('span','',tx('Same place. Same framing.', '同一地点，相同构图。')));
      cell.appendChild(preview);
      const input=el('input');input.type='file';input.accept='image/*';input.hidden=true;
      const pick=button(key==='before'?tx('Choose before photo','选择之前照片'):tx('Choose after photo','选择之后照片'),()=>input.click());
      input.addEventListener('change',async()=>{
        const f=input.files[0];if(!f||!f.type.startsWith('image/'))return;
        if(key==='after' && !await matchesSubmission(f,s)){pairStatus.textContent=tx('After photo must match this submission. Choose the submitted original.', '之后照片必须与本次提交一致，请选择提交的原始文件。');return;}
        state[key]=f;delete state.measurement;refresh();
      });
      cell.append(pick,input);
      const label=el('label','pair-date',tx('Acquisition date (self-reported)','拍摄日期（自行申报）'));
      const date=el('input','txt-in');date.type='date';date.value=state[key+'Date'];
      date.addEventListener('change',()=>{state[key+'Date']=date.value;delete state.measurement;output.replaceChildren();});
      label.appendChild(date);cell.appendChild(label);grid.appendChild(cell);
    });
    if(state.before && state.after){
      const urls=[URL.createObjectURL(state.before),URL.createObjectURL(state.after)];
      const wipe=ProofTools.slider(root,urls[0],urls[1]);
      wipe.root.querySelectorAll('img').forEach((image,index)=>{
        const revoke=()=>URL.revokeObjectURL(urls[index]);
        image.addEventListener('load',revoke,{once:true});image.addEventListener('error',revoke,{once:true});
      });
    }
    const confirm=el('label','pair-confirm');const check=el('input');check.type='checkbox';check.checked=state.confirmed;
    check.addEventListener('change',()=>{state.confirmed=check.checked;delete state.measurement;output.replaceChildren();});
    confirm.append(check,document.createTextNode(tx('I confirm the same site, viewpoint and framing. Dates are self-reported.', '我确认地点、视角和构图相同，日期为自行申报。')));root.appendChild(confirm);
    const calculate=button(tx('Compare evidence pair','比较证据对'),async()=>{
      if(!state.before||!state.after){pairStatus.textContent=tx('Choose both original photos. After reload, reattach the submitted original.', '请选择两张原始照片。刷新后需重新选择提交的原始文件。');return;}
      if(!state.confirmed){pairStatus.textContent=tx('Confirm the same viewpoint and framing before comparing.', '比较前请确认视角与构图相同。');return;}
      if(!state.beforeDate||!state.afterDate||state.beforeDate>=state.afterDate){pairStatus.textContent=tx('Use a baseline date earlier than the after date.', '基线日期必须早于之后照片日期。');return;}
      calculate.disabled=true;pairStatus.textContent=tx('Measuring local pixels…','正在测量本地像素…');
      try{state.measurement=await compareFiles(state.before,state.after);renderMeasurement();}
      catch(e){pairStatus.textContent=tx('Pair could not be compared: ','无法比较：')+e.message;}
      finally{calculate.disabled=false;}
    });root.appendChild(calculate);
    const pairStatus=el('p','evidence-status');pairStatus.setAttribute('role','status');root.appendChild(pairStatus);
    const output=el('div','pair-output');root.appendChild(output);
    function renderMeasurement(){
      const m=state.measurement;output.replaceChildren();
      pairStatus.textContent=m.identical?tx('⚠ Identical file: this pair cannot demonstrate change.', '⚠ 两张照片为相同文件，无法证明变化。'):(m.match<.45?tx('⚠ Low visual match. Review viewpoint, framing, lighting and scene changes.', '⚠ 视觉匹配较低，请检查视角、构图、光照与场景变化。'):tx('Local comparison complete. Viewpoint is self-attested, not verified.', '本地比较完成，视角一致为自行确认，未经核实。'));
      const metrics=el('div','evidence-metrics');
      metric(metrics,tx('Visual match · SSIM heuristic','视觉匹配 · SSIM 启发式'),(m.match*100).toFixed(1)+'/100');
      const delta=(m.afterGreen-m.beforeGreen)*100;
      metric(metrics,tx('Visible green-pixel change','可见绿色像素变化'),(delta>=0?'+':'')+delta.toFixed(1)+' pp');output.appendChild(metrics);
      const pointDetail=el('p','evidence-note');pointDetail.setAttribute('role','status');
      const chart=lineChart(output,[{date:state.beforeDate,value:m.beforeGreen},{date:state.afterDate,value:m.afterGreen}],{min:0,max:1,format:v=>(v*100).toFixed(1)+'%',dashed:true,title:tx('Before and after visible green-pixel share','之前与之后的可见绿色像素比例'),onSelect:(point,index)=>{pointDetail.textContent=(index?tx('After','之后'):tx('Before','之前'))+' · '+point.date+' · '+(point.value*100).toFixed(2)+'% · '+tx('Local RGB heuristic; acquisition date self-reported.','本地 RGB 启发式；拍摄日期为自行申报。');}});
      output.appendChild(pointDetail);chart.select(0);
      note(output,tx('Two observations only; dashed line connects endpoints, not measured growth between dates. RGB green-pixel share is a lighting-sensitive heuristic, not NDVI or canopy cover. Structural SSIM uses 8×8 grayscale windows at 128 px width; 100 means visually identical, not authentic. No image registration is performed.', '仅两次观测；虚线只连接端点，不代表期间实测生长。RGB 绿色像素比例受光照影响，并非 NDVI 或冠层覆盖率。结构 SSIM 使用宽度 128 像素的灰度图和 8×8 窗口；100 表示视觉相同，不代表真实。未进行图像配准。'));
    }
    if(state.measurement)renderMeasurement();
    function refresh(){const next=pairPanel(document.createDocumentFragment(),result);root.replaceWith(next);}
    satellitePanel(root,s);
    parent.appendChild(root);return root;
  }

  function satellitePanel(parent, submission){
    const data=window.PROOF_NDVI;
    if(!data){note(parent,tx('Bundled Landsat data unavailable. Photo comparison still works.', '随附 Landsat 数据不可用，仍可比较照片。'));return;}
    const root=el('div','satellite-panel');root.appendChild(el('h4','',tx('Landsat · greenness over time','Landsat · 绿度时间变化')));
    note(root,tx('Real observations at two reference sites. This series is not linked to your submitted photo or evidence of a verified project intervention.', '两个参考地点的真实观测。此序列与提交照片无关联，也不证明项目干预效果。'));
    const label=el('label','evidence-select',tx('Reference project site ','参考项目地点 '));
    const select=el('select','txt-in');select.setAttribute('aria-label',tx('Landsat reference site','Landsat 参考地点'));
    data.sites.forEach(s=>{const o=el('option','',s.name);o.value=s.id;select.appendChild(o);});
    const nearby=data.sites.find(s=>s.city===submission.city);if(nearby)select.value=nearby.id;
    label.appendChild(select);root.appendChild(label);
    const content=el('div');root.appendChild(content);
    function render(){
      const site=data.sites.find(s=>s.id===select.value);const obs=site.observations;content.replaceChildren();
      note(content,site.lat.toFixed(3)+', '+site.lon.toFixed(3)+' · '+data.resolutionMeters+' m · '+obs.length+tx(' clear acquisitions',' 次晴空采集'));
      const acquisition=el('select','txt-in');
      acquisition.setAttribute('aria-label',tx('Selected Landsat acquisition','选择 Landsat 采集'));
      obs.forEach((o,index)=>{const option=el('option','',o.date+' · NDVI '+o.ndvi.toFixed(3));option.value=index;acquisition.appendChild(option);});
      const selected=el('div','ndvi-acquisition');selected.setAttribute('role','status');
      function showAcquisition(_,index){
        const o=obs[index];acquisition.value=index;selected.replaceChildren();
        selected.append(el('b','',tx('Acquired ','采集于 ')+o.acquiredAt.replace('T',' ').replace('Z',' UTC')),el('p','','NDVI '+o.ndvi.toFixed(5)+' · QA_PIXEL '+o.qaPixel+' · QA_RADSAT '+o.qaRadsat));
        const link=el('a','',o.sceneId);link.href=o.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';selected.appendChild(link);
        note(selected,tx('One 30 m reference pixel; no numeric confidence interval is available. Cloud screening, seasonality and mixed pixels remain sources of uncertainty. This is not linked to your submitted photo.','单个 30 米参考像素；无数值置信区间。云筛选、季节变化及混合像元仍带来不确定性；与提交照片无关联。'));
      }
      const chart=lineChart(content,obs.map(o=>({date:o.date,value:o.ndvi})),{min:-1,max:1,format:v=>v.toFixed(3),title:'Landsat NDVI greenness at '+site.name,onSelect:showAcquisition});
      const acquisitionLabel=el('label','evidence-select',tx('Inspect acquisition ','查看采集 '));acquisitionLabel.appendChild(acquisition);
      content.append(acquisitionLabel,selected);
      acquisition.addEventListener('change',()=>chart.select(+acquisition.value));chart.select(0);
      const first=obs[0],last=obs[obs.length-1],delta=last.ndvi-first.ndvi;
      note(content,'NDVI '+first.ndvi.toFixed(3)+' → '+last.ndvi.toFixed(3)+' · Δ '+(delta>=0?'+':'')+delta.toFixed(3)+tx(' (endpoint difference, not a causal trend)','（端点差异，并非因果趋势）'));
      const details=el('details','ndvi-details');details.appendChild(el('summary','',tx('Acquisition dates, raw values & sources','采集日期、原始值与来源')));
      const wrap=el('div','evidence-table-wrap'),table=el('table','evidence-table');
      const head=el('tr');['Acquired (UTC)','NDVI','Scene / source','QA pixel / saturation'].forEach(t=>head.appendChild(el('th','',t)));const thead=el('thead');thead.appendChild(head);table.appendChild(thead);
      const tbody=el('tbody');
      obs.forEach(o=>{const row=el('tr');row.append(el('td','',o.acquiredAt.replace('T',' ').replace('Z','')),el('td','',o.ndvi.toFixed(5)));const source=el('td');const a=el('a','',o.sceneId);a.href=o.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';source.appendChild(a);row.append(source,el('td','',o.qaPixel+' / '+o.qaRadsat));tbody.appendChild(row);});
      table.appendChild(tbody);wrap.appendChild(table);details.appendChild(wrap);
      note(details,data.method);const link=el('a','',tx('Download bundled JSON (raw red/NIR, QA and provenance)','下载随附 JSON（原始红光/近红外、QA 与来源）'));link.href='assets/data/landsat-ndvi.json';link.download='landsat-ndvi.json';details.appendChild(link);content.appendChild(details);
    }
    select.addEventListener('change',render);render();
    note(root,tx('Source: ','来源：')+data.source+' · '+data.provider+' · '+tx('Fetched ','获取于 ')+data.fetchedAt.slice(0,10),'evidence-provenance');
    note(root,tx('Uncertainty: ','不确定性：')+tx(data.uncertainty,'单个 30 米像素无数值置信区间。残留云、大气校正、季节物候、混合像元与定位误差都会影响 NDVI。它是绿度代理，并非冠层百分比、固碳量或项目因果效果。'));
    note(root,tx('Lines connect clear observations; missing/cloudy dates are omitted. Seasonal greening does not establish additionality or permanence. No satellite request is made during the demo.', '连线连接晴空观测；缺失或多云日期被省略。季节变绿不证明额外性或持久性，演示期间不请求卫星数据。'));
    parent.appendChild(root);
  }
    return { remember, prepareOffline, render(parent,result){modelPanel(parent,result);pairPanel(parent,result);}, comparePixels };
})();
