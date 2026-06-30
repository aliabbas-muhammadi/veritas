"use client";

import { motion } from "motion/react";

/**
 * Scroll-triggered sibling of <Reveal>. Same fade + rise, but it fires when the
 * block enters the viewport. Reduced motion is honored globally via
 * <MotionConfig reducedMotion="user">; the `data-reveal` hook lets a <noscript>
 * rule force these blocks visible when JS never runs.
 */
export function RevealOnScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
