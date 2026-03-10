"use client";

export function LoadingIndicator({
  label,
  kind = "spinner",
}: {
  label: string;
  kind?: "spinner" | "dots";
}) {
  return (
    <span className={`lab-loading-indicator ${kind}`}>
      <span className="lab-loading-visual" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
