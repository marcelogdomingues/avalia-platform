"use client";

import { useEffect } from "react";

/** Scroll-reveal + cena de scroll fixo ("how it works") da landing. */
export default function SiteMotion() {
  useEffect(() => {
    // ── Scroll reveal ──────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          if (el.hasAttribute("data-reveal-group")) {
            Array.from(el.children).forEach((c, i) => {
              const child = c as HTMLElement;
              child.style.transitionDelay = `${i * 90}ms`;
              child.classList.add("in");
            });
          } else {
            el.classList.add("in");
          }
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal, [data-reveal-group]").forEach((el) => io.observe(el));

    // ── Cena de scroll fixo ────────────────────────────────
    const story = document.querySelector<HTMLElement>("[data-story]");
    let onScroll: (() => void) | null = null;
    if (story) {
      const texts = [0, 1, 2].map((i) => document.querySelector<HTMLElement>(`[data-phase-text="${i}"]`));
      const mocks = [0, 1, 2].map((i) => document.querySelector<HTMLElement>(`[data-phase-mock="${i}"]`));
      const fill = document.querySelector<HTMLElement>("[data-rail-fill]");

      const setPhase = (p: number) => {
        texts.forEach((t, i) => {
          if (!t) return;
          const on = i === p;
          t.style.opacity = on ? "1" : "0";
          t.style.transform = on ? "translateY(0)" : "translateY(16px)";
        });
        mocks.forEach((m, i) => {
          if (!m) return;
          m.classList.toggle("dim", i !== p);
        });
      };

      onScroll = () => {
        const rect = story.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        let prog = total > 0 ? -rect.top / total : 0;
        prog = Math.max(0, Math.min(1, prog));
        if (fill) fill.style.height = prog * 100 + "%";
        setPhase(Math.max(0, Math.min(2, Math.floor(prog * 2.999))));
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    }

    return () => {
      io.disconnect();
      if (onScroll) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    };
  }, []);

  return null;
}
