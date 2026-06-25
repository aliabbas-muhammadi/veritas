/** NDJSON helpers for the streaming wire protocol (one JSON object per line). */
import type { WireEvent } from "./types";

const encoder = new TextEncoder();

export function encodeEvent(ev: WireEvent): Uint8Array {
  return encoder.encode(JSON.stringify(ev) + "\n");
}

export const STREAM_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
} as const;
