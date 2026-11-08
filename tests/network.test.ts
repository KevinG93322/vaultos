import { describe, expect, it } from "vitest";
import { sepolia } from "viem/chains";

import { readRuntimeConfig } from "@/lib/vaultos/config";
import {
  chainIdFromWallet,
  DEFAULT_SEPOLIA_RPC_URL,
  describeWalletError,
  ETHEREUM_SEPOLIA_CHAIN_HEX,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  firstAddress,
  formatTokenAmount,
  isLegacyBaseConfig,
  parseTokenAmount,
  TEST_ASSET_ADDRESS,
  validateVaultLabels,
  VAULT_FACTORY_ADDRESS,
} from "@/lib/vaultos/network";

const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/vaultos";

describe("Ethereum Sepolia network", () => {
  it("matches the viem Sepolia chain and the deployed contracts", () => {
    expect(sepolia.id).toBe(ETHEREUM_SEPOLIA_CHAIN_ID);
    expect(Number.parseInt(ETHEREUM_SEPOLIA_CHAIN_HEX, 16)).toBe(11155111);
    expect(TEST_ASSET_ADDRESS).toBe("0xf08328fE711EE112A06345383C7D5e00009641Ab");
    expect(VAULT_FACTORY_ADDRESS).toBe("0x41AF576177D3955fdCb1A9e074A864E6F14A9D4B");
  });

  it("treats a Base Sepolia environment as legacy", () => {
    expect(
      isLegacyBaseConfig({
        VAULTOS_CHAIN_ID: "84532",
        VAULTOS_RPC_URL: "https://example.invalid",
      }),
    ).toBe(true);
    expect(isLegacyBaseConfig({ VAULTOS_RPC_URL: "https://sepolia.base.org/rpc" })).toBe(true);
    expect(isLegacyBaseConfig({ VAULTOS_CHAIN_ID: "11155111", VAULTOS_RPC_URL: "https://rpc.example" })).toBe(false);
  });

  it("configures the backend for the deployed factory", () => {
    expect(
      readRuntimeConfig({
        DATABASE_URL,
        VAULTOS_RPC_URL: "https://sepolia.base.org",
        VAULTOS_CHAIN_ID: "84532",
      }),
    ).toMatchObject({
      chainId: 11155111,
      rpcUrl: DEFAULT_SEPOLIA_RPC_URL,
      factoryAddress: VAULT_FACTORY_ADDRESS,
    });

    expect(
      readRuntimeConfig({
        DATABASE_URL,
        VAULTOS_CHAIN_ID: "11155111",
        VAULTOS_RPC_URL: "https://rpc.example",
        VAULTOS_FACTORY_ADDRESS: "0x0000000000000000000000000000000000000001",
      }),
    ).toBeNull();

    expect(
      readRuntimeConfig({
        DATABASE_URL,
        VAULTOS_CHAIN_ID: "31337",
        VAULTOS_RPC_URL: "http://127.0.0.1:8545",
        VAULTOS_FACTORY_ADDRESS: "0x0000000000000000000000000000000000000001",
      })?.chainId,
    ).toBe(31337);
  });

  it("parses wallet values and token amounts", () => {
    expect(chainIdFromWallet("0xaa36a7")).toBe(11155111);
    expect(chainIdFromWallet("0x0")).toBeNull();
    expect(firstAddress(["0xf08328fe711ee112a06345383c7d5e00009641ab"])).toBe(TEST_ASSET_ADDRESS);
    expect(firstAddress([])).toBeNull();
    expect(parseTokenAmount("1.5", 18)).toBe(1500000000000000000n);
    expect(parseTokenAmount("0", 18)).toBeNull();
    expect(parseTokenAmount("1.000", 2)).toBeNull();
    expect(formatTokenAmount(1500000000000000000n, 18)).toBe("1.5");
    expect(validateVaultLabels("", "vSHARE")).toBe("Enter a vault name.");
    expect(validateVaultLabels("Vault", "vSHARE")).toBeNull();
    expect(validateVaultLabels("Vault", "x".repeat(17))).toMatch(/16 bytes/);
  });

  it("describes wallet failures without claiming success", () => {
    expect(describeWalletError({ code: 4001 })).toBe("The wallet rejected the request.");
    expect(describeWalletError(new Error("insufficient funds for gas"))).toMatch(/Sepolia ETH/);
    expect(describeWalletError(new Error("The transaction was included on Ethereum Sepolia and it reverted."))).toMatch(
      /reverted/,
    );
  });
});
