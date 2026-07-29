import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import type { UIMessageChunk } from "ai";
import { mastra } from "@/src/mastra";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const params = await req.json();
  const stream = await handleChatStream({
    mastra,
    agentId: "vulcan-agent",
    params,
  });
  return createUIMessageStreamResponse({
    // Mastra emits the AI SDK v5 UI-message stream protocol; the chunk wire
    // format is compatible with the v7 response helper used by the frontend.
    stream: stream as unknown as ReadableStream<UIMessageChunk>,
  });
}
