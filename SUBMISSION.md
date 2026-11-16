# Submission: repository, source files, licensing and access

**Team P05 · Proof API — Climate Action Verification Dashboard (v0.2 interactive prototype)**

| Team field | Value |
| --- | --- |
| Team identifier | `P05` |
| Team members (for submission forms) | `gunnarcosmo`, `Roshan` |
| Corresponding author | `Hou guanyu (Gunnar Cosmo)` |

## 1. Repository and source files

| Item | Link |
| --- | --- |
| Public repository (all source, data and assets) | https://github.com/gunnarcosmo1123-oss/proof-api-dashboard |
| Live interactive prototype (GitHub Pages, built from `main:/`) | https://gunnarcosmo1123-oss.github.io/proof-api-dashboard/ |
| Application entry point | https://github.com/gunnarcosmo1123-oss/proof-api-dashboard/blob/main/index.html |
| Documentation / workflow | https://github.com/gunnarcosmo1123-oss/proof-api-dashboard/blob/main/README.md |
| Final deck and media | https://github.com/gunnarcosmo1123-oss/proof-api-dashboard/tree/main/deck |

Source layout: `index.html`, `js/` (18 modules), `css/` (3 stylesheets), `sw.js` + `manifest.webmanifest`, `assets/` (photos, NDVI observations, map geometry, pinned optional runtime), `build/` (12 self-test scripts plus reproducible fetch/build scripts), `deck/` (submission media). The app is a zero-dependency static site: no backend, no build step and no package manager.

## 2. Licensing

- **Repository licence: CC BY-SA 4.0** (`LICENSE`). Team-authored source code is original and may be relicensed by the authors on request. The share-alike term also covers the demo media and their cropped/filtered derivatives.
- **Demo photographs:** 12 Wikimedia Commons images — public domain, CC BY 3.0/4.0 and CC BY-SA 2.0/4.0. Full attribution (title, artist, licence, source page) appears in README "Photo credits", in the in-app About tab and in `build/photos-manifest.json`. Releasing the repository as a whole under CC BY-SA 4.0 satisfies every upstream licence.
- **Optional AI runtime (loaded only after an explicit opt-in, never bundled with the page):** Transformers.js 2.17.2 — Apache-2.0; ONNX Runtime Web 1.14.0 — MIT. Licences, third-party notices and a SHA-256-pinned `manifest.json` are in `assets/vendor/transformers/`. CLIP weights are **not shipped**: the opt-in button downloads the pinned MIT-licensed `Xenova/clip-vit-base-patch32` conversion (based on OpenAI CLIP) into the browser Cache API.
- **Reference data:** 15 real 2024 USGS Landsat 8–9 Collection 2 Level-2 observations (public domain, delivered via Microsoft Planetary Computer STAC), Natural Earth 110m geometry (public domain), and IPCC / IEA / MEE China reference factors cited in-app. All 66 submission records are synthetic demo data; no personal data is included.

## 3. Access restrictions

**None imposed by the team.** The repository is public and the prototype is a static site: no account, login, API key, token, payment or NDA is required, and no secrets are stored in the repository. There is no backend, no server-side inference and no telemetry. A standard internet connection is needed only to reach GitHub; once downloaded, the default workflow runs entirely offline from `file://`. Photos stay in the browser, and offline drafts live only in the reviewer's own IndexedDB.

The only network-dependent feature is the optional real-model button: a first run downloads roughly 150 MB of pinned CLIP weights from Hugging Face and needs a localhost/HTTPS origin for workers and the Cache API. Every default check — SHA-256, pHash-DCT, SSIM, green-pixel share, EXIF/C2PA scan, duplicate interception and the evidence chain — works without it.

## 4. Workflow documentation and exported files (no-code review path)

Although this is a coded prototype, reviewers who prefer not to run code can use:

- `README.md` — setup, the submit → result → flags → receipt workflow, verification model, limitations, tests, data sources and licence.
- `deck/ProofAPI_Demo_Final.pdf` — 16-slide PDF export; `deck/ProofAPI_Demo_Final.pptx` — editable deck with an embedded 82-second narrated walkthrough; `deck/ProofAPI_Demo.mp4` — standalone video; `deck/PITCH_3MIN.md` — 3-minute pitch script.
- The in-app **Download project summary** button exports a local JSON report with personally identifying fields excluded by default.
- `build/` — 7 pure-Node and 5 Chromium regression suites, with run instructions in README.

> A public open-source release is **not required** by the submission rules. We chose to publish this repository publicly so that reviewers can open every artefact without credentials. No part of the submission is behind an access restriction.
