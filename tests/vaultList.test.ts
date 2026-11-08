import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchVaults, RegistryError } from "@/components/console/api";
import type { VaultRecord } from "@/lib/vaultos/types";

const vault: VaultRecord = {
  id: "vault-1",
  chainId: 11155111,
  vaultAddress: "0x00000000000000000000000000000000000000a1",
  assetAddress: "0xf08328fe711ee112a06345383c7d5e00009641ab",
  assetSymbol: "vUSD",
  assetDecimals: 18,
  name: "Demonstration Vault",
  symbol: "vSHARE",
  deployer: "0x8ab4ea1c5843ec40eb9d2ad3e0504aaf0b3039f5",
  factoryAddress: "0x41af576177d3955fdcb1a9e074a864e6f14a9d4b",
  creationTxHash: `0x${"ab".repeat(32)}`,
  codeHash: `0x${"11".repeat(32)}`,
  implementationAddress: "0x00000000000000000000000000000000000000a1",
  kind: "demo_erc20",
  verificationStatus: "unverified",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registered vault list", () => {
  it("reads only the vaults returned by GET /api/vaults", async () => {
    const fetchMock = vi.fn(async () => Response.json({ vaults: [vault] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVaults()).resolves.toEqual([vault]);
    expect(fetchMock).toHaveBeenCalledWith("/api/vaults", { signal: undefined, cache: "no-store" });
  });

  it("returns an empty list when the registry has no vaults", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vaults: [] })));
    await expect(fetchVaults()).resolves.toEqual([]);
  });

  it("rejects a vault object the registry did not fully return", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vaults: [{ name: "Sample", symbol: "FAKE" }] })));
    await expect(fetchVaults()).rejects.toBeInstanceOf(RegistryError);
  });
});
