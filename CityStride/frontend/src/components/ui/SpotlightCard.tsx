"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

/**
 * A card whose border and surface glow follow the pointer. The glow is a
 * radial gradient positioned by two CSS variables that the mouse handler
 * updates directly on the element -- no React state, so the effect costs
 * nothing per frame. Falls back to a plain card with no pointer.
 */
export function SpotlightCard({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = useRef<HTMLElement | null>(null);

  function onMouseMove(event: MouseEvent<HTMLElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <Tag
      // The union of element types is wider than any single ref type accepts.
      ref={ref as never}
      onMouseMove={onMouseMove}
      className={`group/spot card card-interactive relative overflow-hidden ${className}`}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          background:
            "radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgb(94 106 210 / 0.16), transparent 60%)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          padding: 1,
          background:
            "radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), rgb(199 203 255 / 0.5), transparent 60%)",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div className="relative">{children}</div>
    </Tag>
  );
}
