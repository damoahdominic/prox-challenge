"use client";

import { useEffect, useState } from "react";
import { ProxMark } from "@/components/prox-logo";
import { cn } from "@/lib/utils";

const SETTLE_MS = 1100; // logo scale-down settle
const HOLD_MS = 500; // beat before exit
const EXIT_MS = 450; // overlay fade-out

/**
 * Startup preloader: the Prox mark scales down from oversized into place,
 * holds a beat, then the overlay fades away and unmounts.
 */
export function Preloader() {
  const [phase, setPhase] = useState<"enter" | "exit" | "gone">("enter");

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase("exit"), SETTLE_MS + HOLD_MS);
    const goneTimer = setTimeout(
      () => setPhase("gone"),
      SETTLE_MS + HOLD_MS + EXIT_MS,
    );
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "bg-background fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 transition-opacity",
        phase === "exit" && "pointer-events-none opacity-0",
      )}
      style={{ transitionDuration: `${EXIT_MS}ms` }}
    >
      <div className="preloader-logo text-orange-500">
        <ProxMark className="size-20" />
      </div>
      <div
        className="preloader-caption text-muted-foreground text-sm font-medium tracking-wide"
        style={{ animationDelay: "450ms" }}
      >
        Vulcan Product Expert
      </div>
    </div>
  );
}
