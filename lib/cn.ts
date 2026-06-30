import clsx, { type ClassValue } from "clsx";

/** Tiny className composer. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
