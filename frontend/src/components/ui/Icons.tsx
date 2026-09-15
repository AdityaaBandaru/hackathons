/** Tiny inline icon set; 16px, stroke-based, inherits currentColor. */

type IconProps = { className?: string };

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ArrowRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function External({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10M9 2h5v5M14 2 7 9" />
    </svg>
  );
}

export function Bars({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 13h12M4 13V6M8 13V3M12 13V8" />
    </svg>
  );
}

export function Layers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m2 5.5 6-3 6 3-6 3-6-3ZM2 8.5l6 3 6-3M2 11.5l6 3 6-3" />
    </svg>
  );
}

export function Sliders({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 4h6M11 4h3M2 8h2M7 8h7M2 12h9M14 12h0" />
      <circle cx="9.5" cy="4" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="12.5" cy="12" r="1.5" />
    </svg>
  );
}

export function MapPin({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 14.5s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0c0 3.5 4.5 7.5 4.5 7.5Z" />
      <circle cx="8" cy="7" r="1.5" />
    </svg>
  );
}

export function Close({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}

export function Spinner({ className }: IconProps) {
  return (
    <svg {...base} className={`animate-spin ${className ?? ""}`}>
      <path d="M8 2a6 6 0 1 1-6 6" />
    </svg>
  );
}
