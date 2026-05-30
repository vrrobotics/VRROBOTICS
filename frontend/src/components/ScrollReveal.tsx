import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Progressive-enhancement scroll reveal. Marks the document as reveal-ready
 * (the CSS only hides elements once this class is present, so the page stays
 * visible if JS is off) and fades `.card-ngo` / `[data-reveal]` elements in as
 * they enter the viewport. Re-scans on every route change.
 */
const ScrollReveal = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    root.classList.add("reveal-ready");

    if (reduce || !("IntersectionObserver" in window)) {
      document.querySelectorAll<HTMLElement>(".card-ngo, [data-reveal]").forEach((el) =>
        el.classList.add("revealed"),
      );
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            // Stagger siblings slightly for a polished cascade.
            const siblings = Array.from(el.parentElement?.children ?? []);
            const idx = Math.max(0, siblings.indexOf(el));
            el.style.transitionDelay = `${Math.min(idx, 6) * 70}ms`;
            el.classList.add("revealed");
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    // Defer one frame so freshly-routed content is in the DOM.
    const raf = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>(".card-ngo:not(.revealed), [data-reveal]:not(.revealed)")
        .forEach((el) => observer.observe(el));
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
};

export default ScrollReveal;
