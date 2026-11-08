import { afterEach, describe, expect, it, vi } from "vitest";

import { registerDeployment, RegistryError } from "@/components/console/api";
import type { VaultRecord } from "@/lib/vaultos/types";

const TX = `0x${"ab".repeat(32)}`;

const vault: VaultRecord = {
  id: "vault-1",
  chainId: 11155111,
  vaultAddress: "0x00000000000000000000000000000000000000a1",
  assetAddress: "0xf08328fE711EE112A06345383C7D5e00009641Ab",
  assetSymbol: "vUSD",
  assetDecimals: 18,
  name: "Demonstration Vault",
  symbol: "vSHARE",
  deployer: "0x8ab4eA1C5843ec40Eb9d2ad3e0504aaf0b3039F5",
  factoryAddress: "0x41AF576177D3955fdCb1A9e074A864E6F14A9D4B",
  creationTxHash: TX,
  codeHash: `0x${"11".repeat(32)}`,
  implementationAddress: "0x00000000000000000000000000000000000000a1",
  kind: "demo_erc20",
  verificationStatus: "unverified",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registry registration request", () => {
  it("posts only the chain id and transaction hash", async () => {
    const fetchMock = vi.fn(async () => Response.json({ vault }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await registerDeployment(TX, 11155111);

    expect(result.duplicate).toBe(false);
    expect(result.vault.vaultAddress).toBe(vault.vaultAddress);
    expect(fetchMock).toHaveBeenCalledWith("/api/vaults", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chainId: 11155111, txHash: TX }),
    });
  });

  it("treats an existing registry record as a duplicate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vault }, { status: 200 })));
    await expect(registerDeployment(TX, 11155111)).resolves.toMatchObject({ duplicate: true, vault });
  });

  it("reports a registry rejection without a vault record", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "event_missing" }, { status: 422 })),
    );
    await expect(registerDeployment(TX, 11155111)).rejects.toBeInstanceOf(RegistryError);
  });
});
