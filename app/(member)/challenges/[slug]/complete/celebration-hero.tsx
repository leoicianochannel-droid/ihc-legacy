"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

/**
 * Plays a celebratory confetti burst on mount, with a couple gentler bursts
 * a few seconds later so the page feels alive but not overwhelming.
 * Self-contained — no DOM dependencies, fires from window.innerWidth coords.
 */
export function CelebrationHero({ firstName }: { firstName: string }) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;

    const fire = (
      origin: { x: number; y: number },
      opts: confetti.Options = {}
    ) => {
      confetti({
        particleCount: 70,
        spread: 70,
        startVelocity: 35,
        ticks: 200,
        origin,
        colors: ["#d10352", "#fce7ef", "#D4A24C", "#FFFFFF", "#B8D4E8"],
        ...opts,
      });
    };

    // Initial burst
    fire({ x: 0.5, y: 0.3 }, { particleCount: 140, spread: 110, startVelocity: 45 });

    // Side blasts
    const t1 = setTimeout(() => fire({ x: 0.1, y: 0.4 }, { angle: 60 }), 350);
    const t2 = setTimeout(() => fire({ x: 0.9, y: 0.4 }, { angle: 120 }), 700);

    // Soft top-down sprinkle
    const t3 = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 360,
        startVelocity: 18,
        ticks: 250,
        scalar: 0.9,
        origin: { x: 0.5, y: 0 },
        colors: ["#d10352", "#fce7ef", "#FFFFFF"],
      });
    }, 1100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [firstName]);

  return null;
}
