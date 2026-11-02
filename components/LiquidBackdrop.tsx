"use client";

import { useEffect } from "react";

/**
 * Fundo "liquid glass": manchas de cor desfocadas que derivam lentamente por
 * trás de toda a UI (é isto que o vidro translúcido refrata) + um reflexo
 * especular que segue o cursor nas superfícies de vidro (--mx/--my).
 */
export default function LiquidBackdrop() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let target: HTMLElement | null = null;
    let x = 0;
    let y = 0;

    const apply = () => {
      raf = 0;
      if (!target) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${x - r.left}px`);
      target.style.setProperty("--my", `${y - r.top}px`);
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".lg-glow, .card, .lg-card, .mock, .btn, .teal-card, .prow");
      if (target && target !== el) target.classList.remove("lg-lit");
      target = el ?? null;
      if (!target) return;
      target.classList.add("lg-lit");
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      target?.classList.remove("lg-lit");
      target = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lg-backdrop" aria-hidden="true">
      <span className="lg-blob b1" />
      <span className="lg-blob b2" />
      <span className="lg-blob b3" />
      <span className="lg-blob b4" />
      <span className="lg-grain" />
    </div>
  );
}
