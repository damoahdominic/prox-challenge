"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  FlameIcon,
  GaugeIcon,
  LayoutPanelTopIcon,
  LoaderIcon,
  PlugIcon,
} from "lucide-react";
import {
  makeAssistantToolUI,
  type ToolCallMessagePartStatus,
} from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DUTY_CYCLE_TABLE,
  POLARITY_SETUP,
  estimateDutyCycle,
  type InputVoltage,
  type WeldProcess,
} from "@/lib/manual-data";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

type DocId = "owner-manual" | "quick-start-guide" | "selection-chart";

const DOC_LABELS: Record<DocId, string> = {
  "owner-manual": "Owner's Manual",
  "quick-start-guide": "Quick Start Guide",
  "selection-chart": "Selection Chart",
};

function ToolStatusView({
  status,
  loadingLabel,
}: {
  status?: ToolCallMessagePartStatus;
  loadingLabel: string;
}) {
  if (status?.type === "incomplete") {
    const errorText =
      status.error != null
        ? typeof status.error === "string"
          ? status.error
          : JSON.stringify(status.error)
        : null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangleIcon className="size-4 shrink-0" />
        <span>
          {status.reason === "cancelled"
            ? "Tool call was cancelled."
            : (errorText ?? "Something went wrong running this tool.")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
      <LoaderIcon className="size-4 shrink-0 animate-spin [animation-duration:0.8s]" />
      <span>{loadingLabel}</span>
    </div>
  );
}

function ToolCard({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3.5 py-2">
        <Icon className="size-4 shrink-0 text-orange-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </span>
        {badge}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// show-manual-visual
// ---------------------------------------------------------------------------

type ShowManualVisualArgs = {
  doc: DocId;
  page: number;
  image?: string;
  caption: string;
};

type ShowManualVisualResult =
  | {
      found: true;
      doc: DocId;
      page: number;
      image: string | null;
      pageImage: string;
      caption: string;
    }
  | { found: false; availableImages?: string[] };

const ShowManualVisualToolUI = makeAssistantToolUI<
  ShowManualVisualArgs,
  ShowManualVisualResult
>({
  toolName: "show-manual-visual",
  display: "standalone",
  render: ({ args, result, status }) => {
    if (status?.type !== "complete" || !result) {
      return (
        <ToolStatusView status={status} loadingLabel="Opening the manual…" />
      );
    }

    if (!result.found) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span>
            That visual isn&apos;t available for {DOC_LABELS[args.doc]} p.{" "}
            {args.page}.
          </span>
        </div>
      );
    }

    const src = result.image ?? result.pageImage;
    const docLabel = DOC_LABELS[result.doc] ?? "Manual";

    return (
      <ToolCard
        icon={BookOpenIcon}
        title={result.caption}
        badge={
          <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
            {docLabel} p. {result.page}
          </span>
        }
      >
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden rounded-lg border border-border/60 bg-muted/30"
          title="Open full size in a new tab"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={result.caption}
            className="mx-auto max-h-[480px] w-auto max-w-full object-contain"
          />
          <span className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <ExternalLinkIcon className="size-4" />
          </span>
        </a>
      </ToolCard>
    );
  },
});

// ---------------------------------------------------------------------------
// render-artifact
// ---------------------------------------------------------------------------

type RenderArtifactArgs = { title: string; html: string };
type RenderArtifactResult = { title: string; html: string };

const RenderArtifactToolUI = makeAssistantToolUI<
  RenderArtifactArgs,
  RenderArtifactResult
>({
  toolName: "render-artifact",
  display: "standalone",
  render: ({ args, result, status }) => {
    const data = result ?? (args.html ? { title: args.title, html: args.html } : undefined);

    if (status?.type === "incomplete") {
      return <ToolStatusView status={status} loadingLabel="" />;
    }
    if (!data) {
      return (
        <ToolStatusView status={status} loadingLabel="Building the diagram…" />
      );
    }

    return <ArtifactPanel title={data.title} html={data.html} />;
  },
});

function ArtifactPanel({ title, html }: { title: string; html: string }) {
  const [collapsed, setCollapsed] = useState(false);

  const popOut = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Give the new tab a moment to load before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950 shadow-sm dark:border-zinc-700">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3.5 py-2">
        <LayoutPanelTopIcon className="size-4 shrink-0 text-orange-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
          {title}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label={collapsed ? "Expand artifact" : "Collapse artifact"}
        >
          {collapsed ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronUpIcon className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={popOut}
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Open artifact in a new tab"
        >
          <ExternalLinkIcon className="size-4" />
        </button>
      </div>
      {!collapsed && (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          title={title}
          className="block w-full bg-zinc-950"
          style={{ height: 420 }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// duty-cycle-calculator
// ---------------------------------------------------------------------------

type DutyCycleArgs = {
  process: WeldProcess;
  inputVoltage: InputVoltage;
  amperage?: number;
};

const PROCESSES: WeldProcess[] = ["MIG", "Stick", "TIG"];
const VOLTAGES: InputVoltage[] = [120, 240];

const DutyCycleCalculatorToolUI = makeAssistantToolUI<
  DutyCycleArgs,
  DutyCycleArgs
>({
  toolName: "duty-cycle-calculator",
  display: "standalone",
  render: ({ args, result, status }) => {
    if (status?.type !== "complete" && status?.type !== "running") {
      return <ToolStatusView status={status} loadingLabel="" />;
    }

    const prefill = result ?? args;
    if (status?.type === "running" || !prefill?.process) {
      return (
        <ToolStatusView
          status={status}
          loadingLabel="Opening the duty cycle calculator…"
        />
      );
    }

    return (
      <DutyCycleCalculator
        key={`${prefill.process}-${prefill.inputVoltage}-${prefill.amperage ?? "auto"}`}
        initial={prefill}
      />
    );
  },
});

function DutyCycleCalculator({ initial }: { initial: DutyCycleArgs }) {
  const [process, setProcess] = useState<WeldProcess>(
    PROCESSES.includes(initial.process) ? initial.process : "MIG",
  );
  const [voltage, setVoltage] = useState<InputVoltage>(
    VOLTAGES.includes(initial.inputVoltage) ? initial.inputVoltage : 240,
  );

  const rating = DUTY_CYCLE_TABLE[voltage].find((r) => r.process === process)!;
  const sliderMax = Math.ceil(rating.maxAmps * 1.1);
  const defaultAmps = Math.max(
    rating.minAmps,
    Math.min(
      initial.amperage ?? [...rating.anchors].sort((a, b) => b.amps - a.amps)[0].amps,
      sliderMax,
    ),
  );

  const [amps, setAmps] = useState<number>(defaultAmps);

  const estimate = useMemo(
    () => estimateDutyCycle(process, voltage, amps),
    [process, voltage, amps],
  );

  const switchProcess = (p: WeldProcess) => {
    setProcess(p);
    const r = DUTY_CYCLE_TABLE[voltage].find((x) => x.process === p)!;
    setAmps((a) => Math.max(r.minAmps, Math.min(a, Math.ceil(r.maxAmps * 1.1))));
  };

  const switchVoltage = (v: InputVoltage) => {
    setVoltage(v);
    const r = DUTY_CYCLE_TABLE[v].find((x) => x.process === process)!;
    setAmps((a) => Math.max(r.minAmps, Math.min(a, Math.ceil(r.maxAmps * 1.1))));
  };

  return (
    <ToolCard
      icon={GaugeIcon}
      title="Duty Cycle Calculator"
      badge={
        <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          Rated: {rating.headline}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Process + voltage selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {PROCESSES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => switchProcess(p)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  p === process
                    ? "bg-orange-500 text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {VOLTAGES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => switchVoltage(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  v === voltage
                    ? "bg-orange-500 text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}V
              </button>
            ))}
          </div>
        </div>

        {/* Amperage slider */}
        <div>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Amperage</span>
            <span className="font-semibold tabular-nums">{amps} A</span>
          </div>
          <input
            type="range"
            min={rating.minAmps}
            max={sliderMax}
            step={1}
            value={amps}
            onChange={(e) => setAmps(Number(e.target.value))}
            className="w-full accent-orange-500"
            aria-label="Amperage"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{rating.minAmps} A</span>
            <span>
              rated max {rating.maxAmps} A
            </span>
            <span>{sliderMax} A</span>
          </div>
        </div>

        {estimate && (
          <>
            {/* Readout */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {estimate.duty}%
              </span>
              <span className="text-sm text-muted-foreground">
                duty cycle @ {amps} A
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  estimate.interpolated
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                )}
              >
                {estimate.interpolated
                  ? "Interpolated estimate"
                  : "Exact rating-plate value"}
              </span>
            </div>

            {!estimate.inRange && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangleIcon className="size-4 shrink-0" />
                <span>
                  {amps} A is above the rated {process} output on {voltage}V (
                  {rating.maxAmps} A max). The welder can&apos;t sustain this —
                  expect the thermal overload to trip.
                </span>
              </div>
            )}

            {/* 10-minute window bar */}
            <div>
              <div className="relative h-7 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full bg-orange-500 transition-[width] duration-200"
                  style={{ width: `${estimate.duty}%` }}
                />
                <div className="pointer-events-none absolute inset-0 flex">
                  {Array.from({ length: 9 }, (_, i) => (
                    <div
                      key={i}
                      className="h-full border-r border-background/60"
                      style={{ width: "10%" }}
                    />
                  ))}
                  <div className="h-full" style={{ width: "10%" }} />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-orange-500" />
                  Weld{" "}
                  <b className="tabular-nums">{estimate.weldMinutes} min</b>
                </span>
                <span className="text-xs text-muted-foreground">
                  per 10-minute window
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block size-2.5 rounded-sm bg-muted-foreground/40" />
                  Cool{" "}
                  <b className="tabular-nums">{estimate.restMinutes} min</b>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </ToolCard>
  );
}

// ---------------------------------------------------------------------------
// setup-configurator
// ---------------------------------------------------------------------------

type SetupProcess = keyof typeof POLARITY_SETUP;

type SetupConfiguratorArgs = {
  process: SetupProcess;
  material?: string;
  thickness?: string;
};

type PolaritySetup = (typeof POLARITY_SETUP)[string];

type SetupConfiguratorResult = SetupConfiguratorArgs & {
  polarity: PolaritySetup;
};

const SETUP_STEPS = [
  "Cable polarity",
  "Gas",
  "LCD settings",
  "Notes & safety",
] as const;

const SetupConfiguratorToolUI = makeAssistantToolUI<
  SetupConfiguratorArgs,
  SetupConfiguratorResult
>({
  toolName: "setup-configurator",
  display: "standalone",
  render: ({ args, result, status }) => {
    if (status?.type !== "complete" || !result?.polarity) {
      return (
        <ToolStatusView
          status={status}
          loadingLabel="Opening the setup configurator…"
        />
      );
    }
    return <SetupConfigurator args={args} result={result} />;
  },
});

function SetupConfigurator({
  args,
  result,
}: {
  args: SetupConfiguratorArgs;
  result: SetupConfiguratorResult;
}) {
  const [step, setStep] = useState(0);
  const { polarity } = result;

  return (
    <ToolCard
      icon={PlugIcon}
      title={`Set up: ${args.process}`}
      badge={
        <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          {polarity.convention}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {(args.material || args.thickness) && (
          <p className="text-sm text-muted-foreground">
            {[args.material, args.thickness].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Step tabs */}
        <ol className="flex flex-wrap gap-1.5">
          {SETUP_STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  i === step
                    ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full text-[10px]",
                    i === step
                      ? "bg-orange-500 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="min-h-40">
          {step === 0 && <PolarityStep polarity={polarity} />}
          {step === 1 && <GasStep polarity={polarity} />}
          {step === 2 && <LcdStep process={args.process} />}
          {step === 3 && <NotesStep polarity={polarity} />}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeftIcon className="size-4" /> Back
          </Button>
          {step < SETUP_STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Next <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="size-4" /> Ready to weld
            </span>
          )}
        </div>
      </div>
    </ToolCard>
  );
}

function PolarityStep({ polarity }: { polarity: PolaritySetup }) {
  return (
    <div className="flex flex-col gap-3">
      <PolarityDiagram polarity={polarity} />
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block size-2.5 rounded-full",
              polarity.groundClamp === "POSITIVE (+)"
                ? "bg-red-500"
                : "bg-blue-500",
            )}
          />
          Ground clamp → <b>{polarity.groundClamp}</b> socket
        </li>
        <li className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block size-2.5 rounded-full",
              polarity.otherLead.socket === "POSITIVE (+)"
                ? "bg-red-500"
                : "bg-blue-500",
            )}
          />
          {polarity.otherLead.label} → <b>{polarity.otherLead.socket}</b>{" "}
          socket
        </li>
      </ul>
    </div>
  );
}

/**
 * Inline SVG of the OmniPro 220 front panel: two DINSE sockets, (−) left and
 * (+) right, with the ground clamp and the process lead drawn into the
 * correct sockets (negative = blue, positive = red).
 */
function PolarityDiagram({ polarity }: { polarity: PolaritySetup }) {
  const NEG_X = 105;
  const POS_X = 215;
  const SOCKET_Y = 78;

  const socketX = (socket: "POSITIVE (+)" | "NEGATIVE (-)") =>
    socket === "POSITIVE (+)" ? POS_X : NEG_X;
  const socketColor = (socket: "POSITIVE (+)" | "NEGATIVE (-)") =>
    socket === "POSITIVE (+)" ? "#ef4444" : "#3b82f6";

  const groundX = socketX(polarity.groundClamp);
  const leadX = socketX(polarity.otherLead.socket);

  // Cable anchors at the bottom of the diagram.
  const GROUND_HOME = { x: 55, y: 208 };
  const LEAD_HOME = { x: 265, y: 208 };

  const cablePath = (from: { x: number; y: number }, toX: number) =>
    `M ${from.x} ${from.y} C ${from.x} ${from.y - 70}, ${toX} ${toX === from.x ? SOCKET_Y + 40 : SOCKET_Y + 60}, ${toX} ${SOCKET_Y + 14}`;

  return (
    <svg
      viewBox="0 0 320 250"
      role="img"
      aria-label={`Front panel polarity diagram: ground clamp to ${polarity.groundClamp}, ${polarity.otherLead.label} to ${polarity.otherLead.socket}`}
      className="w-full max-w-md self-center rounded-lg bg-zinc-950"
    >
      {/* Front panel */}
      <rect
        x={25}
        y={16}
        width={270}
        height={100}
        rx={12}
        fill="#18181b"
        stroke="#3f3f46"
      />
      <text
        x={160}
        y={38}
        textAnchor="middle"
        fill="#a1a1aa"
        fontSize={11}
        fontWeight={600}
        letterSpacing={1.5}
      >
        OMNIPRO 220 — FRONT PANEL
      </text>

      {/* Sockets */}
      {[
        { x: NEG_X, label: "−", name: "NEGATIVE" },
        { x: POS_X, label: "+", name: "POSITIVE" },
      ].map((s) => (
        <g key={s.name}>
          <circle
            cx={s.x}
            cy={SOCKET_Y}
            r={15}
            fill="#27272a"
            stroke="#52525b"
            strokeWidth={2}
          />
          <text
            x={s.x}
            y={SOCKET_Y + 6}
            textAnchor="middle"
            fill="#e4e4e7"
            fontSize={18}
            fontWeight={700}
          >
            {s.label}
          </text>
          <text
            x={s.x}
            y={SOCKET_Y + 30}
            textAnchor="middle"
            fill="#71717a"
            fontSize={8.5}
            fontWeight={600}
            letterSpacing={1}
          >
            {s.name}
          </text>
        </g>
      ))}

      {/* Ground clamp cable */}
      <path
        d={cablePath(GROUND_HOME, groundX)}
        fill="none"
        stroke={socketColor(polarity.groundClamp)}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle
        cx={groundX}
        cy={SOCKET_Y + 13}
        r={5}
        fill={socketColor(polarity.groundClamp)}
      />
      {/* ground clamp jaws */}
      <path
        d={`M ${GROUND_HOME.x - 9} ${GROUND_HOME.y + 6} L ${GROUND_HOME.x} ${GROUND_HOME.y - 4} L ${GROUND_HOME.x + 9} ${GROUND_HOME.y + 6}`}
        fill="none"
        stroke={socketColor(polarity.groundClamp)}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={GROUND_HOME.x}
        y={GROUND_HOME.y + 24}
        textAnchor="middle"
        fill={socketColor(polarity.groundClamp)}
        fontSize={10.5}
        fontWeight={600}
      >
        Ground clamp
      </text>

      {/* Process lead cable */}
      <path
        d={cablePath(LEAD_HOME, leadX)}
        fill="none"
        stroke={socketColor(polarity.otherLead.socket)}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle
        cx={leadX}
        cy={SOCKET_Y + 13}
        r={5}
        fill={socketColor(polarity.otherLead.socket)}
      />
      {/* lead plug/handle */}
      <rect
        x={LEAD_HOME.x - 5}
        y={LEAD_HOME.y - 10}
        width={10}
        height={16}
        rx={3}
        fill={socketColor(polarity.otherLead.socket)}
      />
      <text
        x={LEAD_HOME.x}
        y={LEAD_HOME.y + 24}
        textAnchor="middle"
        fill={socketColor(polarity.otherLead.socket)}
        fontSize={10.5}
        fontWeight={600}
      >
        {polarity.otherLead.label}
      </text>
    </svg>
  );
}

function GasStep({ polarity }: { polarity: PolaritySetup }) {
  const needsGas = !polarity.gas.toLowerCase().startsWith("no shielding");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
        <FlameIcon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            needsGas ? "text-orange-500" : "text-muted-foreground",
          )}
        />
        <p className="text-sm">{polarity.gas}</p>
      </div>
      {needsGas && (
        <p className="text-xs text-muted-foreground">
          Attach the regulator to the cylinder, crack the valve briefly to
          clear debris, then set flow while welding (or with the gas post-flow
          active). Check hose connections for leaks with soapy water.
        </p>
      )}
    </div>
  );
}

function LcdStep({ process }: { process: string }) {
  const steps = [
    <>From the <b>Home</b> screen, turn the <b>Main Control Knob</b> to select <b>{process}</b>.</>,
    <>Press the knob to <b>CONFIRM</b> — the polarity / gas setup screen appears. Verify it matches your cable hookup.</>,
    <><b>Left Knob</b>: wire / rod / electrode diameter.</>,
    <><b>Right Knob</b>: material thickness.</>,
    <>Open <b>Auto Weld Settings</b>: <b>Left Knob</b> = wire feed speed / amperage, <b>Right Knob</b> = voltage.</>,
  ];
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((content, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-semibold text-orange-600 dark:text-orange-400">
            {i + 1}
          </span>
          <span>{content}</span>
        </li>
      ))}
    </ol>
  );
}

function NotesStep({ polarity }: { polarity: PolaritySetup }) {
  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-1.5">
        {polarity.notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-orange-500" />
            {note}
          </li>
        ))}
        <li className="flex items-start gap-2 text-sm">
          <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-orange-500" />
          Plug into a <b>GFCI-protected grounded outlet</b> on a{" "}
          <b>delayed-action breaker</b>.
        </li>
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpenIcon className="size-3.5" />
        Owner&apos;s Manual p. {polarity.manualPage}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export {
  ShowManualVisualToolUI,
  RenderArtifactToolUI,
  DutyCycleCalculatorToolUI,
  SetupConfiguratorToolUI,
};
