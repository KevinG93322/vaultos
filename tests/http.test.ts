import { describe, expect, it } from "vitest";

import { parseChainId, parseRegistrationBody, parseVaultAddress } from "@/lib/vaultos/http";

const TX = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("registration input", () => {
  it("accepts only a chain id and transaction hash", () => {
    expect(parseRegistrationBody({ chainId: 11155111, txHash: TX })).toEqual({
      ok: true,
      chainId: 11155111,
      txHash: TX,
    });
  });

  it("rejects a client-supplied vault address", () => {
    expect(
      parseRegistrationBody({
        chainId: 11155111,
        txHash: TX,
        vaultAddress: "0x0000000000000000000000000000000000000001",
      }),
    ).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("rejects malformed hashes, chain ids, and addresses", () => {
    expect(parseRegistrationBody({ chainId: 11155111, txHash: "0x1234" }).ok).toBe(false);
    expect(parseRegistrationBody({ chainId: 1.5, txHash: TX }).ok).toBe(false);
    expect(parseRegistrationBody(null).ok).toBe(false);
    expect(parseChainId("0")).toBeNull();
    expect(parseChainId("11155111")).toBe(11155111);
    expect(parseVaultAddress("not-an-address")).toBeNull();
  });
});
