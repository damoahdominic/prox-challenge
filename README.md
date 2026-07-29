# Vulcan Expert — Prox Founding Engineer Challenge

A multimodal reasoning agent for the **Vulcan OmniPro 220** multiprocess welder (Harbor Freight item 57812). It answers deep technical questions from the 48-page owner's manual, quick start guide, and welder selection chart — and it answers *visually*: it surfaces the actual manual figures, draws diagrams on the fly as interactive artifacts, and opens purpose-built interactive tools (duty cycle calculator, setup configurator) right in the chat.

Built with **Mastra** (agent orchestration) + **assistant-ui** (chat frontend) + the Anthropic Claude API.

## Run it (2 minutes)

```bash
git clone <this-repo>
cd prox-submission
cp .env.example .env.local   # plug in your Anthropic API key
npm install
npm run dev                  # http://localhost:3000
```

No other setup. The extracted knowledge base (text, page renders, figures) is committed to the repo — no Python, no build step, no database required.

> `.env.local` takes `ANTHROPIC_API_KEY` (direct, preferred). If absent, the agent falls back to `OPENROUTER_API_KEY` running the same Claude model (`anthropic/claude-sonnet-4.5`) via OpenRouter — handy for development.

> Note: the repo's dev server will pick another port automatically if 3000 is busy.

## What it does

Ask it things like:

- *"What's the duty cycle for MIG welding at 200A on 240V?"* → exact rating-plate answer (25%: 2.5 min weld / 7.5 min rest) plus an **interactive duty cycle calculator** prefilled with those values, with exact-vs-interpolated labeling (IEC 60974 I²·X interpolation between rating-plate anchors).
- *"What polarity setup do I need for TIG? Which socket does the ground clamp go in?"* → the answer (ground clamp **POSITIVE**, torch **NEGATIVE**, DCEN), the **actual LCD polarity screen** from the manual, a **generated SVG hookup diagram**, and the **interactive setup configurator**.
- *"I'm getting porosity in my flux-cored welds. What should I check?"* → the manual's cause/solution list (p. 37), aware that flux-cored is gasless (it won't waste your time blaming shielding gas for FCAW), with the weld diagnosis visuals from the manual.
- *"What polarity do I need?"* (ambiguous) → a short clarifying question **plus** the full 4-process polarity matrix so you learn something immediately.

## How it works

```
app/                        Next.js 16 frontend (assistant-ui)
  api/chat/route.ts         handleChatStream (Mastra → AI SDK UI stream → assistant-ui)
components/assistant-ui/    Chat UI + 4 custom generative-UI tool renderers
lib/manual-data.ts          Rating-plate duty cycle data + polarity matrix (verbatim from manual)
src/mastra/
  agents/vulcan-agent.ts    Agent definition + system prompt (full knowledge base inlined)
  tools/vulcan-tools.ts     6 tools (search, read, show visual, artifact, calculator, configurator)
  knowledge/
    captions/*.md           Vision-read transcription of all 51 pages (the core asset)
    *.json                  Raw embedded PDF text per page
scripts/extract_manual.py   PDF → text + page renders + embedded figures
scripts/eval-agent.ts       10-question tough eval suite (npx tsx --env-file=.env.local scripts/eval-agent.ts --suite)
public/manual/              51 page renders + 103 extracted figures, served statically
```

### Knowledge extraction (the part we think is special)

The manual's most important information lives in **images**: the polarity/gas LCD screens, the wiring schematic, the weld diagnosis photos, the duty cycle clock charts, the selection chart (a single-page infographic whose text layer is *empty*). A text-only RAG pipeline would be blind to all of it.

So the pipeline is two-layer:

1. **`scripts/extract_manual.py`** (PyMuPDF) — pulls the embedded text of every page, renders all 51 pages to PNG at 150 dpi, and extracts 103 embedded figures (deduped by xref, icons filtered out). Everything is committed, so evaluators don't need Python.
2. **A vision captioning pass** — every page render was read by a vision model and transcribed into `src/mastra/knowledge/captions/`: **every table verbatim** (duty cycle matrices, troubleshooting matrices, parts list, selection matrix), **every diagram and LCD screen described label-by-label** (including which socket the ground clamp cable is drawn plugged into), and a list of load-bearing facts per page. ~31k tokens of dense, verified knowledge.

The full caption corpus is injected into the agent's system prompt. That is a deliberate trade: ~31k tokens of context per request in exchange for *zero retrieval failure modes* on cross-referencing questions (e.g. duty-cycle questions that span pp. 19/25/29). Raw page text remains available via tools for verbatim quotes.

### The agent (Mastra)

`vulcanAgent` (`src/mastra/agents/vulcan-agent.ts`) — Claude Sonnet 4.5 with six tools:

| Tool | Kind | Purpose |
|---|---|---|
| `search-manual` | knowledge | keyword search over captions + raw text → page hits |
| `read-manual-pages` | knowledge | verbatim embedded text of up to 6 pages |
| `show-manual-visual` | generative UI | renders the actual page/figure from the manual in chat |
| `render-artifact` | generative UI | agent-authored self-contained HTML/SVG diagrams in a sandboxed iframe (Claude-artifacts-style) |
| `duty-cycle-calculator` | generative UI | interactive calculator on exact rating-plate data |
| `setup-configurator` | generative UI | interactive 4-step setup walkthrough (polarity → gas → LCD → safety) |

Behavior is driven by the system prompt: garage-user tone, lead-with-the-answer structure, strict grounding ("never invent specs — say when the manual doesn't cover it"), page citations, aggressive use of visuals, and a clarify-but-still-teach policy for ambiguous questions.

### Multimodal responses

Three tiers, in increasing order of ambition:

1. **Surface the real thing** — `show-manual-visual` displays the actual figure from the manual (the polarity screens, the warning-screen fault table, the TIG torch assembly, the stick-weld diagnosis photos).
2. **Draw it live** — `render-artifact` lets the agent write a complete HTML/SVG document that renders in a sandboxed, pop-out-able panel: cable hookup diagrams, troubleshooting flowcharts, annotated walkthroughs. This is the "reverse-engineered Claude artifacts" tier.
3. **Purpose-built interactives** — the duty cycle calculator and setup configurator are hand-built React components backed by data transcribed verbatim from the rating plate and quick start guide (`lib/manual-data.ts`), so the numbers the user plays with are guaranteed correct, not model-generated.

## Design decisions worth noting

- **Whole-corpus system prompt instead of vector RAG.** The corpus is small enough (~31k tokens) and the challenge explicitly tests cross-referencing. Retrieval is kept as a tool for verbatim text and page location, but the agent can always see everything it needs. With Anthropic prompt caching the repeated prefix is cheap.
- **Exact data in code, not in the model.** Duty cycle interpolation and the polarity matrix live in `lib/manual-data.ts` and are unit-tested (`scripts/unit-test.ts`). The model decides *when* to open the calculator; the component decides the math.
- **Grounding over fluency.** The agent is instructed to say "the manual doesn't cover that" — e.g. asked about a *different* welder model, it declines to invent specs (covered in the eval suite).
- **Tool UIs render standalone**, not collapsed in a "used N tools" group, because they ARE the answer.

## Testing

- `scripts/unit-test.ts` — duty cycle anchors (all 7 rating-plate points), interpolation bounds, out-of-range detection, search relevance. All passing.
- `scripts/eval-agent.ts --suite` — 10 tough questions with expected-answer rubrics: cross-referencing (duty cycle across voltages), visual-only knowledge (selection chart, aluminum/AC-TIG nuance), ambiguity handling, misconception correction (stick polarity with 7018), and hallucination resistance (out-of-scope product). **Full transcripts with grading: [`docs/eval-results.md`](docs/eval-results.md). 10/10 pass** (two answers were re-run and pass after a one-line instruction tightening). See `REPORT.md` for the criterion-by-criterion assessment.

## Known limits / next steps

- No voice I/O yet — the architecture (assistant-ui attachments + Mastra voice) supports adding it.
- The settings configurator deliberately does **not** invent wire-speed/voltage numbers: the machine's settings chart is a sticker inside the welder door and is not reproduced in the manual. The configurator walks the documented LCD sequence instead.
- Thread persistence is client-side; adding Mastra Memory + a store would enable resumable sessions.
