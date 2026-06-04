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
      const revealAll = () =>
        document
          .querySelectorAll<HTMLElement>(".card-ngo:not(.revealed), [data-reveal]:not(.revealed)")
          .forEach((el) => el.classList.add("revealed"));
      revealAll();
      // Content added later (e.g. after an async fetch) must be revealed too.
      const mo = new MutationObserver(revealAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
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

    // Observe every not-yet-revealed element. Runs on the next frame (so
    // freshly-routed content is in the DOM) and again whenever the DOM
    // changes, so cards rendered after an async fetch — e.g. the Gallery
    // page loading items from the API — are picked up instead of being left
    // permanently hidden at opacity:0.
    const scan = () =>
      document
        .querySelectorAll<HTMLElement>(".card-ngo:not(.revealed), [data-reveal]:not(.revealed)")
        .forEach((el) => observer.observe(el));

    let raf = requestAnimationFrame(scan);
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
};

export default ScrollReveal;
