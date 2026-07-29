import { estimateDutyCycle } from "../lib/manual-data";
import { searchManual, getRawPages, CAPTIONS_CORPUS } from "../src/mastra/knowledge/load";

// Duty cycle anchor checks
const cases: [any, any, number, number][] = [
  ["MIG", 240, 200, 25], ["MIG", 240, 115, 100], ["MIG", 120, 100, 40],
  ["TIG", 240, 175, 30], ["TIG", 120, 125, 40], ["Stick", 240, 175, 25], ["Stick", 120, 80, 40],
];
for (const [p, v, a, want] of cases) {
  const e = estimateDutyCycle(p, v, a)!;
  console.log(`${p} ${v}V ${a}A -> ${e.duty}% (want ${want}) ${e.duty === want ? "OK" : "FAIL"} interp=${e.interpolated}`);
}
// Interpolation sanity: MIG 240V 160A should be between 25% and 60%
const mid = estimateDutyCycle("MIG", 240, 160)!;
console.log(`MIG 240V 160A -> ${mid.duty}% (expect 25<x<60, interpolated) ${mid.duty > 25 && mid.duty < 60 && mid.interpolated ? "OK" : "FAIL"}`);
// Below continuous threshold
const low = estimateDutyCycle("MIG", 240, 100)!;
console.log(`MIG 240V 100A -> ${low.duty}% (expect 100) ${low.duty === 100 ? "OK" : "FAIL"}`);
// Out of range
const oob = estimateDutyCycle("MIG", 120, 200)!;
console.log(`MIG 120V 200A -> inRange=${oob.inRange} (expect false) ${!oob.inRange ? "OK" : "FAIL"}`);

// Search checks
for (const q of ["flux-cored porosity", "TIG polarity ground clamp", "drive tension", "duty cycle", "spool gun"]) {
  const hits = searchManual(q, 3);
  console.log(`search "${q}" -> ${hits.map(h => `${h.doc} p${h.page}`).join(", ")}`);
}
console.log(`captions corpus: ${CAPTIONS_CORPUS.length} chars (~${Math.round(CAPTIONS_CORPUS.length / 4)} tokens)`);
console.log(`raw p42 snippet: ${getRawPages("owner-manual", [42])[0].text.slice(0, 80)}`);
