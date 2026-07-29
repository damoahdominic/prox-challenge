/**
 * Smoke test / eval harness for the Vulcan agent (no Next.js needed).
 * Usage: npx tsx --env-file=.env.local scripts/eval-agent.ts "question here"
 *    or: npx tsx --env-file=.env.local scripts/eval-agent.ts --suite
 */
import { vulcanAgent } from "../src/mastra/agents/vulcan-agent";

const SUITE: { id: string; q: string; expect: string }[] = [
  {
    id: "duty-cycle-cross-ref",
    q: "What's the duty cycle for MIG welding at 200A on 240V? And how does that change if I only have a 120V outlet in my garage?",
    expect:
      "25% @ 200A on 240V (2.5 min weld / 7.5 min rest); on 120V max MIG output is 140A so 200A is impossible; 120V rating is 40% @ 100A",
  },
  {
    id: "polarity-tig",
    q: "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?",
    expect: "Ground clamp POSITIVE (+), TIG torch NEGATIVE (-), DCEN, 100% Argon; p.24",
  },
  {
    id: "porosity-fluxcore",
    q: "I'm getting porosity in my flux-cored welds. What should I check?",
    expect:
      "Flux-cored porosity causes from p.37: incorrect polarity (FCAW = DCEN, ground POSITIVE), dirty workpiece/wire, inconsistent travel speed, CTWD too long; must NOT blame shielding gas (flux-cored is gasless)",
  },
  {
    id: "ambiguous-polarity",
    q: "What polarity do I need?",
    expect: "Should ask which process AND/OR give the 4-process polarity matrix",
  },
  {
    id: "visual-only-selection",
    q: "I want to weld aluminum. Can this machine do it and what do I need?",
    expect:
      "MIG aluminum requires optional spool gun + 100% Ar; TIG aluminum requires AC TIG (this machine is DC TIG for steel/stainless - selection chart says AC TIG required for aluminum); thickness ranges",
  },
  {
    id: "duty-cycle-tig-120",
    q: "How long can I TIG weld at 125 amps on a regular wall outlet before it overheats?",
    expect: "120VAC TIG: 40% @ 125A = 4 min weld / 6 min rest per 10 min (p.29)",
  },
  {
    id: "wire-tension",
    q: "The wire keeps birdnesting on me. How do I set the drive tension correctly?",
    expect:
      "Feed wire against wood from 2-3 inches; tighten tensioner clockwise incrementally until wire bends from feed pressure; <3s checks because wire stops feeding without arc (p.17)",
  },
  {
    id: "settings-configurator",
    q: "Walk me through setting up for MIG on thin sheet metal for an auto body patch.",
    expect:
      "Should invoke setup-configurator and/or render steps: MIG polarity (ground NEG, wire feed POS), C25 gas 20-30 SCFH, thin material = MIG advantage, push angle 0-15deg, CTWD <= 1/2in",
  },
  {
    id: "stick-polarity-nuance",
    q: "I'm stick welding with 7018. The arc is unstable and there's porosity. Ground clamp is in the positive socket - is that right?",
    expect:
      "Manual default stick: ground NEGATIVE, electrode holder POSITIVE (DCEP); the LCD shows an 'OR' alternative per electrode manufacturer; porosity causes p.40 (dirty workpiece/electrode, inconsistent speed)",
  },
  {
    id: "out-of-scope",
    q: "What's the maximum amperage of the Vulcan MIG 140?",
    expect:
      "Should NOT hallucinate specs of a different product; should say it only covers the OmniPro 220 (MIG max 220A @ 240V / 140A @ 120V)",
  },
];

async function ask(q: string) {
  const result = await vulcanAgent.stream(
    [{ role: "user" as const, content: q }],
    { maxSteps: 8 },
  );
  let text = "";
  const toolCalls: { tool: string; input: unknown }[] = [];
  for await (const chunk of result.fullStream) {
    if (chunk.type === "text-delta") text += chunk.payload.text;
    if (chunk.type === "tool-call")
      toolCalls.push({ tool: chunk.payload.toolName, input: chunk.payload.args });
  }
  return { text, toolCalls };
}

async function main() {
  const arg = process.argv.slice(2);
  if (arg[0] === "--suite") {
    const only = arg[1] ? arg[1].split(",") : null;
    for (const t of SUITE) {
      if (only && !only.includes(t.id)) continue;
      console.log(`\n${"=".repeat(80)}\n[${t.id}] ${t.q}\n${"-".repeat(80)}`);
      try {
        const { text, toolCalls } = await ask(t.q);
        console.log(`TOOLS: ${toolCalls.map((c) => c.tool).join(", ") || "(none)"}`);
        console.log(`ANSWER:\n${text}`);
        console.log(`EXPECT: ${t.expect}`);
      } catch (e) {
        console.log(`ERROR: ${e instanceof Error ? e.message : e}`);
      }
    }
    return;
  }
  const q = arg.join(" ");
  if (!q) {
    console.error("Usage: eval-agent.ts <question> | --suite [ids]");
    process.exit(1);
  }
  const { text, toolCalls } = await ask(q);
  console.log(`TOOLS: ${toolCalls.map((c) => c.tool).join(", ") || "(none)"}`);
  for (const c of toolCalls) {
    console.log(`  [${c.tool}] ${JSON.stringify(c.input).slice(0, 400)}`);
  }
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
