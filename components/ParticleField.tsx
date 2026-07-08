"use client";

import { useEffect, useRef } from "react";

/**
 * Constelação animada em canvas, atrás de todo o conteúdo.
 * Reage ao tema (data-theme) e ao cursor. Respeita prefers-reduced-motion.
 */
export default function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Cor do tema atual (rgb do acento)
    let rgb: [number, number, number] = [124, 124, 247];
    function readTheme() {
      const t = document.documentElement.getAttribute("data-theme");
      rgb = t === "light" ? [91, 91, 214] : [124, 124, 247];
    }
    readTheme();
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let w = 0;
    let h = 0;
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let pts: P[] = [];

    function build() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(80, Math.round((w * h) / 22000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.6 + 0.8,
      }));
    }
    build();

    const mouse = { x: -9999, y: -9999 };
    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    const LINK = 130;
    const LINK2 = LINK * LINK;

    function frame() {
      ctx.clearRect(0, 0, w, h);
      const [r, g, b] = rgb;

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // atração subtil ao cursor
        const mdx = mouse.x - p.x;
        const mdy = mouse.y - p.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < 26000) {
          p.x += mdx * 0.0009;
          p.y += mdy * 0.0009;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
        ctx.fill();
      }

      // ligações
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const bb = pts[j];
          const dx = a.x - bb.x;
          const dy = a.y - bb.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            const alpha = (1 - d2 / LINK2) * 0.22;
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(bb.x, bb.y);
            ctx.stroke();
          }
        }
        // ligação ao cursor
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK2 * 1.6) {
          const alpha = (1 - d2 / (LINK2 * 1.6)) * 0.35;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    let raf = 0;
    if (reduce) {
      frame(); // desenha um frame estático
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    let resizeT: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(resizeT);
      resizeT = setTimeout(build, 150);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="particle-field" aria-hidden="true" />;
}
