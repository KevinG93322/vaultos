import { NextResponse } from "next/server";

import { getVaultStore } from "@/db/client";
import { readRuntimeConfig } from "@/lib/vaultos/config";
import { parseChainId, parseRegistrationBody } from "@/lib/vaultos/http";
import { registerVault } from "@/lib/vaultos/register";
import { networkName } from "@/lib/vaultos/network";
import { createViemReader } from "@/lib/vaultos/viemReader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = readRuntimeConfig();
  if (!config) return NextResponse.json({ error: "service_unconfigured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = parseRegistrationBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.reason }, { status: 400 });
  if (parsed.chainId !== config.chainId) {
    try {
      const store = await getVaultStore();
      await store.recordCheck({
        txHash: parsed.txHash,
        chainId: parsed.chainId,
        factoryAddress: config.factoryAddress.toLowerCase(),
        vaultAddress: null,
        status: "failed",
        codeHash: null,
        eventFound: false,
        failureReason: "chain_mismatch",
      });
    } catch {
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }
    return NextResponse.json({ error: "chain_mismatch" }, { status: 422 });
  }

  try {
    const store = await getVaultStore();
    await store.saveNetwork({
      chainId: config.chainId,
      name: networkName(config.chainId),
      factoryAddress: config.factoryAddress,
      status: "demo",
    });
    const result = await registerVault(store, createViemReader(config.rpcUrl), parsed);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status });
    return NextResponse.json({ vault: result.vault }, { status: result.duplicate ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const config = readRuntimeConfig();
  if (!config) return NextResponse.json({ error: "service_unconfigured" }, { status: 503 });

  const requested = new URL(request.url).searchParams.get("chainId");
  const chainId = requested === null ? config.chainId : parseChainId(requested);
  if (chainId === null) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (chainId !== config.chainId) return NextResponse.json({ error: "chain_mismatch" }, { status: 422 });

  try {
    const store = await getVaultStore();
    const vaults = await store.listVaults(chainId);
    return NextResponse.json({ vaults });
  } catch {
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}
