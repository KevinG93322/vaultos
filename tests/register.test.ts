import { describe, expect, it } from "vitest";

import { registerVault } from "@/lib/vaultos/register";
import type { VaultStore } from "@/lib/vaultos/store";

import {
  ASSET,
  CHAIN_ID,
  CODE_HASH,
  checksFor,
  createTestDatabase,
  DEPLOYER,
  fakeReader,
  FACTORY,
  OTHER_ASSET,
  OTHER_FACTORY,
  REFERENCE,
  seedNetwork,
  TX_HASH,
  VAULT,
  validEvent,
  validReceipt,
} from "./helpers";

async function registered() {
  const database = await createTestDatabase();
  await seedNetwork(database.store);
  return database;
}

describe("vault registration", () => {
  it("registers a vault from the factory event and ignores any other address", async () => {
    const { db, store } = await registered();
    const result = await registerVault(store, fakeReader(), { chainId: CHAIN_ID, txHash: TX_HASH });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duplicate).toBe(false);
    expect(result.vault.vaultAddress).toBe(VAULT);
    expect(result.vault.assetAddress).toBe(ASSET);
    expect(result.vault.assetSymbol).toBe("vUSD");
    expect(result.vault.assetDecimals).toBe(18);
    expect(result.vault.factoryAddress).toBe(FACTORY);
    expect(result.vault.deployer).toBe(DEPLOYER);
    expect(result.vault.creationTxHash).toBe(TX_HASH);
    expect(result.vault.codeHash).toBe(CODE_HASH);
    expect(result.vault.implementationAddress).toBe(VAULT);
    expect(result.vault.kind).toBe("demo_erc20");
    expect(result.vault.verificationStatus).toBe("unverified");
    expect(result.vault).not.toHaveProperty("balance");
    expect(result.vault).not.toHaveProperty("shares");

    const listed = await store.listVaults(CHAIN_ID);
    expect(listed).toHaveLength(1);
    const found = await store.findVaultByAddress(CHAIN_ID, VAULT.toUpperCase());
    expect(found?.id).toBe(result.vault.id);
    const checks = await checksFor(db, TX_HASH);
    expect(checks.map((check) => check.status)).toEqual(["succeeded"]);
  });

  it("rejects a malformed transaction hash without writing a check", async () => {
    const { db, store } = await registered();
    const result = await registerVault(store, fakeReader(), { chainId: CHAIN_ID, txHash: "0x1234" });
    expect(result).toEqual({ ok: false, status: 400, reason: "invalid_input" });
    expect(await checksFor(db, "0x1234")).toHaveLength(0);
  });

  it("records a missing receipt", async () => {
    const { db, store } = await registered();
    const missing = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const result = await registerVault(store, fakeReader({ getReceipt: async () => null }), {
      chainId: CHAIN_ID,
      txHash: missing,
    });
    expect(result).toMatchObject({ ok: false, status: 422, reason: "receipt_not_found" });
    expect((await checksFor(db, missing))[0]?.failureReason).toBe("receipt_not_found");
  });

  it("records a reverted transaction", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({ getReceipt: async () => validReceipt({ status: "reverted", events: [] }) }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "transaction_failed" });
  });

  it("records a chain id that does not match the RPC", async () => {
    const { store } = await registered();
    const result = await registerVault(store, fakeReader({ getChainId: async () => 1 }), {
      chainId: CHAIN_ID,
      txHash: TX_HASH,
    });
    expect(result).toMatchObject({ ok: false, reason: "chain_mismatch" });
  });

  it("rejects an unknown chain before reading the receipt", async () => {
    const { store } = await createTestDatabase();
    let called = false;
    const result = await registerVault(
      store,
      fakeReader({
        getReceipt: async () => {
          called = true;
          return validReceipt();
        },
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "unknown_chain" });
    expect(called).toBe(false);
  });

  it("rejects a transaction that was not sent to the authorized factory", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({ getReceipt: async () => validReceipt({ to: OTHER_FACTORY }) }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "unauthorized_factory" });
  });

  it("rejects a contract-creation transaction", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({ getReceipt: async () => validReceipt({ to: null, events: [] }) }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "unauthorized_factory" });
  });

  it("records a missing deployment event", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({ getReceipt: async () => validReceipt({ events: [] }) }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "event_missing" });
  });

  it("records an invalid deployment event", async () => {
    const { db, store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({
        getReceipt: async () => validReceipt({ events: [validEvent(), validEvent()], eventInvalid: false }),
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "event_invalid" });
    expect((await checksFor(db, TX_HASH))[0]?.eventFound).toBe(false);
  });

  it("rejects the reference vault before treating it as unregistered", async () => {
    const { store } = await registered();
    let readVault = false;
    const result = await registerVault(
      store,
      fakeReader({
        getReceipt: async () => validReceipt({ events: [validEvent({ vault: REFERENCE })] }),
        readVault: async () => {
          readVault = true;
          return { isVault: false, matchesCode: true, asset: ASSET, codeHash: CODE_HASH };
        },
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "reference_vault" });
    expect(readVault).toBe(false);
    expect(await store.listVaults(CHAIN_ID)).toHaveLength(0);
  });

  it("rejects a vault the factory has not registered", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({
        readVault: async () => ({ isVault: false, matchesCode: true, asset: ASSET, codeHash: CODE_HASH }),
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "not_registered" });
  });

  it("rejects an asset that is not the factory's approved asset", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({
        readVault: async () => ({ isVault: true, matchesCode: true, asset: OTHER_ASSET, codeHash: CODE_HASH }),
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "asset_mismatch" });
  });

  it("rejects bytecode that does not match referenceCodehash", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({
        readVault: async () => ({
          isVault: true,
          matchesCode: true,
          asset: ASSET,
          codeHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        }),
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "code_mismatch" });
  });

  it("rejects bytecode the factory does not approve", async () => {
    const { store } = await registered();
    const result = await registerVault(
      store,
      fakeReader({
        readVault: async () => ({ isVault: true, matchesCode: false, asset: ASSET, codeHash: CODE_HASH }),
      }),
      { chainId: CHAIN_ID, txHash: TX_HASH },
    );
    expect(result).toMatchObject({ ok: false, reason: "code_mismatch" });
  });

  it("keeps a single vault when the same transaction is submitted concurrently", async () => {
    const { store } = await registered();
    const reader = fakeReader();
    const [first, second] = await Promise.all([
      registerVault(store, reader, { chainId: CHAIN_ID, txHash: TX_HASH }),
      registerVault(store, reader, { chainId: CHAIN_ID, txHash: TX_HASH }),
    ]);
    expect(first.ok && second.ok).toBe(true);
    expect(await store.listVaults(CHAIN_ID)).toHaveLength(1);
  });

  it("returns the existing vault for a duplicate transaction", async () => {
    const { db, store } = await registered();
    const reader = fakeReader();
    const first = await registerVault(store, reader, { chainId: CHAIN_ID, txHash: TX_HASH });
    const second = await registerVault(store, reader, {
      chainId: CHAIN_ID,
      txHash: `0x${TX_HASH.slice(2).toUpperCase()}`,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.duplicate).toBe(true);
    expect(second.vault.id).toBe(first.vault.id);
    expect(await store.listVaults(CHAIN_ID)).toHaveLength(1);
    expect((await checksFor(db, TX_HASH)).map((check) => check.status)).toEqual(["succeeded", "duplicate"]);
  });

  it("records a database failure and does not return the database error text", async () => {
    const { db, store } = await registered();
    const failing: VaultStore = {
      ...store,
      saveRegistration: async () => {
        throw new Error("password=secret connection reset");
      },
    };
    const result = await registerVault(failing, fakeReader(), { chainId: CHAIN_ID, txHash: TX_HASH });
    expect(result).toEqual({ ok: false, status: 500, reason: "database_error" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect((await checksFor(db, TX_HASH))[0]?.failureReason).toBe("database_error");
    expect(await store.listVaults(CHAIN_ID)).toHaveLength(0);
  });

  it("returns a database error when the registry cannot be read", async () => {
    const { store } = await registered();
    const failing: VaultStore = {
      ...store,
      findNetwork: async () => {
        throw new Error("database unavailable");
      },
    };
    const result = await registerVault(failing, fakeReader(), { chainId: CHAIN_ID, txHash: TX_HASH });
    expect(result).toEqual({ ok: false, status: 500, reason: "database_error" });
  });
});
