# Proof API — 3-minute pitch (with live demo)

Team P05 · v0.2 · English-only prototype · final timing TBC by the organisers.
Full deck: `ProofAPI_Demo_Final.pptx` (16 slides, speaker notes on every new slide).
Live prototype: https://gunnarcosmo1123-oss.github.io/proof-api-dashboard/
Embedded backup video: `ProofAPI_Demo.mp4` (~82 s, H.264, English voiceover; also embedded on slide 16).

## Timing

| Time | Slide(s) | Beat | Action |
| --- | --- | --- | --- |
| 0:00–0:25 | 1–2, 13 | Problem + users | "A photo proves something happened, not that it worked." Name the three user groups. |
| 0:25–1:00 | 3–5, 14 | Solution + AI stack | One submission → four stages. Default checks are deterministic; CLIP is opt-in and on-device. |
| 1:00–1:35 | 6–7, 8 | Real evidence | Duplicate interception, paired before/after, 15 STAC-traceable Landsat NDVI observations. |
| 1:35–2:25 | 4, 9–12, 16 | **Live demo** | Switch to the browser: `?tour=1` or the scripted submit / duplicate / map flow. |
| 2:25–3:00 | 10, 15 | Honesty + next steps | "Accepted", not certified. Limits, 12 passing test suites, field pilot next. |

## Script (spoken, ~180 words)

"Grassroots climate action is growing, but its records are not verifiable. A single photo proves an
activity happened — not that it worked. Community groups and volunteers need a receipt they can trust;
reviewers and funders need to spot the same action submitted twice, without flying to every site.

Proof API is a zero-dependency, offline-capable verification dashboard. Each photo is fingerprinted,
de-duplicated and compared before and after, entirely in the browser. The default checks are classical,
explainable algorithms; an optional pinned CLIP model adds a semantic cross-check, and nothing is uploaded.
Real 2024 Landsat NDVI observations and a global Action Map put each claim in context.

Watch: one scripted submission produces a SHA-256 receipt and a score breakdown; resubmitting the same
photo is blocked as a duplicate. A national filter, a region comparison and an evidence-check agent all
read the same local dataset.

We deliberately call the result 'Accepted', never certified. Scores are heuristics, NDVI is a single
30-metre pixel, and there is no backend or real LLM behind the agent yet. Twelve automated test suites
cover the full flow, keyboard access and mobile layout. Next: calibrate on real review logs, add reviewer
roles, and run a field pilot with community groups."

## Live demo fallback (if the network fails)

1. Keep the downloadable repository ZIP / `ProofAPI_Demo.mp4` open before the session.
2. Play the embedded clip on slide 16 (~82 s, narrated in English) or the local MP4 in any player.
3. If demonstrating from source: double-click `index.html` — all default features work from `file://`;
   only the optional CLIP model and geolocation need localhost/HTTPS.

## Hard constraints to respect while presenting

- Do not claim measured carbon savings, issued credits, calibrated authenticity detection or causal impact.
- Do not describe CLIP as an AI-generated-image detector.
- State that all submission records are simulated demo data; photos are credited Wikimedia Commons material.
- No API keys, accounts or secrets are needed to access the prototype.
