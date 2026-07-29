import fs from "node:fs";
import path from "node:path";

/**
 * Knowledge base loader.
 *
 * The knowledge base has two layers, both produced by the extraction pipeline
 * (scripts/extract_manual.py + a vision captioning pass over every page render):
 *
 * 1. Captions (src/mastra/knowledge/captions/*.md) - a vision-read transcription
 *    of every page of all three documents: every table verbatim, every diagram
 *    and LCD screen described, every key fact listed. This is the agent's
 *    primary knowledge and is injected into the system prompt in full.
 *
 * 2. Raw text (src/mastra/knowledge/<doc>.json) - the PDF's embedded text per
 *    page, used by the readManualPages/searchManual tools for verbatim quotes.
 */

export type DocId = "owner-manual" | "quick-start-guide" | "selection-chart";

export const DOCS: { id: DocId; title: string; pageCount: number }[] = [
  { id: "owner-manual", title: "Owner's Manual (48 pages)", pageCount: 48 },
  { id: "quick-start-guide", title: "Quick Start Guide (2 pages)", pageCount: 2 },
  { id: "selection-chart", title: "Welder Selection Chart (1 page)", pageCount: 1 },
];

const KNOWLEDGE_DIR = path.join(process.cwd(), "src", "mastra", "knowledge");

interface RawPage {
  page: number;
  text: string;
  pageImage: string;
  images: { file: string; width: number; height: number }[];
}

interface RawDoc {
  doc: DocId;
  pageCount: number;
  pages: RawPage[];
}

const rawDocs = new Map<DocId, RawDoc>();
for (const doc of DOCS) {
  const file = path.join(KNOWLEDGE_DIR, `${doc.id}.json`);
  rawDocs.set(doc.id, JSON.parse(fs.readFileSync(file, "utf8")));
}

// ---- Captions, split into per-page blocks ----

const DOC_HEADER_MAP: [RegExp, DocId][] = [
  [/owner manual/i, "owner-manual"],
  [/quick start guide/i, "quick-start-guide"],
  [/selection chart/i, "selection-chart"],
];

export interface PageBlock {
  doc: DocId;
  page: number;
  heading: string;
  body: string;
}

function loadCaptionBlocks(): PageBlock[] {
  const captionsDir = path.join(KNOWLEDGE_DIR, "captions");
  const blocks: PageBlock[] = [];
  for (const file of fs.readdirSync(captionsDir).sort()) {
    if (!file.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(captionsDir, file), "utf8");
    // Split on "## <Doc-ish> Page N" headers.
    const re = /^##\s+(.+?)\s+Page\s+(\d+)\s*$/gim;
    const matches = [...text.matchAll(re)];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const docLabel = matches[i][1];
      const doc = DOC_HEADER_MAP.find(([re]) => re.test(docLabel))?.[1];
      if (!doc) continue;
      blocks.push({
        doc,
        page: parseInt(matches[i][2], 10),
        heading: matches[i][0].replace(/^##\s+/, ""),
        body: text.slice(start, end).trim(),
      });
    }
  }
  return blocks;
}

const captionBlocks = loadCaptionBlocks();

/** Full captions corpus - injected into the system prompt. */
export const CAPTIONS_CORPUS: string = DOCS.map((doc) => {
  const blocks = captionBlocks
    .filter((b) => b.doc === doc.id)
    .sort((a, b) => a.page - b.page);
  return `# DOCUMENT: ${doc.title} (doc id: "${doc.id}")\n\n${blocks
    .map((b) => b.body)
    .join("\n\n---\n\n")}`;
}).join("\n\n");

// ---- Tools' data access ----

export function getRawPages(doc: DocId, pages: number[]) {
  const raw = rawDocs.get(doc);
  if (!raw) throw new Error(`Unknown doc: ${doc}`);
  return pages
    .filter((p) => p >= 1 && p <= raw.pageCount)
    .map((p) => {
      const page = raw.pages[p - 1];
      return {
        doc,
        page: p,
        text: page?.text ?? "",
        pageImage: page?.pageImage,
        extractedImages: page?.images.map((i) => i.file) ?? [],
      };
    });
}

export function getPageVisuals(doc: DocId, page: number) {
  const raw = rawDocs.get(doc);
  if (!raw || page < 1 || page > raw.pageCount) return null;
  const p = raw.pages[page - 1];
  return {
    pageImage: p.pageImage,
    extractedImages: p.images.map((i) => i.file),
  };
}

const STOPWORDS = new Set(
  "the a an and or of to in for on at is are was were be been with without what which how do does can i my me it its this that when why should would could".split(
    " ",
  ),
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9./-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface SearchHit {
  doc: DocId;
  page: number;
  score: number;
  snippet: string;
}

/** Lightweight keyword search over captions + raw page text. */
export function searchManual(query: string, limit = 6): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];

  for (const block of captionBlocks) {
    const raw = rawDocs.get(block.doc)?.pages[block.page - 1];
    const haystack = `${block.body}\n${raw?.text ?? ""}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const occurrences = haystack.split(term).length - 1;
      if (occurrences > 0) score += occurrences * (term.length > 4 ? 2 : 1);
    }
    if (score > 0) {
      // Snippet: first ~240 chars of the caption body after the header line.
      const snippet = block.body
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("## "))
        .join(" ")
        .slice(0, 280);
      hits.push({ doc: block.doc, page: block.page, score, snippet });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
