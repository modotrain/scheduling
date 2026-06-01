"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Logo displayed at the top-left of the home page.
 *
 * Behaviour:
 *   - While the user hasn't scrolled past the threshold the logo sits at
 *     `fixed top-0 left-0`, exactly as before.
 *   - Once the card below would be covered by the logo (within MIN_GAP px),
 *     the logo starts sliding upward with the page instead of remaining fixed,
 *     so "Scheduling Control Center" is never obscured.
 *
 * The threshold is derived at runtime by measuring the card element tagged
 * with `data-scroll-card`, so no magic numbers are hard-coded here.
 */
export default function HomeLogo() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const MIN_GAP = 24; // px to keep between logo bottom and card top

    // Card's distance from document top (static — card is in normal flow).
    // Measured once; `getBoundingClientRect().top + scrollY` is robust even
    // if useEffect fires mid-scroll.
    const card = document.querySelector<HTMLElement>("[data-scroll-card]");
    const cardDocTop = card
      ? card.getBoundingClientRect().top + window.scrollY
      : Infinity;

    function update() {
      if (!container) return;
      const logoH = container.offsetHeight;
      const threshold = cardDocTop - logoH - MIN_GAP;
      // top is 0 while scrollY ≤ threshold, then goes negative (slides up).
      const top = Math.min(0, threshold - window.scrollY);
      container.style.top = `${top}px`;
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed left-0 z-40" style={{ top: 0 }}>
      <Image
        src="/ep-vi-logo-3-25.svg"
        alt="Einstein Probe VI Logo"
        width={540}
        height={156}
        priority
        sizes="(min-width: 768px) 540px, 420px"
        className="h-[121px] w-[420px] dark:hidden md:h-[156px] md:w-[540px]"
      />
      <Image
        src="/ep-vi-logo-3-26.svg"
        alt="Einstein Probe Logo"
        width={540}
        height={156}
        priority
        sizes="(min-width: 768px) 540px, 420px"
        className="hidden h-[121px] w-[420px] dark:block md:h-[156px] md:w-[540px]"
      />
    </div>
  );
}
