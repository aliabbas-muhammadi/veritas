/**
 * Estimated request cost from token usage. Prices are an indicative, dated
 * snapshot in data/pricing.json — the gateway never bills; this only powers the
 * "$ spent" and "$ saved" observability numbers, so they stay honest estimates
 * (an unknown model returns 0 rather than a guess).
 */
import pricingData from "@/data/pricing.json";
import type { Usage } from "./providers/types";

type ModelPrice = { inputPerM: number; outputPerM: number };
type Pricing = { models: Record<string, ModelPrice> };

const PRICING = pricingData as Pricing;

export function costUsd(model: string, usage?: Usage): number {
  const p = PRICING.models[model];
  if (!p || !usage) return 0;
  return (usage.inputTokens / 1e6) * p.inputPerM + (usage.outputTokens / 1e6) * p.outputPerM;
}

/** Whether we have a price for this model (so a 0 means "free", not "unknown"). */
export function priced(model: string): boolean {
  return model in PRICING.models;
}
