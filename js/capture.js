'use strict';
/* Original files are stored only after an explicit Save draft action. No sync. */
globalThis.ProofDrafts = (() => {
  const DB = 'proof-field-drafts',
    STORE = 'drafts';
  function open() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('IndexedDB is unavailable in this browser.'));
      const request = indexedDB.open(DB, 1);
      let ended = false;
      const timeout = setTimeout(() => {
        ended = true;
        reject(new Error('Local draft storage is blocked. Close other app tabs and retry.'));
      }, 6000);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onerror = () => {
        clearTimeout(timeout);
        ended = true;
        reject(request.error);
      };
      request.onsuccess = () => {
        clearTimeout(timeout);
        if (ended) request.result.close();
        else resolve(request.result);
      };
    });
  }
  async function run(mode, operation) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode),
          request = operation(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = tx.onerror = () =>
          reject(tx.error || request.error || new Error('Local draft storage failed.'));
      });
    } finally {
      db.close();
    }
  }
  const keys = [
    'action',
    'city',
    'name',
    'orgMode',
    'org',
    'orgCustom',
    'orgType',
    'date',
    'projectId',
    'actionEvidence',
    'deviceLocation',
  ];
  async function save(state) {
    if (!state.file || !state.file.type.startsWith('image/'))
      throw new Error('Choose an original image before saving a draft.');
    const metadata = Object.fromEntries(keys.filter((k) => state[k] !== undefined).map((k) => [k, state[k]]));
    const draft = {
      id: state.draftId || 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      version: 1,
      savedAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(metadata)),
      original: state.file,
      name: state.file.name || 'photo.jpg',
      type: state.file.type,
      lastModified: state.file.lastModified || Date.now(),
    };
    await run('readwrite', (store) => store.put(draft));
    return draft.id;
  }
  async function load(id) {
    const draft = await run('readonly', (store) => store.get(id));
    if (!draft || draft.version !== 1 || !(draft.original instanceof Blob))
      throw new Error('This draft has no readable original photo.');
    return {
      ...draft.state,
      draftId: draft.id,
      file: new File([draft.original], draft.name, { type: draft.type, lastModified: draft.lastModified }),
    };
  }
  async function list() {
    return (await run('readonly', (store) => store.getAll()))
      .map((d) => ({
        id: d.id,
        savedAt: d.savedAt,
        name: d.name,
        bytes: d.original?.size || 0,
        action: d.state.action,
        city: d.state.city,
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  return { save, load, list, remove: (id) => run('readwrite', (store) => store.delete(id)) };
})();

globalThis.ProofCapture = (() => {
  const T = ProofTools,
    { L, node: n, button: b, field } = T;
  function render(root, getState, restore, setFile) {
    const panel = n('details', 'pt-capture');
    panel.open = true;
    panel.appendChild(n('summary', '', L('Field capture & offline drafts', '现场拍摄与离线草稿')));
    const content = n('div', 'pt-capture-body');
    panel.appendChild(content);
    content.appendChild(
      n(
        'p',
        'evidence-note',
        L(
          'Photos stay on this device. Saving a draft keeps the original file, including any embedded EXIF/GPS, in this browser’s IndexedDB. Drafts never upload or submit automatically. Delete them on shared devices; clearing browser data removes them.',
          '照片保留在设备上。保存草稿会将原始文件（可能含 EXIF/GPS）保存在本浏览器 IndexedDB 中。草稿不会自动上传或提交。共用设备使用后请删除；清理浏览器数据会移除草稿。',
        ),
      ),
    );
    const controls = n('div', 'evidence-controls');
    const camera = n('input');
    camera.type = 'file';
    camera.accept = 'image/*';
    camera.setAttribute('capture', 'environment');
    camera.hidden = true;
    camera.addEventListener('change', () => {
      if (camera.files[0]) setFile(camera.files[0]);
    });
    controls.append(
      b(L('Take a photo', '拍摄照片'), () => camera.click()),
      camera,
    );
    const state = getState();
    const project = state.projectId && ProofCommunity.projectFor(state.projectId);
    const baseline = project?.observations
      ?.filter((o) => o.photo && o.kind === 'baseline')
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const previous = project?.submissions?.slice().sort((a, b) => b.time - a.time)[0];
    const reference = baseline?.photo || previous?.thumb || previous?.photo;
    if (reference)
      controls.appendChild(
        b(L('Repeat-photo framing guide', '重复拍摄构图指南'), () =>
          framing(reference, getState().url, baseline?.date || PROOF.actionDate(previous)),
        ),
      );
    else
      content.appendChild(
        n(
          'p',
          'evidence-note',
          L(
            'For repeat photos, link a project with a baseline photo. Stand at the same marked point, match the horizon and landmarks, and record lighting and viewpoint changes. Do not enter unsafe places to match a view.',
            '重复拍摄时，请关联含基线照片的项目。从同一标记点拍摄，对齐地平线与地标，记录光照和视角变化；不要为匹配视角进入危险地点。',
          ),
        ),
      );
    content.appendChild(controls);
    const privacy = n('div', 'pt-capture-location');
    const locationStatus = n('p', 'evidence-note');
    locationStatus.setAttribute('role', 'status');
    const updateLocation = () => {
      const loc = getState().deviceLocation;
      locationStatus.textContent = loc
        ? L('Device coordinates attached locally', '已在本地附加设备坐标') +
          ' · ' +
          loc.lat.toFixed(4) +
          ', ' +
          loc.lon.toFixed(4) +
          ' · ±' +
          Math.round(loc.accuracyMeters) +
          ' m · ' +
          L('Not proof of the photo’s location.', '不证明照片拍摄地点。')
        : L(
            'Device-location attachment is off. Local checks still use the claimed city and any GPS embedded in the original photo. Neither is uploaded.',
            '未附加设备位置。本地检查仍使用申报城市及原始照片中可能存在的 GPS。两者均不上传。',
          );
    };
    let locationRequest = 0;
    const locate = b(L('Attach my device location', '附加我的设备位置'), () => {
      if (!navigator.geolocation || !isSecureContext) {
        locationStatus.textContent = L(
          'Location is unavailable. Choose the claimed city manually.',
          '无法获取位置，请手动选择申报城市。',
        );
        return;
      }
      const target = getState();
      const requestVersion = ++locationRequest;
      locate.disabled = true;
      locationStatus.textContent = L('Requesting location only for this draft…', '仅为此草稿请求位置…');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestVersion !== locationRequest) return;
          locate.disabled = false;
          if (getState() !== target || !panel.isConnected) return;
          target.deviceLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: new Date(position.timestamp).toISOString(),
            source: 'browser geolocation, user-attached; not photo EXIF',
          };
          updateLocation();
        },
        () => {
          if (requestVersion !== locationRequest) return;
          locate.disabled = false;
          locationStatus.textContent = L(
            'Location was denied or unavailable. Continue with the claimed city.',
            '位置被拒绝或不可用，请继续使用申报城市。',
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    });
    privacy.append(
      locate,
      b(L('Remove device location', '移除设备位置'), () => {
        locationRequest++;
        locate.disabled = false;
        delete getState().deviceLocation;
        updateLocation();
      }),
      locationStatus,
    );
    updateLocation();
    content.appendChild(privacy);
    const drafts = n('div', 'pt-drafts'),
      status = n('p', 'evidence-status');
    status.setAttribute('role', 'status');
    const save = b(
      L('Save offline draft', '保存离线草稿'),
      async () => {
        save.disabled = true;
        try {
          const current = getState();
          const id = await ProofDrafts.save(current);
          current.draftId = id;
          status.textContent = L(
            'Draft saved with the original photo. You can restore it after reloading, including offline.',
            '已保存草稿及原始照片。刷新后（包括离线时）可恢复。',
          );
          await refresh();
        } catch (e) {
          status.textContent =
            L(
              'Draft was not saved. Keep this page open or keep your original file. Reason: ',
              '草稿未保存。请保持页面打开或保留原文件。原因：',
            ) + e.message;
        } finally {
          save.disabled = false;
        }
      },
      'btn btn-primary',
    );
    const prepare = b(L('Prepare app for offline use', '准备应用离线使用'), async () => {
      prepare.disabled = true;
      status.textContent = L('Caching app pages and bundled photos…', '正在缓存应用页面及随附照片…');
      try {
        await ProofEvidence.prepareOffline({ appOnly: true });
        status.textContent = L(
          'Offline app prepared. Reload without a network to restore drafts and run local checks. No CLIP weights were downloaded. Browser storage can be cleared or evicted.',
          '离线应用已准备好。断网刷新后可恢复草稿并运行本地检查。未下载 CLIP 权重。浏览器存储可能被清理或回收。',
        );
      } catch (e) {
        status.textContent =
          L(
            'Offline preparation failed; local checks remain available in this open page. ',
            '离线准备失败；当前已打开页面仍可运行本地检查。',
          ) + e.message;
      } finally {
        prepare.disabled = false;
      }
    });
    const draftControls = n('div', 'evidence-controls');
    draftControls.append(save, prepare);
    content.append(draftControls, status, drafts);
    async function refresh() {
      try {
        const entries = await ProofDrafts.list();
        if (!panel.isConnected) return;
        drafts.replaceChildren(n('h4', '', L('Saved on this browser', '保存在本浏览器')));
        if (!entries.length)
          drafts.appendChild(n('p', 'evidence-note', L('No saved photo drafts.', '暂无已保存照片草稿。')));
        entries.forEach((entry) => {
          const row = n('div', 'pt-draft-row');
          row.dataset.draft = entry.id;
          row.appendChild(
            n(
              'span',
              '',
              (entry.action ? t('act.' + entry.action) : L('Unfinished action', '未完成行动')) +
                ' · ' +
                entry.savedAt.slice(0, 16).replace('T', ' ') +
                ' UTC · ' +
                Math.ceil(entry.bytes / 1024) +
                ' KB',
            ),
          );
          row.append(
            b(L('Restore draft', '恢复草稿'), async () => {
              try {
                const saved = await ProofDrafts.load(entry.id);
                restore(saved);
              } catch (e) {
                status.textContent = L('Could not restore draft: ', '无法恢复草稿：') + e.message;
              }
            }),
            b(L('Delete draft', '删除草稿'), async () => {
              try {
                await ProofDrafts.remove(entry.id);
                if (getState().draftId === entry.id) delete getState().draftId;
                status.textContent = L(
                  'Saved draft deleted. The currently open photo and submitted records remain available.',
                  '已删除保存的草稿。当前打开的照片及已提交记录仍可使用。',
                );
                await refresh();
              } catch (e) {
                status.textContent = L('Could not delete draft: ', '无法删除草稿：') + e.message;
              }
            }),
          );
          drafts.appendChild(row);
        });
      } catch (e) {
        drafts.textContent = L('Local drafts unavailable: ', '无法使用本地草稿：') + e.message;
      }
    }
    root.appendChild(panel);
    refresh();
  }
  function framing(reference, current, date) {
    const { body } = T.modal(L('Repeat-photo framing guide', '重复拍摄构图指南'));
    body.appendChild(n('p', '', L('Reference date (self-reported): ', '参考日期（自行申报）：') + date));
    if (current) {
      const frame = n('div', 'pt-frame-guide');
      const photo = n('img');
      photo.src = current;
      photo.alt = L('Current photo', '当前照片');
      const ghost = n('img');
      ghost.src = reference;
      ghost.alt = L('Reference framing overlay', '参考构图叠层');
      ghost.className = 'pt-ghost';
      frame.append(photo, ghost);
      body.appendChild(frame);
      const opacity = n('input');
      opacity.type = 'range';
      opacity.min = 0;
      opacity.max = 100;
      opacity.value = 40;
      opacity.addEventListener('input', () => {
        ghost.style.opacity = opacity.value / 100;
      });
      body.appendChild(field(L('Reference overlay opacity', '参考叠层透明度'), opacity));
    } else {
      const image = n('img', 'pt-reference');
      image.src = reference;
      image.alt = L('Previous viewpoint reference', '之前的视角参考');
      body.appendChild(image);
    }
    body.appendChild(
      n(
        'p',
        'evidence-note',
        L(
          'Match the camera position, height, horizon and permanent landmarks. Keep the same orientation, lens and similar lighting. This overlay is a framing aid, not proof of viewpoint or image authenticity. Use “Take a photo” to open your device camera; there is no live camera stream.',
          '匹配相机位置、高度、地平线和固定地标。保持相同方向、镜头及类似光照。叠层仅辅助构图，不证明视角或照片真实性。通过“拍摄照片”打开设备相机；应用不持续采集摄像头画面。',
        ),
      ),
    );
  }
  return { render };
})();
