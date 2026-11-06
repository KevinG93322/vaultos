import type { VaultRecord } from "@/lib/vaultos/types";

export class RegistryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "RegistryError";
    this.code = code;
    this.status = status;
  }
}

export async function fetchVaults(signal?: AbortSignal): Promise<VaultRecord[]> {
  const body = await readJson("/api/vaults", { signal });
  if (!Array.isArray(body.vaults) || !body.vaults.every(isVaultRecord)) {
    throw new RegistryError("invalid_response", 500);
  }
  return body.vaults;
}

export async function fetchVault(address: string, signal?: AbortSignal): Promise<VaultRecord> {
  const body = await readJson(`/api/vaults/${encodeURIComponent(address)}`, { signal });
  if (!isVaultRecord(body.vault)) throw new RegistryError("invalid_response", 500);
  return body.vault;
}

export async function registerDeployment(txHash: string, chainId: number): Promise<{
  vault: VaultRecord;
  duplicate: boolean;
}> {
  const response = await fetch("/api/vaults", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId, txHash }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = errorCode(body) ?? "request_failed";
    throw new RegistryError(code, response.status);
  }
  if (!isRecord(body) || !isVaultRecord(body.vault)) {
    throw new RegistryError("invalid_response", response.status);
  }
  return { vault: body.vault, duplicate: response.status === 200 };
}

async function readJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new RegistryError("network", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new RegistryError(errorCode(body) ?? "request_failed", response.status);
  if (!isRecord(body)) throw new RegistryError("invalid_response", response.status);
  return body;
}

function errorCode(body: unknown): string | null {
  return isRecord(body) && typeof body.error === "string" ? body.error : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVaultRecord(value: unknown): value is VaultRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.chainId === "number" &&
    typeof value.vaultAddress === "string" &&
    typeof value.assetAddress === "string" &&
    typeof value.assetSymbol === "string" &&
    typeof value.assetDecimals === "number" &&
    typeof value.name === "string" &&
    typeof value.symbol === "string" &&
    typeof value.deployer === "string" &&
    typeof value.factoryAddress === "string" &&
    typeof value.creationTxHash === "string" &&
    typeof value.codeHash === "string" &&
    typeof value.implementationAddress === "string" &&
    typeof value.kind === "string" &&
    typeof value.verificationStatus === "string"
  );
}
