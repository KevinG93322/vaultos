import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, decodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";

import { factoryAbi } from "@/lib/vaultos/abi";
import { TEST_ASSET_ADDRESS, VAULT_FACTORY_ADDRESS } from "@/lib/vaultos/network";
import { ChainTransactionError, createdVaultFromLogs } from "@/lib/vaultos/sepolia";

const ACCOUNT = getAddress("0x8ab4eA1C5843ec40Eb9d2ad3e0504aaf0b3039F5");
const VAULT = getAddress("0x00000000000000000000000000000000000000a1");
const OTHER = getAddress("0x00000000000000000000000000000000000000b2");

function createdLog(asset: Address = TEST_ASSET_ADDRESS, deployer: Address = ACCOUNT, address: Address = VAULT_FACTORY_ADDRESS) {
  const topics = encodeEventTopics({
    abi: factoryAbi,
    eventName: "VaultCreated",
    args: { vault: VAULT, asset, deployer },
  }).filter((topic): topic is Hex => typeof topic === "string");
  const data = encodeAbiParameters(
    [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
    ],
    ["Demonstration Vault", "vSHARE"],
  );
  return { address, data, topics };
}

describe("createVault", () => {
  it("calls createVault(string,string) on the deployed factory", () => {
    expect(VAULT_FACTORY_ADDRESS).toBe("0x41AF576177D3955fdCb1A9e074A864E6F14A9D4B");
    const createVault = factoryAbi.find((item) => item.type === "function" && item.name === "createVault");
    expect(createVault).toMatchObject({
      inputs: [
        { name: "name_", type: "string" },
        { name: "symbol_", type: "string" },
      ],
    });
    const data = encodeFunctionData({
      abi: factoryAbi,
      functionName: "createVault",
      args: ["Demonstration Vault", "vSHARE"],
    });
    expect(decodeFunctionData({ abi: factoryAbi, data })).toMatchObject({
      functionName: "createVault",
      args: ["Demonstration Vault", "vSHARE"],
    });
  });

  it("reads the vault address from VaultCreated", () => {
    expect(createdVaultFromLogs([createdLog()], ACCOUNT)).toBe(VAULT);
  });

  it("rejects a missing event, another asset, or another deployer", () => {
    expect(() => createdVaultFromLogs([], ACCOUNT)).toThrow(ChainTransactionError);
    expect(() => createdVaultFromLogs([createdLog(OTHER)], ACCOUNT)).toThrow(/approved TestAsset/);
    expect(() => createdVaultFromLogs([createdLog(TEST_ASSET_ADDRESS, OTHER)], ACCOUNT)).toThrow(/connected wallet/);
    expect(() => createdVaultFromLogs([createdLog(TEST_ASSET_ADDRESS, ACCOUNT, OTHER)], ACCOUNT)).toThrow(
      /approved factory/,
    );
  });

  it("ignores a non-creation log from the factory", () => {
    const pinned: { address: Address; data: Hex; topics: Hex[] } = {
      address: VAULT_FACTORY_ADDRESS,
      data: "0x",
      topics: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
    };
    expect(createdVaultFromLogs([pinned, createdLog()], ACCOUNT)).toBe(VAULT);
  });
});
