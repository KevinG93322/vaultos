import { isAddress } from "viem";

import { isTxHash } from "@/lib/vaultos/config";
import type { Hash } from "@/lib/vaultos/types";

const REGISTRATION_FIELDS = new Set(["chainId", "txHash"]);

export function parseRegistrationBody(
  body: unknown,
): { ok: true; chainId: number; txHash: Hash } | { ok: false; reason: "invalid_input" } {
  if (!isRecord(body)) return { ok: false, reason: "invalid_input" };
  if (Object.keys(body).some((key) => !REGISTRATION_FIELDS.has(key))) {
    return { ok: false, reason: "invalid_input" };
  }
  if (typeof body.chainId !== "number" || !Number.isInteger(body.chainId) || body.chainId <= 0) {
    return { ok: false, reason: "invalid_input" };
  }
  if (typeof body.txHash !== "string" || !isTxHash(body.txHash)) {
    return { ok: false, reason: "invalid_input" };
  }
  return { ok: true, chainId: body.chainId, txHash: body.txHash.toLowerCase() as Hash };
}

export function parseChainId(value: string | null): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const chainId = Number(value);
  return Number.isSafeInteger(chainId) ? chainId : null;
}

export function parseVaultAddress(value: string): `0x${string}` | null {
  return isAddress(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
