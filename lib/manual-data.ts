/**
 * Duty cycle + output rating data for the Vulcan OmniPro 220 (Item 57812).
 *
 * Source: rating plate on the rear panel (Owner's Manual pp. 25/27) and the
 * Rated Duty Cycle charts on pp. 19 and 29. Values are verbatim from the
 * manual; interpolation between anchor points uses the IEC 60974 convention
 * (I^2 * X approximately constant) and is clearly labeled as an estimate.
 */

export type WeldProcess = "MIG" | "Stick" | "TIG";
export type InputVoltage = 120 | 240;

export interface DutyAnchor {
  /** Duty cycle percent (X) */
  duty: number;
  /** Current in amps (I2) */
  amps: number;
  /** Load voltage (U2) */
  volts: number;
}

export interface ProcessRating {
  process: WeldProcess;
  minAmps: number;
  maxAmps: number;
  anchors: DutyAnchor[];
  /** Rated headline figure, e.g. "25% @ 200A" */
  headline: string;
}

export const DUTY_CYCLE_TABLE: Record<InputVoltage, ProcessRating[]> = {
  240: [
    {
      process: "MIG",
      minAmps: 30,
      maxAmps: 220,
      headline: "25% @ 200A",
      anchors: [
        { duty: 25, amps: 200, volts: 24 },
        { duty: 60, amps: 130, volts: 20.5 },
        { duty: 100, amps: 115, volts: 19.75 },
      ],
    },
    {
      process: "Stick",
      minAmps: 10,
      maxAmps: 175,
      headline: "25% @ 175A",
      anchors: [
        { duty: 25, amps: 175, volts: 27 },
        { duty: 60, amps: 115, volts: 24.6 },
        { duty: 100, amps: 100, volts: 24 },
      ],
    },
    {
      process: "TIG",
      minAmps: 10,
      maxAmps: 175,
      headline: "30% @ 175A",
      anchors: [
        { duty: 30, amps: 175, volts: 17 },
        { duty: 60, amps: 125, volts: 15 },
        { duty: 100, amps: 105, volts: 14.2 },
      ],
    },
  ],
  120: [
    {
      process: "MIG",
      minAmps: 30,
      maxAmps: 140,
      headline: "40% @ 100A",
      anchors: [
        { duty: 40, amps: 100, volts: 19 },
        { duty: 60, amps: 85, volts: 18.25 },
        { duty: 100, amps: 75, volts: 17.75 },
      ],
    },
    {
      process: "Stick",
      minAmps: 10,
      maxAmps: 80,
      headline: "40% @ 80A",
      anchors: [
        { duty: 40, amps: 80, volts: 23.2 },
        { duty: 60, amps: 70, volts: 22.8 },
        { duty: 100, amps: 60, volts: 22.4 },
      ],
    },
    {
      process: "TIG",
      minAmps: 10,
      maxAmps: 125,
      headline: "40% @ 125A",
      anchors: [
        { duty: 40, amps: 125, volts: 15 },
        { duty: 60, amps: 105, volts: 14.2 },
        { duty: 100, amps: 90, volts: 13.6 },
      ],
    },
  ],
};

export interface DutyEstimate {
  duty: number; // percent 0-100
  weldMinutes: number; // per 10-minute window
  restMinutes: number;
  interpolated: boolean; // false when amps exactly match an anchor
  inRange: boolean;
}

/**
 * Duty cycle at a given amperage. Between rating-plate anchor points we use
 * the IEC 60974 convention I1^2 * X1 = I2^2 * X2 (constant), which is how
 * manufacturers interpolate duty cycle curves.
 */
export function estimateDutyCycle(
  process: WeldProcess,
  voltage: InputVoltage,
  amps: number,
): DutyEstimate | null {
  const rating = DUTY_CYCLE_TABLE[voltage].find((r) => r.process === process);
  if (!rating) return null;

  const inRange = amps <= rating.maxAmps;
  const sorted = [...rating.anchors].sort((a, b) => b.amps - a.amps); // high amps -> low duty

  const exact = sorted.find((a) => a.amps === amps);
  if (exact) return toEstimate(exact.duty, false, inRange);

  // Below the 100% anchor amperage -> 100% duty (can weld continuously).
  const continuous = sorted[sorted.length - 1];
  if (amps <= continuous.amps) return toEstimate(100, false, inRange);

  // Above the highest anchor amperage: extrapolate downward from it.
  const top = sorted[0];
  if (amps > top.amps) {
    const duty = (top.amps * top.amps * top.duty) / (amps * amps);
    return toEstimate(Math.max(duty, 1), true, inRange);
  }

  // Between two anchors: I^2 * X = const interpolation.
  let lower = sorted[sorted.length - 1]; // lower amps, higher duty
  let upper = sorted[0]; // higher amps, lower duty
  for (let i = 0; i < sorted.length - 1; i++) {
    if (amps <= sorted[i].amps && amps >= sorted[i + 1].amps) {
      upper = sorted[i];
      lower = sorted[i + 1];
      break;
    }
  }
  const k1 = upper.amps * upper.amps * upper.duty;
  const k2 = lower.amps * lower.amps * lower.duty;
  // Linear interpolation of the I^2*X constant between anchors.
  const t = (amps - lower.amps) / (upper.amps - lower.amps);
  const k = k2 + t * (k1 - k2);
  const duty = k / (amps * amps);
  return toEstimate(Math.min(duty, 100), true, inRange);
}

function toEstimate(duty: number, interpolated: boolean, inRange: boolean): DutyEstimate {
  const weldMinutes = (duty / 100) * 10;
  return {
    duty: Math.round(duty * 10) / 10,
    weldMinutes: Math.round(weldMinutes * 10) / 10,
    restMinutes: Math.round((10 - weldMinutes) * 10) / 10,
    interpolated,
    inRange,
  };
}

/** Polarity / cable setup matrix (Quick Start Guide p.2; Owner's Manual pp. 14-17, 24, 27). */
export const POLARITY_SETUP: Record<
  string,
  {
    groundClamp: "POSITIVE (+)" | "NEGATIVE (-)";
    otherLead: { label: string; socket: "POSITIVE (+)" | "NEGATIVE (-)" };
    convention: string;
    gas: string;
    notes: string[];
    manualPage: number;
  }
> = {
  MIG: {
    groundClamp: "NEGATIVE (-)",
    otherLead: { label: "Wire feed power cable", socket: "POSITIVE (+)" },
    convention: "DCEP (electrode positive)",
    gas: "Shielding gas required (e.g. C25 for steel, Tri-Mix for stainless), 20-30 SCFH",
    notes: [
      "MIG gun connects to the wire feed mechanism",
      "Wire feed control cable connects INSIDE the welder",
    ],
    manualPage: 14,
  },
  "Flux-Cored": {
    groundClamp: "POSITIVE (+)",
    otherLead: { label: "Wire feed power cable", socket: "NEGATIVE (-)" },
    convention: "DCEN (electrode negative)",
    gas: "No shielding gas required (self-shielded)",
    notes: ["Same hookup as MIG but with polarity REVERSED"],
    manualPage: 15,
  },
  TIG: {
    groundClamp: "POSITIVE (+)",
    otherLead: { label: "TIG torch cable", socket: "NEGATIVE (-)" },
    convention: "DCEN (electrode negative)",
    gas: "100% Argon required, 10-25 SCFH",
    notes: [
      "Foot pedal cable connects INSIDE the welder",
      "TIG torch and foot pedal sold separately",
      "Wire feed power left disconnected",
    ],
    manualPage: 24,
  },
  Stick: {
    groundClamp: "NEGATIVE (-)",
    otherLead: { label: "Electrode holder cable", socket: "POSITIVE (+)" },
    convention: "DCEP (electrode positive) - or swap per electrode manufacturer",
    gas: "No shielding gas required",
    notes: ["Wire feed power left disconnected"],
    manualPage: 27,
  },
  "Spool Gun (MIG aluminum)": {
    groundClamp: "NEGATIVE (-)",
    otherLead: { label: "Wire feed power cable", socket: "POSITIVE (+)" },
    convention: "DCEP (electrode positive)",
    gas: "Shielding gas required (100% Argon for aluminum)",
    notes: [
      "Spool gun cable connector passes through the hole in the welder front into the wire feed socket",
      "Gas hose connects to the Spool Gun Gas Outlet on the front of the welder",
      "Spool gun sold separately",
    ],
    manualPage: 17,
  },
};
