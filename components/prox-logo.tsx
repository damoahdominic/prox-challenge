import { cn } from "@/lib/utils";

/**
 * Prox brand assets, extracted from https://useprox.com (public/prox.svg).
 * The source SVG is black-on-transparent; on our dark UI the wordmark is
 * inverted (same trick their own site uses: `filter: invert(1)`).
 */

export function ProxWordmark({
  className,
  height = 18,
}: {
  className?: string;
  height?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/prox.svg"
      alt="Prox"
      height={height}
      style={{ height, width: "auto", filter: "invert(1)" }}
      className={cn("select-none opacity-90", className)}
    />
  );
}

/** The Prox starburst mark (path lifted from prox.svg), colored via currentColor. */
export function ProxMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 437 433"
      fill="currentColor"
      aria-label="Prox"
      role="img"
      className={className}
    >
      <path d="M311.03 141.377C282.755 144.77 216.025 0 216.025 0C216.025 0 268.052 130.067 247.693 153.819C227.335 177.57 0 156.081 0 156.081C0 156.081 230.728 185.487 239.776 211.501C248.824 237.514 72.3852 432.049 72.3852 432.049C72.3852 432.049 263.527 234.121 289.541 234.121C315.554 234.121 335.913 277.1 335.913 277.1C335.913 277.1 322.34 237.514 330.258 217.156C338.175 196.797 396.988 201.321 396.988 201.321C396.988 201.321 349.485 194.535 342.699 171.915C335.913 149.295 436.573 40.7167 436.573 40.7167C436.573 40.7167 339.306 137.984 311.03 141.377Z" />
    </svg>
  );
}
