import { Mastra } from "@mastra/core/mastra";
import { vulcanAgent } from "./agents/vulcan-agent";

export const mastra = new Mastra({
  agents: { "vulcan-agent": vulcanAgent },
});
