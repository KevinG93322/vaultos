import { NextResponse } from "next/server";

import { getVaultStore } from "@/db/client";
import { readRuntimeConfig } from "@/lib/vaultos/config";
import { parseChainId, parseVaultAddress } from "@/lib/vaultos/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const config = readRuntimeConfig();
  if (!config) return NextResponse.json({ error: "service_unconfigured" }, { status: 503 });

  const { address } = await context.params;
  const vaultAddress = parseVaultAddress(address);
  if (!vaultAddress) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const requested = new URL(request.url).searchParams.get("chainId");
  const chainId = requested === null ? config.chainId : parseChainId(requested);
  if (chainId === null) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (chainId !== config.chainId) return NextResponse.json({ error: "chain_mismatch" }, { status: 422 });

  try {
    const store = await getVaultStore();
    const vault = await store.findVaultByAddress(chainId, vaultAddress);
    if (!vault) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ vault });
  } catch {
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}
