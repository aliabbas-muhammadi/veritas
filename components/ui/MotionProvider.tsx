"use client";

import { MotionConfig } from "motion/react";

/**
 * Honors the OS "reduce motion" setting for all Framer Motion animations:
 * disables transform/layout movement and keeps only gentle opacity, so content
 * always ends fully visible.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
