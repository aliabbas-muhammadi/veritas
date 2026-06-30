"use client";

import { motion } from "motion/react";

/**
 * Tasteful entrance: a short fade + rise on mount. Animates only opacity/transform.
 * Reduced-motion is honored globally via <MotionConfig reducedMotion="user">, which
 * skips the transform and leaves a gentle opacity fade that always ends fully visible.
 * `data-reveal` lets a <noscript> fallback un-hide this content when JS never runs.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
