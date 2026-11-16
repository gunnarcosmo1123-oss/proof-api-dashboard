# Proof API — Verification Dashboard (Team P05)

**AI-powered climate-action verification · high-fidelity interactive prototype v0.2**

<div align="center">

![QR code — scan to open the demo](assets/qr.png)

**Scan to open the demo on your phone** · `https://github.com/gunnarcosmo1123-oss/proof-api-dashboard`

</div>

> 中文摘要:这是 Proof API 的可交互高保真原型——照片提交审核、本地启发式验证评分(端侧实测,演示规则)、重复检测拦截、结果总览分析,外加证据核查智能体;v0.2 新增组织分层分析(组织 → 城市 → 国家 → 全球)、全球行动地图(国家项目清单 + 日期回放)、行动覆盖缺口分析与行动大类(环境类 / 能源类)。纯前端零依赖,双击 index.html 即用,离线可演示,界面为纯英文(仓库保留中文字典但不渲染)。

---

## Pitch deck & submission assets

| Asset | Link |
| --- | --- |
| PDF export of the final deck (16 slides) | [`deck/ProofAPI_Demo_Final.pdf`](deck/ProofAPI_Demo_Final.pdf) · [direct download](https://raw.githubusercontent.com/gunnarcosmo1123-oss/proof-api-dashboard/main/deck/ProofAPI_Demo_Final.pdf) |
| Editable PowerPoint with embedded demo video & speaker notes | [`deck/ProofAPI_Demo_Final.pptx`](deck/ProofAPI_Demo_Final.pptx) |
| Standalone demo video | [`deck/ProofAPI_Demo.mp4`](deck/ProofAPI_Demo.mp4) |
| 3-minute pitch script | [`deck/PITCH_3MIN.md`](deck/PITCH_3MIN.md) |

The PDF is a direct export of the same final `.pptx` — all 16 slides in 16:9, with the demo-video slide rendered as a static poster frame (playback requires the PowerPoint file).

## Quick start

- **Open `index.html`** in any modern browser (double-click works, no server, no dependencies, works offline).
- Language: **English only**. The UI is locked to English from first paint; `?lang=`, localStorage and browser language no longer change it. The Chinese dictionary is kept in the repository for reference but is not rendered.
- Mobile: the repo ships a PWA manifest + icons — open the URL and "Add to Home Screen".
- Hosted offline use: in **Submit → Field capture & offline drafts**, choose **Prepare app for offline use** once while online. This caches the app and local photos without downloading CLIP. Choose **Save offline draft** to retain an original photo, then disconnect, reload and **Restore draft**. Nothing submits automatically.
- Data self-check: `node build/test-data.js` (validates all dataset invariants); QR generator self-check: `node build/verify-qr.js`.
- New evidence checks: `node build/test-evidence.js` (SSIM, green pixels, Landsat QA/provenance and raw-value NDVI calculations).
- Debug URLs: `?tab=map` jumps to the action map, `?map-country=Malaysia` preselects a country, `?map-date=2026-11-10` preselects a replay date, `?drawer=PA-1082` opens a submission detail, `?agent=PA-1082` auto-runs an agent investigation, `?demo-submit=1` runs one scripted photo submission end-to-end, `?demo-submit=2` submits the same photo twice (second one gets flagged as an exact-hash duplicate), **`?tour=1` auto-plays the 90-second narrated story** (upload → real verification → cropped/filtered resubmission → DUP_PHASH interception → the carbon price tag → agent evidence chain; pause / step / skip controls, zero network calls), `?offline=1` shows the static offline first screen.

## Optional real model and paired evidence

Submit a photo, then click **🧠 Run real model** in the result panel. This is an opt-in second opinion; the default submission engine remains zero-dependency, local, and offline, including when double-clicking `index.html`. No model script, WASM, worker, or weights are requested before opt-in.

For the real model, serve the directory on **localhost or HTTPS** (for example `python -m http.server 8000`, then open `http://localhost:8000/?lang=en&tab=submit`). A first run needs a network connection to Hugging Face to download approximately 150 MB of pinned CLIP weights. Browser workers and the Cache API are required. `file://` continues to support heuristics and paired evidence; the model button explains why caching cannot run there.

- **Real local inference:** Transformers.js **2.17.2**, ONNX Runtime Web **1.14.0**, quantized `Xenova/clip-vit-base-patch32` at revision `6b7c523703ae26e39be4b03774966f8571c7f523`. CPU/WASM runs in a worker. The runtime and WASM are bundled locally and loaded on demand. The image is passed to that worker in memory; it is never sent to a server.
- **Natural-language candidates:** “a rooftop covered with solar panels”, “volunteers collecting trash on a beach”, “newly planted tree seedlings”, and matching wetland, EV-charging and insulation prompts. The exact strings appear in the result. Top 3 / top 6 show the actual candidate-relative softmax probabilities, with the claimed action’s probability shown separately. These are **not calibrated authenticity or action-occurrence confidence**.
- **Measured timing:** inference includes CLIP preprocessing/forward pass/postprocessing, measured with `performance.now()`; model loading and initialization are reported separately. The initial run can include WASM compilation overhead. No scores or timing values are fabricated. CLIP never changes the heuristic verdict, duplicate flags, or approval status.
- **Offline proof:** the model files use a versioned Cache API cache. Opt-in also installs a scoped service worker that caches the app shell, local runtime, WASM and demo photos. **Verify cache-only rerun** starts a fresh worker, disallows remote model access and requires WASM fetches to hit cache. To demonstrate a real offline session: complete the first run, disconnect, reload the page, resubmit or reattach the same original, and run again. Original images stay in memory unless explicitly saved as an IndexedDB draft; existing 240 px session thumbnails keep their established localStorage behavior. Browser storage can be evicted or cleared, so a fresh browser/origin can require a new download.
- **Visible fallback:** unsupported contexts/APIs, missing/evicted cache, network/load failures, decode/inference failures, storage-quota errors, cancellation, and a five-minute timeout leave the heuristic result available with a visible reason. A failed model run cannot auto-approve evidence.
- **Positioning:** local processing avoids image uploads and server inference. Cached weights avoid repeated downloads. We do **not** claim measured energy savings: the first download and inference consume energy, and device/grid conditions matter. CLIP is a semantic cross-check alongside hashes/EXIF/provenance; it is **not an AI-generated-image detector**.

The paired-evidence panel uses the submitted original as “after” and accepts a baseline “before” image, self-reported acquisition dates and a same-viewpoint/framing confirmation. It measures windowed grayscale **SSIM** (a structural match heuristic, not a viewpoint probability) and the change in **RGB green-pixel share**. The two-point curve connects observations only; it does not invent intermediate growth. Aspect-ratio differences above 8% are rejected; no registration is performed. Identical files trigger a visible warning. Neither measurement establishes identity, canopy cover or ecological benefit.

The panel states plainly: **“a single photo proves an action happened, not that it worked”**. This describes the scope of an action record; a photo alone cannot authenticate the event.

### Bundled real Landsat observations

`assets/data/landsat-ndvi.json` contains **15 real 2024 acquisitions at two reference sites**: Karura Forest, Nairobi (8) and Xixi Wetland, Hangzhou (7). These are reference project locations, **not verified interventions or locations linked to an uploaded photo**. The UI labels the source, fetched date, coordinates, 30 m resolution, acquisition timestamps, scene IDs and uncertainty. An expandable table links every observation to its STAC record; the downloadable JSON includes red/NIR raw values, QA flags and exact point-sampling URLs.

Source: [USGS Landsat 8–9 Collection 2 Level-2](https://doi.org/10.5066/P9OGBGM6), public-domain USGS observations delivered by Microsoft Planetary Computer. NDVI uses SR_B5 and SR_B4 after applying `reflectance = DN × 0.0000275 − 0.2`. Tier 1 / scene cloud <40%; reject QA_PIXEL fill, dilated-cloud, cirrus, cloud, shadow and snow bits and all QA_RADSAT flags. Keep the first clear sample per month; omit gaps. There is **no numeric confidence interval** for these single-pixel samples. Residual cloud, atmospheric correction, mixed pixels, geolocation and seasonal phenology affect NDVI. Greenness is not canopy percentage, carbon sequestration, additionality, permanence or causal impact.

Refresh intentionally with `python build/fetch-ndvi.py` (Python standard library; network needed only for this build-time operation). It writes the canonical JSON and an identical classic-script copy, `js/ndvi-data.js`, so the entire series is also available under `file://` without fetching JSON. The app makes no satellite requests. Review the data diff after refreshing.

New files: `js/evidence.js` (panels and pixel comparison), `js/model-worker.js` (lazy inference), `js/model-config.js` (pinned revision/prompts), `sw.js` (opt-in offline assets), and `assets/vendor/transformers/` (pinned runtime/WASM, licenses and third-party notices). When changing cached shell assets in a future release, bump `SHELL_CACHE` in `sw.js`.

### Browser verification

The app has no package-manager or build requirement. Optional automated browser checks use Playwright as a **test-only** tool. With the local server running:

```sh
npm install --prefix work/test-tools --cache work/npm-cache playwright@1.65.1
NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-evidence-browser.js
NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-a11y-browser.js
MODEL_TEST=1 NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-evidence-browser.js
```

`test-a11y-browser.js` checks the footer's accessibility claim the way a booth visitor would: Tab order (skip link first), WAI-ARIA tablist/tab/tabpanel semantics on every visible view (the view list is read from the DOM, so new tabs stay covered), and full keyboard traversal with ArrowRight/ArrowLeft/Home/End — in the English-only UI. A human screen-reader pass (NVDA or VoiceOver) is still recommended before claiming anything stronger.

Set `CHROMIUM_PATH` for your installed Chromium if needed. The first command checks the default path, paired evidence, source labels, model-load fallback, mobile layout and `file://` (reports a skip if browser policy blocks local-file navigation). `MODEL_TEST=1` additionally runs genuine CLIP inference, checks all six probabilities sum to one, performs a fresh-worker cache-only run, reloads the app offline, checks original-image reattachment by SHA, and tests fallback after evicting weights. The real-model test downloads ~150 MB and intentionally removes its cached weights at the end. Use `PROOF_TEST_PROFILE` only with a disposable test profile. In a managed network, `PROOF_TEST_MIRROR` can point to a test-only streaming mirror that verifies upstream TLS; it is never an application setting.

## Action Map: global and local community explorer

The **Global action map** and **Country ranking** now stay visible. Below them, the **Community action explorer** starts with a global summary, verification metrics, country breakdown and a community action list; no country click is required. Country/city selectors, an exact **action date** picker, clickable recorded-date bars, **All dates** and **Reset all filters** control a shared scope. Dates refer to the claimed action date, not upload time. Choosing a location preserves the date; choosing a date preserves the location. Empty scopes explicitly show no records instead of inheriting all-time statistics.

Click a map country, city pin, ranking entry or breakdown row to drill down. Search countries or the 14 recorded cities in English (accent-insensitive, so “Medellin” finds Medellín). Selection zooms to the place, highlights it and displays its country/city/community verification analytics directly below. **+ / −**, drag-to-pan and **World view** control the viewport. On a selected date, the map and ranking use that day's global records: countries with any action status are outlined in gold, blue still encodes verified records, and pins show that day's city counts. Zero-data countries remain selectable and clearly empty.

**Open in Analytics** carries the country, city and action date into the existing hierarchy and gap analysis. The hierarchy also has its own date control. These use the same aggregation functions as the map; other existing Analytics charts retain their own stated scope. Map summaries, rankings, lists and coverage recompute after local submissions/review changes instead of holding a stale initial snapshot.

**Action coverage & opportunities** follows the same map filters and shows six action types in three planning groups (Environmental, Energy, Buildings). Counts are **verified / recorded submissions**, while bars are each type's share of all verified actions in that scope. These reporting groups do not change the existing two-category data taxonomy. Missing verified types get concrete discussion options; with at least four verified records, types below 10% share also get a clearly labelled limited-coverage suggestion. A cleanup-only scope therefore surfaces options such as suitable native-tree planting, wetland restoration, solar surveys, charging-demand studies and energy audits. Sparse/empty evidence is labelled, and no needs inference is made with zero verified records. The panel explicitly cautions that missing records may mean incomplete reporting, not ecological need.

The map remains zero-dependency and uses the bundled Natural Earth geometry, with no geocoding, map tiles or network calls. Its new script is included in the optional offline shell cache; existing CLIP weights are retained across the shell version change.

Checks: `node build/test-map-explorer.js` for scopes, coverage denominators and live aggregation; `NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-map-browser.js` with the server running for global/date filtering, highlights, search, zoom/pan, Analytics handoff, recommendations, live updates, mobile layout and offline reload.

## Community experience: discover, plan, document and review

The default **Home** page leads with a credited, bundled community-action photograph and three entry points: **Explore actions**, **Submit evidence** and **Review evidence**. Operational KPIs remain in Overview. Seed records are labelled as simulated, and Commons photographs as illustrative; they are not claimed to depict the demo project locations.

The Action Map adds **Map + gallery / Gallery / Table** modes with the same country, city, action-date and action-type scope. Cards show the action, community/submitter, date and evidence stage; hovering or focusing a card highlights its city and country, while map markers highlight matching cards. Clickable action-type bars filter map highlights, ranking, records and direct analytics. **Open in Analytics** carries that action filter into the hierarchy as well. Coverage intentionally uses **all action types** for the selected location/date, with an explicit note, so filtering the results to cleanup cannot fabricate gaps in the other activity types.

Each coverage card has **Explore this activity**, opening a three-step local project starter: suitability/permissions, project plan, and evidence/follow-up preparation. It collects a project name, community, recorded city, planned date, optional resources/plan and explicit browser-storage consent. Saving creates a project draft and prefills the Submit tab with its action, city, date and explicit project link. Permissions remain **to check**; planning checkboxes do not create baseline evidence or imply permits were granted.

**Evidence guides** contains six English Proof API field guides, version **1.0** (2026-11-15): cleanup, afforestation, solar, wetland restoration, EV charging and retrofit. Each describes suitable conditions, permissions/safeguards, resources, baseline records, action evidence and suggested follow-up. Verra and Climate Action Reserve links are reference frameworks; the guides are our own planning checklists, not approved certification methodologies. The Submit tab also offers optional structured, **self-reported** details (for example species/count/maintenance, solar kWp/installer/meter reference, or cleanup mass/disposal). Numeric details are validated, stored with the guide version and shown in the story; they never feed synthetic model confidence or certify outcomes.

**Project stories** open from gallery cards, table entries, the evidence drawer or submit results. A story includes the community/site, evidence photo and attribution, dated action/review/observation timeline, missing-baseline/follow-up states and the relevant field guide. Explicitly linked repeat submissions appear in one project; nearby records and duplicate photos are never automatically grouped. Seed and standalone records have a single-record story without invented baseline, follow-up or review events. A local project can accept dated baseline/follow-up notes, optional non-negative observations and optional reduced image previews (input limit 12 MB, preview up to 800 px). Dates are self-reported; baselines must precede the action, and follow-ups must follow the latest action. Earlier follow-ups do not count as outcome observations for a later action record.

**Review stages** distinguish automated checks, a recorded human review and outcome-observation availability. The prototype decision formerly labelled “Verified” is now **Accepted**; it is not third-party certification. Accept/reject controls open a review form requiring a self-declared reviewer name, a written reason and an acknowledgement of evidence limitations. Review events are timestamped, retain the original automated disposition and persist across reloads, including decisions on seeded records. “Human reviewed · local” does not imply authenticated identity, independent accreditation or issued credits. Follow-up availability indicates a self-reported record, not proven ecological benefit.

Projects, observation previews and review logs use the versioned `proof-community-v1` browser-storage entry; existing submissions/thumbnails remain in `proof-session`. No accounts, backend, image upload or external service is introduced. Saving fails visibly and atomically if project/review storage is unavailable or full; unreadable project storage is retained instead of silently overwritten. Original observation-photo bytes are not retained. Project-story URLs (`?tab=story&story=PR-…`) reopen local records on the same browser; another device needs its own records and shows an explicit unavailable state. A demo/standalone story uses `story=record:PA-…`.

The new scripts and stylesheet are included in optional offline shell **v3**, retaining the existing model cache and prior-shell fallback. Checks: `node build/test-community.js`, plus `NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-community-browser.js` with the local server running. Browser coverage includes the complete project → linked submission → baseline/follow-up → reasoned review → reload/offline workflow, gallery/table filter parity, linked highlights, source/version labels and mobile layouts.

## Date controls, visual polish, paired views, field capture and regions

Implements roadmap items **4, 7, 8, 13 and 14**:

- **4 — Periods and replay:** the Action Map supports an exact date, inclusive From/To ranges, open-ended ranges and Last 7/30 days ending on the device's current calendar date. Invalid ranges retain the previous applied filter and explain the problem. Lists, counts, ranking, highlights, coverage and the Analytics handoff share the selected period. Play/Pause replays recorded days inside that period; speed is adjustable, Restore selected period returns to the original range, and playback pauses when leaving the tab or hiding the document. Dates are claimed action dates, not upload timestamps. Seed records are from November 2026, so later relative presets can be empty.
- **7 — Shared dashboard styling:** a light forest-green theme, consistent local SVG navigation/action/organisation icons, clearer typography, quieter card borders and spacing apply to the existing dashboards and new community views. Status labels remain explicit; charts keep their categorical/status semantics. No external fonts or icon libraries. Mobile controls have larger touch targets and reduced-motion preferences are respected.
- **8 — Evidence interaction:** before/after photos have a draggable wipe with a keyboard-accessible range input, preserving image aspect ratios. It appears in the submit pair panel and in stories with an actual dated baseline photo and later action/follow-up photo. No baseline is invented for seed records. Measured RGB greenness endpoints and real Landsat NDVI acquisitions can be selected by click/keyboard; NDVI also has a touch-friendly acquisition selector. The detail panel shows acquisition time, NDVI, scene link, QA and uncertainty. Reference satellite pixels remain explicitly unlinked to submission photos; the wipe does not register images or authenticate a viewpoint.
- **13 — Field capture and sharing:** an optional rear-camera file picker, previous-view framing reference/opacity overlay, explicit original-file IndexedDB drafts with restore/delete, and opt-in device geolocation. Location is off until clicked and is labelled separately from photo EXIF. Removal cancels pending attachment; original EXIF remains available to local forensics. HTTPS/localhost is needed for geolocation and app caching; unavailable storage/cache/location APIs show a reason while manual/local checks remain available. Drafts do not auto-restore, upload or submit. They may contain embedded EXIF/GPS, should be deleted on shared devices, and disappear if browser storage is cleared. In-progress originals survive language switches. App-only offline preparation excludes the CLIP runtime/weights; full model preparation remains a separate opt-in. The v4 shell retains existing model caches.
- **14 — Regional comparison:** the **Regions** tab compares two or three countries **or** two or three recorded cities at the same geographic level, using one shared period/action filter. It shows sample sizes, seed/local provenance, accepted-record rate, actual human-review coverage, documentation completeness, linked follow-up coverage and action mix. Duplicate regions are blocked. Zero/small samples and reporting limitations are visible. Activity bars and region headers open the corresponding filtered map. Industry comparison is excluded as requested.

### Comparison definitions and privacy

Acceptance is the current prototype disposition, including automated decisions; it is not independent certification. Human-review coverage counts actual saved reviews, whose identity is self-declared and browser-local. Documentation completeness is assessed **only for local submissions with forensics**: photo preview, valid claimed date/city, and all action-specific guide fields filled in. It measures presence, not accuracy; seed archive fields are not assessed. Follow-up coverage counts action records linked to a project with a self-reported follow-up on/after that action date. Such observations can occur outside the selected action-date period, and one project observation can cover multiple records. Every rate displays its numerator/denominator. No population adjustment, impact ranking, industry comparison or causal climate-impact claim is made.

**Share view** creates a URL containing only country/city, period, action type, language and view mode. It strips unrelated query/hash state; a manual-copy fallback handles clipboard denial. Recipients see their own browser's records under those filters, not the sender's local photos or projects. Hosted URLs are needed for sharing across devices. URL parameters include `map-city=Nairobi`, `map-from=2026-11-01`, `map-to=2026-11-15`, `map-action=afforest`, and `map-view=gallery` alongside the existing country/exact-date parameters.

**Download project summary** creates a local JSON report with action records, dates, evidence stages, numeric self-reported fields, observations, provenance and limitations. Names, project/community text, notes, string evidence fields, photo previews and precise device coordinates are excluded by default. Separate unchecked choices permit personal/free-text details, previews and explicitly attached device coordinates. Original photo bytes, EXIF and file hashes are always excluded. This summary is separate from the pre-existing detailed printable verification receipt.

Checks (with the static server running for browser suites):

```sh
node build/test-regional-tools.js
NODE_PATH="$PWD/work/test-tools/node_modules" node build/test-regional-browser.js
```

The new checks cover calendar boundaries, range/count parity, denominators, actual review/follow-up provenance, redaction, URL round trips, invalid-range feedback, replay lifecycle, regional selection, exact original bytes after offline draft restore/submission, opt-in location, framing, accessible comparison/acquisition selection, downloads, storage failures and English-only mobile layout. Existing data, forensics, pHash, QR, evidence, map and community checks remain applicable.

## One clear flow — submit → result → flags → receipt

The **提交验证 / Submit** tab provides the end-to-end evidence flow:

1. **Upload & claim** — drag-and-drop or file picker, live preview with file info (size / dimensions / type), claimed action type, location, optional submitter name, **submit-as toggle (individual / organisation) with an organisation picker** (choosing an org auto-fills its city; an **"Other"** option accepts a free-text org name → `org: 'custom:<name>'`, which becomes an *unregistered-organisation risk signal*), and an **action date** field (used by the action map's date replay). A **⚡ sample-photo button** generates a synthetic photo so the flow can be demoed with one click.
2. **Local heuristic checks** — animated pipeline: ingest & fingerprint → three on-device heuristic checks → duplicate detection → receipt. **Real client-side computation**: SHA-256 of the file, **pHash-DCT 64-bit perceptual fingerprint** (32×32 grayscale → hand-written 2-D DCT → low-freq 8×8 minus DC → median threshold), Laplacian noise variance (authenticity heuristic), HSV color-profile cosine similarity (action-match **color-prior heuristic**, labelled as such), **ELA error-level analysis** (JPEG q90 re-encode → per-pixel diff heatmap + high-error share), **hand-written JPEG APP1/TIFF EXIF parsing** (GPS, Make/Model, Software, DateTimeOriginal), and a **C2PA/XMP provenance scan** of the file bytes. Geolocation is a **haversine distance from EXIF GPS to the claimed city** when GPS exists; otherwise a clearly-labelled demo-derived score.
3. **Result & flags** — verdict banner (verified / pending / rejected / duplicate-flagged), composite score ring, sub-model bars, and a flags panel: `DUP_EXACT`, `DUP_PHASH`, `AUTH_SMOOTH`, `ACTION_MISMATCH`, `GEO_LOW` (or "✓ no flags"). Rule: **any flag blocks auto-approval** — duplicate → flagged, score < 60 → rejected, otherwise flags force human review.
4. **Receipt** — a printable verification receipt: submission ID, SHA-256 & pHash, claim details, pipeline checklist, model breakdown, and a status stamp. **🖨 Print** uses print CSS to output only the receipt.

Every submitted photo is registered into the live dataset: it appears in the Review Queue, updates the Overview KPIs, joins the Duplicates tab when flagged (submit the same file twice to see a real exact-hash interception, group G-06+), and can be handed to the evidence-check agent for an investigation. Session submissions persist in localStorage and survive reloads; the stored registry carries a hash-algorithm version marker, and entries from older algorithm versions are transparently rebuilt from their thumbnails on load instead of producing cross-version false matches.

## What Proof API does

Citizens and field teams — **as individuals or on behalf of an organisation** — submit **photos as evidence of climate actions** (afforestation, rooftop solar, wetland restoration, EV charging, coastal cleanup, building retrofit), grouped into two large categories: **Environmental (环境类)** and **Energy (能源类)**. Every submission goes through an automated pipeline:

```
Mobile submission → Ingestion → local heuristic checks → Duplicate detection → Agent evidence check → Publish result
```

The dashboard covers the four review dimensions from our brief — **photo submissions, verification scores, duplicate flags, results** — plus the evidence-check agent slot, and the v0.2 planning layer: **hierarchy analytics (org → city → country → global)**, a **global action map** with per-country project lists and date replay, and **action coverage gap analysis**.

## Information architecture

| Module | Purpose | Key interactions |
|---|---|---|
| **Home** | Community entry point | Credited photo, explore/submit/review actions, illustrative action gallery and local project drafts |
| **Evidence guides** | Action-specific planning and documentation | Six versioned English field guides, applicability/source notes and a project-starter wizard |
| **Project story** | Follow an explicit project or standalone record | Evidence timeline, repeat submissions, baseline/follow-up observations, source attribution and local human-review history |
| **Submit** | The end-to-end flow | Upload → animated verification → verdict + flags → forensics panel (ELA heatmap / EXIF / C2PA) → printable receipt; individual/organisation toggle + org picker with an **"Other — free-text name"** option; action date; one-click sample-photo demo; session submission history |
| **Overview** | Pipeline health & 14-day window | 5 KPIs, stacked daily volume by outcome, score histogram, action-type ranking (grouped by category), live feeds with org labels |
| **Review queue** | Core review workflow | Status/action filters, photo cards with composite ring + 3 sub-score bars and org chips, detail drawer, approve / reject (updates KPIs live), one-click dispatch to the agent |
| **Duplicates** | Duplicate groups & interception | 5 groups (exact hash / perceptual hash / crop-filter variants), side-by-side photo comparison with similarity meters & time gaps, confirm / mark-false-positive |
| **Analytics** | Model performance + planning layer | Hierarchy drill-down (global → country → city → org → submissions), **coverage-gap cards** ("X is active here but Y is under-served — suggest Y projects"), plus the v0.1 charts (throughput, per-type deviation, sub-model means, thresholds, auto-vs-human agreement) |
| **Action map** | Explore global and local community activity | Search or click to zoom into countries/cities; synchronized location/date filters, global overview, direct verification analytics, action list, date highlights, and verified coverage/opportunity cards; open the same scope in Analytics |
| **Agent** | Evidence cross-check agent | Pipeline diagram with the agent slot, conversational agent that runs a 4-step investigation (metadata → forensics with real ELA heatmap → geospatial → registry with real counts) and outputs a verdict with confidence and a citable evidence chain; unregistered orgs → `ORG_UNREGISTERED` → human review |
| **About** | Honesty layer & attribution | "What is actually computed" table (measured / heuristic / demo-rule labels), demo-data notice, privacy statement, QR code + repo link, full Wikimedia Commons photo attribution list |

### The planning layer (v0.2)

- **Hierarchy**: every submission carries an `org` (14 demo organisations: NGOs, companies, community groups) or is individual. Analytics drill from **global → country → city → organisation**, so a country coordinator sees exactly her city's org performance.
- **Gap analysis**: on **verified** projects only, per scope (global + countries with enough data), the engine flags (a) *category gaps* — e.g. Kenya: environmental 100% vs energy 0% → suggest EV charging — and (b) *within-category action gaps* — e.g. Kenya/Malaysia: afforestation/cleanup dominate while **wetland restoration is missing**. Cards carry a suggested action and share bars.
- The demo dataset is engineered (deterministically) so each country tells a story: Kenya & Malaysia over-serve coastal/environmental actions, Mumbai over-serves energy, China is fairly balanced.

## Verification model (demo rules, honestly labelled)

```
composite = authenticity × 40% + action-match × 35% + geolocation × 25%   (0–100)
```

Every score source is labelled in the UI (result page, drawer, About tab):

| Component | What it actually is | Label |
|---|---|---|
| authenticity | Laplacian noise-spectrum variance | noise spectrum · measured |
| action-match | HSV 6-bucket cosine similarity vs a hand-written color prior | **color prior · heuristic** |
| geolocation | haversine distance from EXIF GPS to the claimed city; demo-derived when no GPS | EXIF GPS · measured / demo-derived |
| ELA / EXIF / C2PA | real JPEG re-encode diff, real APP1/TIFF parse, real byte-stream provenance scan | measured |
| composite & verdict | threshold rules (demo) | demo rule |

- **≥ 85** auto-verified · **60–85** human review · **< 60** auto-rejected · any sub-model < 60 forces review
- Duplicate hits are flagged regardless of score (interception takes precedence).
- Unregistered organisations (`custom:<name>`) downgrade the agent verdict to human review (`ORG_UNREGISTERED`).
- Demo dataset: 66 submissions (2026-10-31 → 11-13), deterministic seed — 14 cities in 8 countries (China, Kenya, Indonesia, Colombia, Malaysia, India, Brazil, Nigeria), 14 organisations + individuals, 6 actions in 2 categories. 12 today, 11 pending, 66.7% auto-approved, 10.6% duplicate interception, avg score 85.1. Auto-vs-human agreement 94.4%.

## Carbon numbers (reference estimates, honestly labelled)

- Every submission carries an estimated **tCO2e** from a public factor table — IPCC 2019 Refinement (afforestation), IPCC 2013 Wetlands Supplement, MEE China 2023 grid factor × unit sizes (solar / retrofit), IEA passenger-car intensity (EV); cleanup is a high-uncertainty indirect estimate. The full table with sources and years lives in the **Analytics** tab.
- Overview shows **verified mitigation delivered (tCO2e)**; every intercepted duplicate group shows **what it would have paid out** (≈ tCO2e × the EU ETS reference price of €80/t).
- Every figure is labelled **"reference estimate · not issued credits"** — the prototype estimates scale; it does not mint credits.
- **Verification footprint**: default heuristic latency is measured per submission; the displayed energy figure is an estimate from duration × assumed 7 W × grid factor. It excludes optional CLIP and initial downloads. CLIP reports separate measured inference/load times. Neither photos nor NDVI certify mitigation, and no measured carbon saving or cloud-comparison ratio is claimed.
- **Calibration**: the Analytics tab bins composite scores (85–89 / 90–94 / 95–100) against auto-approvals with a demo human-agreement reference line — and states plainly that real calibration requires real review logs.

## Duplicate detection (3 channels, as shown in the demo)

1. **Exact hash** — identical file fingerprint, blocked outright (group G-01).
2. **Perceptual hash** (pHash-DCT 64-bit) — 32×32 grayscale → hand-written 2-D DCT → low-frequency 8×8 block (DC excluded) → median threshold; Hamming distance < 8 after compression/crop/filter (G-02, G-03).
3. **Visual embeddings** — deep-model cosine similarity ≥ 0.85 enters a review group (G-04, G-05).

Blocking resubmissions directly prevents **double carbon-credit issuance**, the main financial risk the dedupe layer guards against.

## The evidence-check agent — how it complements the workflow

The agent sits **between duplicate detection and result publishing**. The models answer "does the photo match the claim?"; the agent answers *"should we believe this submission?"* by pulling external evidence:

1. **Read metadata** — EXIF, GPS, SHA-256, claimed location
2. **Image forensics** — real ELA heatmap (shown inline), EXIF signals (Photoshop trace, capture-time vs claimed date, missing EXIF) and C2PA/XMP provenance; measured numbers drive the wording
3. **Geospatial cross-check** — EXIF GPS → haversine distance to the claimed city; honestly labelled as demo-derived when no GPS
4. **Registry comparison** — real dataset counts (same city + same action + same quarter), pHash index lookup, and an `ORG_UNREGISTERED` warning for custom organisations
5. **Verdict** — approve / reject / hold, with confidence % and a citable evidence chain (unregistered orgs are downgraded to human review)

In the prototype the agent is a deterministic rules engine wired to live dashboard state (same architecture as our ClimateOS assistant), so the full agent loop is demonstrable offline. It can be invoked from any submission detail panel ("Send to agent"), which deep-links into the agent tab and runs the investigation. The UI is deliberately structured as *step bubbles + tool-call chips + evidence*, which maps 1:1 onto a real agent trace later.

**Sketch of the real API contract (v0.2+)** — the UI is already organized around these boundaries:

```
POST   /submissions               photo + claim + geotag
GET    /submissions/:id           composite + sub-scores + status
GET    /submissions/:id/verdict   Agent investigation & evidence chain
GET    /duplicates?sim>=0.85      groups, similarity, originals
POST   /duplicates/:group/confirm | /dismiss
GET    /agents/investigate/:id   (streamed step events)
```

### The API boundary (`js/api.js`)

The entire UI consumes one function — `proofApiSubmit(payload)` — and one result shape. **When the real Proof API format arrives, only this file changes; the UI stays untouched.**

```js
// payload
{ file: File, action: 'solar'|'wetland'|…, city: 0-13,
  submitter: 'name', org: 'org-gbg'|'custom:<name>'|null,
  orgType: 'ngo'|'company'|'community'|'personal'|null,
  date: 'YYYY-MM-DD'|null }

// result
{
  ok: true,
  submission: { id, submitter, org, orgType, action, city, time, device,
                gpsOk, gps, hash, phash, width, height, size, mime, status,
                dup, forensics: { ela: { meanErr, highRatio, heatmap },
                                  exif: { hasExif, make, model, software,
                                          dateTime, dateTimeOriginal, gps },
                                  provenance: { c2pa, jumbf, xmp },
                                  locSource: 'exif-gps'|'demo', gpsKm } },
  verification: { score, subs: { auth, action, loc }, verdict,
                  flags: [{ code, level, msgKey, vars }] },
  receipt: { issuedAt }
}
```

If the real API is synchronous-ish (send → poll → result), the UI can stream the pipeline stages directly onto the same four stage rows; if it's asynchronous (webhook / long-poll), the stage animation waits for the server's events instead of local timers. Both fit the current `doSubmit()` structure without layout changes.

## Photo credits (attribution)

All demo photos are real photographs of climate actions, downloaded locally from **Wikimedia Commons** (public domain or CC-licensed, 800px thumbnails, stored in `assets/photos/`, re-fetchable via `node build/fetch-photos.js`). Full manifest: `build/photos-manifest.json`. **The full attribution list is also shown in the in-app About tab** (open the app → About → "Photo credits & licenses") — no one needs to open the README at a booth.

| File | Photo | Author | License |
|---|---|---|---|
| afforest-01 | Volunteers enjoy planting trees | Hillebrand Steve, U.S. Fish and Wildlife Service | Public domain |
| afforest-02 | Volunteer Tree Planting (120802-F-OS776-021) | Airman 1st Class Christopher Tam | Public domain |
| solar-01 | Rooftop solar panels in Caldicot | Jaggery (geograph.org.uk) | CC BY-SA 2.0 |
| solar-02 | Rooftop solar panels, Gwehelog | Jaggery (geograph.org.uk) | CC BY-SA 2.0 |
| wetland-01 | Wetland restoration in Australia | Nick carson | Public domain |
| wetland-02 | Wetland restoration, Wetlands Reserve Program Texas | USDA NRCS Texas | Public domain |
| ev-01 | Car2Go Charging Station Stuttgart | Julian Herzog | CC BY 4.0 |
| ev-02 | Pisa Enel X Charging Station | Daniele Napolitano | CC BY-SA 4.0 |
| cleanup-01 | Beaches cleanup volunteers | Olympic National Park | Public domain |
| cleanup-02 | Oregon beach cleanup volunteers | Ocean Blue Project | CC BY-SA 4.0 |
| retrofit-01 | Installing Insulation Batts (CSIRO ScienceImage 2175) | Tracey Nicholls, CSIRO | CC BY 3.0 |
| retrofit-02 | Installing Insulation & Roof Paneling | U.S. Navy / PO3 Matthew Noles | Public domain |

Source pages are linked in `build/photos-manifest.json`. Uploaded user photos (submit tab) are displayed via a locally generated 240px thumbnail; duplicate-group members render the base photo with a slight zoom + filter to simulate crop/filter re-uploads. The SVG scene generator (`js/photos.js`) remains as an offline fallback for submissions without a photo.

## License

**This repository is released under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)** (see `LICENSE`). The demo photos mix public-domain works and CC BY / CC BY-SA 2.0–4.0 images, and the duplicate groups render cropped/filtered derivatives of them; share-alike obligations therefore cover the demo media and their derivatives. Releasing the repository as a whole under CC BY-SA 4.0 satisfies every upstream license (CC BY 3.0 and CC BY 4.0 material may be adapted into CC BY-SA 4.0; CC BY-SA 2.0/4.0 matches directly; public-domain works remain in the public domain). Attribution for every photo stays in the table above and in the in-app About tab. The team-authored source code is original and may be relicensed (e.g. MIT) by the authors on request.

## Design system

- **Light theme** with shared forest-green surfaces, local line icons and quieter dashboard cards; status colors fixed to the accessible palette with icon+label pairing (color never carries meaning alone); categorical hues from a colorblind-safe validated palette (OKLab checks), single-hue ordinal ramps for rankings/histograms, hover tooltips, legends and table views.
- Bilingual zh/en via a full i18n dictionary (`?lang=en`), deterministic SVG "photos" (no real images needed for the demo; duplicate members render as slightly zoomed/shifted variants of the original — visually convincing crop/filter re-uploads).
- Zero dependencies, pure-function data model (validated by `build/test-data.js`), `node --check` syntax gate, `window.__fatal` red banner instead of white screens, `?v=` cache busting on every asset.

## Deliberately out of scope

Real backend / API, authentication & reviewer roles, a real LLM behind the rules agent, calibrated authenticity detection, and causal project-impact certification. User photos are processed locally; session thumbnails persist locally. CLIP is an optional real classifier, not an authenticity detector.

## Roadmap

- **v0.3** — API mock layer (static JSON or local server), reviewer roles, real agent loop behind the agent (step streaming from an LLM with tool calls), dark mode variant.
- Later — cross-checking with satellite/registry data partners, native mobile distribution, org-level admin views (org managers see only their submissions). Browser-based camera capture and offline drafts are implemented.

## File map

```
proof-api-dashboard/
  index.html           shell, boot guard, i18n entry
  css/style.css        white design system (tokens, components, responsive)
  js/data.js           pure data model: 66 submissions in 14 cities / 8 countries,
                       14 orgs, 2 action categories, dup groups, hierarchy rollups,
                       gap analysis, map stats (deterministic seed)
  js/map-data.js       embedded world map SVG paths (generated by build/build-map.js
                       from Natural Earth 110m, public domain; offline, no fetch)
  js/map-explorer.js   interactive map, shared location/date filters, analytics,
                       global/local action lists and coverage opportunities
  js/community-data.js versioned field guides, local project/observation records,
                       independent review stages and persistent review history
  js/experience.js     Home, galleries, project starters/stories, guide/review UI
  css/experience.css   community views, responsive galleries/dialogs/story pages
  css/field-tools.css  shared dashboard styling, dates, capture and regional UI
  js/insights.js       inclusive calendar periods, auditable regional measures,
                       redacted report data and filter-only URL serialization
  js/field-tools.js    shared local icons, date controls, wipe, share/export UI
  js/capture.js        explicit IndexedDB originals, framing and location controls
  js/regions.js        country/city comparison, shared filters and map drill-down
  js/photos.js         deterministic SVG photo-scene generator
  js/i18n.js           zh/en dictionary, t()/lb()
  js/charts.js         zero-dep SVG chart engine (light ink, validated ramps)
  js/api.js            API boundary: submit payload/result + local verification engine
                       (real SHA-256 / pHash / noise / color, demo scoring; swap for real API)
  js/app.js            tabs, submit flow, queue + drawer, duplicates, analytics
                       (hierarchy + gaps), action map, evidence-check agent
  build/build-map.js   map build: ne110m.geojson → js/map-data.js (Douglas-Peucker
                       simplify 0.05°, y-flip, Antarctica dropped; 110m keeps
                       first paint fast on phones)
  build/test-data.js   dataset invariant checks (node) — includes map cross-check
```
