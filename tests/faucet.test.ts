import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";

import { testAssetActionsAbi } from "@/lib/vaultos/abi";
import { parseTokenAmount, TEST_ASSET_ADDRESS } from "@/lib/vaultos/network";

describe("TestAsset faucet", () => {
  it("targets the deployed contract and mint(address,uint256)", () => {
    expect(TEST_ASSET_ADDRESS).toBe("0xf08328fE711EE112A06345383C7D5e00009641Ab");
    const mint = testAssetActionsAbi.find((item) => item.type === "function" && item.name === "mint");
    expect(mint).toMatchObject({
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    });
    const data = encodeFunctionData({
      abi: testAssetActionsAbi,
      functionName: "mint",
      args: [TEST_ASSET_ADDRESS, 1n],
    });
    expect(data.startsWith("0x40c10f19")).toBe(true);
  });

  it("rejects an empty mint amount before a transaction is built", () => {
    expect(parseTokenAmount("0", 18)).toBeNull();
    expect(parseTokenAmount("1", 18)).toBe(1000000000000000000n);
  });
});
