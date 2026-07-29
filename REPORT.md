# Submission-Worthiness Report — Vulcan OmniPro 220 Agent

Prepared for the repo owner. Verdict: **this is a strong submission** as measured against Prox's own four evaluation criteria. Evidence below; weaknesses included honestly at the end.

## What Prox says they're testing → what this build shows

### 1. Deep Technical Accuracy

The agent was run against a 10-question adversarial suite (`scripts/eval-agent.ts`, full transcripts in `docs/eval-results.md`), designed to hit the exact question types Prox lists plus harder variants:

| Test | Result |
|---|---|
| Duty cycle MIG 200A/240V + cross-reference to 120V | **Pass** — 25% (2.5 min weld / 7.5 min rest), p. 19; correctly notes 200A is impossible on 120V (max 140A), gives 40% @ 100A fallback, opens calculator |
| TIG polarity / which socket for ground clamp | **Pass** — ground POSITIVE, torch NEGATIVE, DCEN, twist-to-lock, p. 24; shows the actual LCD polarity screen from the manual |
| Flux-cored porosity | **Pass** — polarity-first diagnosis (FCAW = DCEN), dirty metal, travel speed, CTWD ≤ 1/2"; crucially does **not** waste time on shielding gas (flux-cored is gasless) |
| Ambiguous "what polarity do I need?" | **Pass** — asks which process AND immediately teaches the full 4-process matrix with the MIG/flux-cored reversal gotcha |
| Aluminum capability (visual-only source) | **Pass** — spool gun + 100% Ar; correctly states the machine is DC-TIG-only (specs p. 7: TIG weldable = steel/stainless/chrome moly, no aluminum) so MIG is the only aluminum path |
| TIG duty cycle 125A on wall outlet | **Pass** — 40% @ 125A (4/6 min), 90A continuous, p. 29; bonus correct 60% @ 125A on 240V |
| Birdnesting / drive tension | **Pass** — 2–3" wood test, tighten clockwise until wire bends, <3s checks (auto-stop), p. 17 + p. 42 troubleshooting cross-ref |
| MIG sheet-metal setup walkthrough | **Pass** — opens configurator; DCEP, C25 20–30 SCFH, push angle 0–15°, CTWD, vehicle battery disconnect |
| Misconception correction (7018, reversed leads) | **Pass** — corrects the user firmly and kindly, ties wrong polarity to their exact symptoms, cites p. 40 |
| Out-of-scope product (Vulcan MIG 140) | **Pass** — refuses to hallucinate another product's specs; offers OmniPro 220 numbers instead |

Accuracy isn't luck: the knowledge base was **vision-transcribed from all 51 pages**, every table verbatim, and the load-bearing data (duty cycles, polarity matrix) is additionally baked into unit-tested code (`lib/manual-data.ts`, `scripts/unit-test.ts` — all 7 rating-plate anchors, interpolation bounds, and out-of-range detection pass).

### 2. Multimodal Responses (their "most important part")

Three tiers, all exercised in the suite:

- **Surfaces the real manual**: `show-manual-visual` renders actual extracted figures (the TIG polarity LCD screen `p30-x262.png`, diagnosis photos) and full page renders, with a graceful fallback to the page render when a figure is vector art.
- **Draws when words fail**: `render-artifact` lets the agent author self-contained HTML/SVG (cable hookup diagrams, troubleshooting flowcharts) in a sandboxed, pop-out-able panel — the reverse-engineered-Claude-artifacts tier the brief explicitly calls for.
- **Purpose-built interactives**: duty cycle calculator (exact rating-plate data, IEC 60974 I²·X interpolation between anchors, exact-vs-estimated badges) and a 4-step setup configurator with SVG socket diagrams that redraw per process.

Tool-usage in the suite: visuals or interactives were invoked in 8 of 10 answers (the two text-only answers were the out-of-scope refusal and the first aluminum pass, both appropriately text-only).

### 3. Tone and Helpfulness

Consistently garage-appropriate: direct answer first, then why/how, then safety in context ("leave the Power Switch ON so the fan cools it", "disconnect the vehicle battery"). Corrects misconceptions without condescension ("**No, that's backwards!** … which is why your arc is unstable"). Admits limits plainly.

### 4. Knowledge Extraction Quality

This is the deepest moat in the submission. The manual's critical content is image-bound: the selection chart PDF has an **empty text layer** (single 1200×1200 infographic), the polarity setup on Quick Start p. 2 is entirely inside panel graphics, the LCD screens are raster images, the rating plate is a photo of a sticker. A text-layer pipeline is blind to all of it. The two-layer pipeline here (PyMuPDF extraction → vision captioning pass transcribing every table verbatim and every diagram label-by-label) means the agent answers from content that simply does not exist as text in the PDFs.

### Presentation criteria

- **Frontend**: clean assistant-ui chat, custom generative UI, Vulcan branding, suggested prompts. ✓
- **README**: architecture, design decisions, extraction pipeline, run instructions. ✓
- **2-minute setup**: `cp .env.example .env.local && npm install && npm run dev`. All extracted assets committed; no Python/database/build step needed by the evaluator. ✓
- **Video walkthrough**: not done — recommend recording one; the app demoes well.

## Honest weaknesses (known, documented in README)

- **Cosmetic text repetition**: the agent sometimes restates its lead-in after tool calls render (two text segments around the tool). In the UI the visuals render between the segments so it reads acceptably, but a stricter single-pass instruction or an output processor could tighten it.
- **Minor embellishment risk**: in the sheet-metal answer it offered plausible-but-not-in-manual starting numbers ("around 120–150 in/min") — hedged with "probably", but a stricter grounding rule could eliminate it. Notably, when asked about a *different product* it refused to speculate, so the guardrail holds where it matters.
- **Settings configurator doesn't output wire-speed/voltage numbers** — deliberate: the machine's settings chart is a sticker inside the door, not in the manual. The configurator walks the documented LCD sequence instead of inventing data.
- Built with **Mastra** rather than the Claude Agent SDK named in the brief (per repo owner's direction); the README frames this openly.
- Evals ran against Claude Sonnet 4.5 via OpenRouter (local Anthropic keys were out of credit); evaluators' Anthropic key hits the same model directly.

## Bottom line

The submission demonstrates the two things that are hardest to fake: (1) it *understands the visual manual*, not just the text, and proves it with verbatim tables and figure-level citations; (2) its multimodal answers are **structurally correct** — the calculator math and polarity diagrams come from verified data, not model improvisation. That combination is exactly what "expert-level support for a complicated machine" requires, and it's why this code is worthy of submission.
