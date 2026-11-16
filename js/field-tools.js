'use strict';
/* Small, local UI tools shared by the explorer, field capture and stories. */
globalThis.ProofTools = (() => {
  const L = (en, zh) => (typeof LANG !== 'undefined' && LANG === 'zh' ? zh : en);
  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (title, fn, cls = 'btn btn-ghost') => {
    const b = node('button', cls, title);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  const field = (title, input) => {
    const l = node('label', 'pt-field');
    input.setAttribute('aria-label', title);
    l.append(node('span', '', title), input);
    return l;
  };
  const paths = {
    home: 'm3 10 9-7 9 7v10H3z M9 20v-7h6v7',
    submit: 'M12 16V3m-5 5 5-5 5 5 M4 15v6h16v-6',
    overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    queue: 'M8 4h13v17H3V4h2 M8 2h8v5H8z m-2 9 2 2 4-4 m-6 9 2 2 4-4 M15 12h3 M15 18h3',
    dup: 'M8 8h13v13H8z M16 4V3H3v13h1',
    analytics: 'M3 3v18h18 M7 16v-5 M12 16V7 M17 16V4',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
    regions: 'M3 4h7v16H3z M14 4h7v16h-7z M6 15h1 M6 11h1 M17 15h1 M17 8h1',
    agent: 'M8 4V2 M16 4V2 M4 6h16v14H4z M8 10h1 M15 10h1 M8 16h8 M1 10v6 M23 10v6',
    guides: 'M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1z M12 5v16',
    story: 'M5 2h10l4 4v16H5z M14 2v5h5 M8 12h8 M8 16h6',
    about: 'M12 11v6 M12 7h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    cleanup: 'M3 17c3-4 5 4 9 0s6 4 9 0 M8 13l5-9 5 3-5 9 M13 4l1-2',
    wetland: 'M3 17c3-4 5 4 9 0s6 4 9 0 M10 16V6 M10 11C5 11 5 5 5 5c4 0 5 3 5 6 M10 8c0-4 5-5 5-5s0 5-5 5',
    afforest: 'm12 2-7 8h3l-5 7h7v5h4v-5h7l-5-7h3z',
    ev: 'M6 21V4h10v17 M4 21h14 M9 7h4v4H9z M16 12h3v5h2V8l-2-2',
    solar: 'M5 10h14l3 10H2z M8 10l-1 10 M16 10l1 10 M4 15h16 M12 2v3 M4 5l2 2 M20 5l-2 2 M9 8a3 3 0 0 1 6 0',
    retrofit: 'm2 10 10-8 10 8 M5 9v13h14V9 M9 22v-7h6v7',
    location: 'M19 9c0 5-7 13-7 13S5 14 5 9a7 7 0 1 1 14 0 M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    user: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 22v-3a8 8 0 0 1 16 0v3',
    community:
      'M9 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M1 20v-5a5 5 0 0 1 10 0v5 M13 20v-5a5 5 0 0 1 10 0v5',
    building: 'M5 22V2h14v20 M3 22h18 M9 6h1 M14 6h1 M9 10h1 M14 10h1 M9 14h1 M14 14h1 M10 22v-4h4v4',
  };
  function icon(key) {
    const ns = 'http://www.w3.org/2000/svg',
      svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.classList.add('pt-icon');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', paths[key] || paths.map);
    svg.appendChild(p);
    return svg;
  }
  function periodControls(initial, change, options = {}) {
    const root = node('div', 'pt-period'),
      inputs = {};
    const dates = node('div', 'pt-period-dates');
    [
      ['date', options.exactLabel || L('Action date', '行动日期')],
      ['from', L('From date', '开始日期')],
      ['to', L('To date', '结束日期')],
    ].forEach(([key, title]) => {
      const input = node('input', 'txt-in');
      input.type = 'date';
      input.min = '0001-01-01';
      input.max = '9999-12-31';
      inputs[key] = input;
      if (key === 'date' && options.id) input.id = options.id;
      dates.appendChild(field(title, input));
      input.addEventListener('change', () => {
        if (!input.validity.valid) {
          error.textContent = L('Choose a valid calendar date.', '请选择有效日期。');
          return;
        }
        const proposed =
          key === 'date'
            ? { date: input.value, from: null, to: null }
            : { date: null, from: inputs.from.value, to: inputs.to.value };
        if (proposed.from && proposed.to && proposed.from > proposed.to) {
          error.textContent = L(
            'From date must be on or before To date. The previous filter is still applied.',
            '开始日期不能晚于结束日期；仍使用之前的筛选。',
          );
          return;
        }
        error.textContent = '';
        commit(proposed);
      });
    });
    const presets = node('div', 'pt-presets');
    const choices = [
      [L('All dates', '所有日期'), () => ({})],
      [L('Last 7 days', '最近 7 天'), () => ProofPeriod.recent(7)],
      [L('Last 30 days', '最近 30 天'), () => ProofPeriod.recent(30)],
    ];
    choices.forEach(([title, get]) => presets.appendChild(button(title, () => commit(get()))));
    const error = node('p', 'pt-error');
    error.setAttribute('role', 'alert');
    const help = node(
      'p',
      'evidence-note',
      L(
        'Inclusive calendar dates as claimed by contributors. “Last” ends today on this device; seed records are from November 2026.',
        '使用贡献者申报的日历日期，包含首尾两天。“最近”截至本设备今天；演示记录来自 2026 年 11 月。',
      ),
    );
    root.append(dates, presets, help, error);
    let current;
    function sync(period) {
      error.textContent = '';
      current = ProofPeriod.clean(period);
      Object.entries(inputs).forEach(([key, input]) => {
        input.value = current[key] || '';
      });
      presets
        .querySelectorAll('button')
        .forEach((b, i) =>
          b.setAttribute('aria-pressed', String(i === 0 && !current.date && !current.from && !current.to)),
        );
    }
    function commit(period) {
      error.textContent = '';
      sync(period);
      change(current);
    }
    sync(initial);
    return { root, sync, inputs };
  }
  function slider(parent, before, after, options = {}) {
    const box = node('figure', 'pt-compare');
    const frame = node('div', 'pt-compare-frame');
    const first = node('img'),
      second = node('img');
    first.src = before;
    second.src = after;
    first.alt = options.before || L('Before photograph', '之前照片');
    second.alt = options.after || L('After photograph', '之后照片');
    const overlay = node('div', 'pt-compare-overlay');
    overlay.appendChild(second);
    const divider = node('span', 'pt-compare-divider');
    divider.setAttribute('aria-hidden', 'true');
    divider.appendChild(node('span', '', '↔'));
    frame.append(
      first,
      overlay,
      divider,
      node('span', 'pt-compare-before', options.before || L('Before', '之前')),
      node('span', 'pt-compare-after', options.after || L('After', '之后')),
    );
    const range = node('input', 'pt-compare-range');
    range.type = 'range';
    range.min = 0;
    range.max = 100;
    range.value = 50;
    range.setAttribute('aria-label', L('Reveal after photo', '显示之后照片'));
    function update() {
      frame.style.setProperty('--reveal', range.value + '%');
      range.setAttribute(
        'aria-valuetext',
        range.value + L('% of after photo revealed', '% 的之后照片已显示'),
      );
    }
    range.addEventListener('input', update);
    update();
    let dragging = false;
    const move = (event) => {
      const rect = frame.getBoundingClientRect();
      range.value = Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)));
      update();
    };
    frame.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      frame.setPointerCapture(e.pointerId);
      move(e);
    });
    frame.addEventListener('pointermove', (e) => {
      if (dragging) move(e);
    });
    frame.addEventListener('pointerup', () => {
      dragging = false;
    });
    frame.addEventListener('pointercancel', () => {
      dragging = false;
    });
    const caption = node(
      'figcaption',
      'evidence-note',
      L(
        'Drag the divider or use the slider’s arrow keys. Images keep their aspect ratio. Viewpoint and dates are self-reported; no image registration is performed.',
        '拖动分隔线或使用滑块方向键。保留照片宽高比。视角及日期为自行申报；未进行图像配准。',
      ),
    );
    box.append(frame, field(L('Compare before / after', '比较之前 / 之后'), range), caption);
    parent.appendChild(box);
    return { root: box, range };
  }
  function modal(title) {
    const previous = document.activeElement,
      dialog = node('dialog', 'cx-dialog pt-dialog');
    const head = node('div', 'cx-dialog-head'),
      body = node('div', 'cx-dialog-body');
    const heading = node('h2', '', title);
    heading.id = 'pt-dialog-' + Math.random().toString(36).slice(2);
    dialog.setAttribute('aria-labelledby', heading.id);
    head.append(
      heading,
      button(L('Close', '关闭'), () => dialog.close()),
    );
    dialog.append(head, body);
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previous?.isConnected) previous.focus();
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    return { dialog, body };
  }
  function shareMap(state, mode) {
    const { body } = modal(L('Share this map view', '分享此地图视图'));
    body.appendChild(
      node(
        'p',
        '',
        L(
          'Only the place, dates, action type and view are in this link. Local submissions, drafts and photos stay on this device. Recipients see their own records for these filters.',
          '链接仅包含地点、日期、行动类型及视图。本地提交、草稿和照片保留在设备上。接收者将看到自己记录中符合筛选的内容。',
        ),
      ),
    );
    const text = node('textarea', 'txt-in pt-share-url');
    text.readOnly = true;
    text.rows = 4;
    text.value = ProofInsights.mapLink(location.href, state, mode, LANG);
    body.appendChild(field(L('Filtered view link', '筛选视图链接'), text));
    const status = node('p', 'evidence-status');
    status.setAttribute('role', 'status');
    body.append(
      button(L('Copy link', '复制链接'), async () => {
        try {
          await navigator.clipboard.writeText(text.value);
          status.textContent = L('Link copied.', '链接已复制。');
        } catch (_) {
          text.focus();
          text.select();
          status.textContent = L(
            'Copy is unavailable. The link is selected; use your device’s copy command.',
            '无法自动复制。已选中链接，请使用设备的复制功能。',
          );
        }
      }),
      status,
    );
  }
  function exportProject(project) {
    const { body } = modal(L('Download project summary', '下载项目摘要'));
    body.appendChild(
      node(
        'p',
        '',
        L(
          'A local JSON report with records, dates, evidence stages and reporting limits. By default it excludes names, free text, photos and precise coordinates. Original files, EXIF and hashes are always excluded.',
          '本地 JSON 报告包含记录、日期、证据阶段及报告局限。默认排除姓名、自由文本、照片及精确坐标。始终排除原始文件、EXIF 及哈希值。',
        ),
      ),
    );
    const controls = {};
    [
      ['personal', L('Include names and free-text notes', '包含姓名及自由文本备注')],
      ['photos', L('Include stored photo previews', '包含已存储照片预览')],
      ['coordinates', L('Include explicitly attached device coordinates', '包含主动附加的设备坐标')],
    ].forEach(([key, title]) => {
      const input = node('input');
      input.type = 'checkbox';
      controls[key] = input;
      body.appendChild(field(title, input));
    });
    const status = node('p', 'evidence-status');
    status.setAttribute('role', 'status');
    body.append(
      button(
        L('Download JSON summary', '下载 JSON 摘要'),
        () => {
          const report = ProofInsights.summary(
            project,
            Object.fromEntries(Object.entries(controls).map(([k, v]) => [k, v.checked])),
          );
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
          );
          const a = node('a');
          a.href = url;
          a.download = 'proof-project-' + project.id.replace(/[^\w-]/g, '-') + '.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          status.textContent = L(
            'Summary downloaded on this device. Check your privacy choices before sharing it.',
            '摘要已下载至设备。分享前请检查隐私选项。',
          );
        },
        'btn btn-primary',
      ),
      status,
    );
  }
  return { L, node, button, field, icon, periodControls, slider, modal, shareMap, exportProject };
})();
