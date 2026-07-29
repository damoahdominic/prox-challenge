import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  DOCS,
  getPageVisuals,
  getRawPages,
  searchManual,
  type DocId,
} from "../knowledge/load";
import { POLARITY_SETUP } from "../../../lib/manual-data";

const docEnum = z.enum(["owner-manual", "quick-start-guide", "selection-chart"]);

export const searchManualTool = createTool({
  id: "search-manual",
  description:
    "Keyword-search the Vulcan OmniPro 220 documentation (owner's manual, quick start guide, selection chart). Returns the most relevant pages with snippets. Use it to locate the exact page for a topic before quoting verbatim text or showing a visual.",
  inputSchema: z.object({
    query: z.string().describe("Search query, e.g. 'flux-cored polarity' or 'drive roll tension'"),
  }),
  outputSchema: z.object({
    hits: z.array(
      z.object({
        doc: docEnum,
        page: z.number(),
        score: z.number(),
        snippet: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => ({ hits: searchManual(inputData.query) }),
});

export const readManualPagesTool = createTool({
  id: "read-manual-pages",
  description:
    "Read the exact embedded text of specific pages of a document. Use after search-manual when you need verbatim wording (procedures, warnings, specs). The vision-captioned knowledge in your instructions already summarizes every page - use this for exact quotes.",
  inputSchema: z.object({
    doc: docEnum.describe("Document id"),
    pages: z
      .array(z.number().int().min(1))
      .max(6)
      .describe("Page numbers (1-based), max 6 per call"),
  }),
  execute: async (inputData) => ({
    pages: getRawPages(inputData.doc as DocId, inputData.pages),
  }),
});

export const showManualVisualTool = createTool({
  id: "show-manual-visual",
  description:
    "Show the user an actual visual from the manual: a full page render or a specific extracted figure (LCD screen, diagram, photo). ALWAYS use this when your answer references a diagram, LCD screen, chart, or photo from the manual - e.g. polarity screens, wiring schematic, weld diagnosis examples, front panel controls. Pick the page (and optionally a specific extracted image file) from the page data you know.",
  inputSchema: z.object({
    doc: docEnum,
    page: z.number().int().min(1).describe("Page number of the visual"),
    image: z
      .string()
      .optional()
      .describe(
        "Optional: exact extracted image file path (e.g. /manual/owner-manual/images/p30-x262.png) to show a single figure instead of the whole page",
      ),
    caption: z.string().describe("One-sentence caption explaining what the user is looking at"),
  }),
  execute: async (inputData) => {
    const visuals = getPageVisuals(inputData.doc as DocId, inputData.page);
    if (!visuals) return { found: false as const };
    if (inputData.image && !visuals.extractedImages.includes(inputData.image)) {
      // Requested figure doesn't exist (e.g. the diagram is vector art on the
      // page) - fall back to the full page render rather than failing.
      return {
        found: true as const,
        doc: inputData.doc,
        page: inputData.page,
        image: null,
        pageImage: visuals.pageImage,
        caption: `${inputData.caption} (full page - the figure is part of the page artwork)`,
      };
    }
    return {
      found: true as const,
      doc: inputData.doc,
      page: inputData.page,
      image: inputData.image ?? null,
      pageImage: visuals.pageImage,
      caption: inputData.caption,
    };
  },
});

export const renderArtifactTool = createTool({
  id: "render-artifact",
  description:
    "Render an interactive visual artifact for the user: diagrams, schematics, flowcharts, step-by-step walkthroughs, comparison layouts. You provide a complete self-contained HTML document (inline CSS/JS only, no external assets) which is rendered in a sandboxed panel next to your answer. Use this when something is easier to show than to say in words: which cable goes in which socket, a troubleshooting decision tree, an annotated control panel, a wiring path. Prefer clean SVG-based diagrams with labels. Keep it focused on answering the user's question.",
  inputSchema: z.object({
    title: z.string().describe("Short artifact title"),
    html: z
      .string()
      .describe(
        "Complete HTML document. Self-contained: inline <style>/<script> only, no external resources. Design for a ~640px wide dark-themed panel.",
      ),
  }),
  execute: async (inputData) => ({ title: inputData.title, html: inputData.html }),
});

export const dutyCycleCalculatorTool = createTool({
  id: "duty-cycle-calculator",
  description:
    "Open the interactive duty cycle calculator for the user, prefilled with the process / input voltage / amperage you are discussing. It uses the exact rating-plate data from the manual and shows weld vs rest minutes in the 10-minute window. Use whenever duty cycle or 'how long can I weld' comes up.",
  inputSchema: z.object({
    process: z.enum(["MIG", "Stick", "TIG"]),
    inputVoltage: z.union([z.literal(120), z.literal(240)]),
    amperage: z.number().optional().describe("Amperage to prefill, if known"),
  }),
  execute: async (inputData) => inputData,
});

export const setupConfiguratorTool = createTool({
  id: "setup-configurator",
  description:
    "Open the interactive setup configurator: given a welding process (and optionally material/thickness), it walks the user through the exact cable polarity, gas hookup, and LCD settings sequence from the manual. Use for setup questions ('how do I set up for TIG', 'what do I plug in where').",
  inputSchema: z.object({
    process: z.enum(["MIG", "Flux-Cored", "TIG", "Stick", "Spool Gun (MIG aluminum)"]),
    material: z.string().optional().describe("e.g. mild steel, stainless, aluminum"),
    thickness: z.string().optional().describe("e.g. 16 Ga, 1/8 in"),
  }),
  execute: async (inputData) => ({
    ...inputData,
    polarity: POLARITY_SETUP[inputData.process],
  }),
});

export const vulcanTools = {
  "search-manual": searchManualTool,
  "read-manual-pages": readManualPagesTool,
  "show-manual-visual": showManualVisualTool,
  "render-artifact": renderArtifactTool,
  "duty-cycle-calculator": dutyCycleCalculatorTool,
  "setup-configurator": setupConfiguratorTool,
};

export const DOC_LIST_TEXT = DOCS.map((d) => `- "${d.id}": ${d.title}`).join("\n");
