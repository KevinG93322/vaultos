import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import { schemaSql } from "@/db/schema.sql";
import { deploymentChecks } from "@/db/schema";
import { createVaultStore, type AppDatabase, type VaultStore } from "@/lib/vaultos/store";
import type { Address, ChainReader, CreatedEvent, Hash, ReceiptView } from "@/lib/vaultos/types";

export const CHAIN_ID = 31337;
export const FACTORY = "0x00000000000000000000000000000000000000a1" as Address;
export const OTHER_FACTORY = "0x00000000000000000000000000000000000000a2" as Address;
export const ASSET = "0x00000000000000000000000000000000000000b1" as Address;
export const OTHER_ASSET = "0x00000000000000000000000000000000000000b2" as Address;
export const VAULT = "0x00000000000000000000000000000000000000c1" as Address;
export const REFERENCE = "0x00000000000000000000000000000000000000d1" as Address;
export const DEPLOYER = "0x00000000000000000000000000000000000000e1" as Address;
export const CODE_HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as Hash;
export const TX_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hash;

export async function createTestDatabase() {
  const client = new PGlite();
  await client.exec(schemaSql);
  const db = drizzle(client, { schema }) as unknown as AppDatabase;
  const store = createVaultStore(db);
  return { client, db, store };
}

export async function seedNetwork(store: VaultStore, factory: Address = FACTORY, chainId = CHAIN_ID) {
  await store.saveNetwork({
    chainId,
    name: "Anvil",
    factoryAddress: factory,
    status: "demo",
  });
}

export function validReceipt(overrides: Partial<ReceiptView> = {}): ReceiptView {
  return {
    status: "success",
    to: FACTORY,
    eventInvalid: false,
    events: [validEvent()],
    ...overrides,
  };
}

export function validEvent(overrides: Partial<CreatedEvent> = {}): CreatedEvent {
  return {
    vault: VAULT,
    asset: ASSET,
    deployer: DEPLOYER,
    name: "Customer Vault",
    symbol: "CUST",
    ...overrides,
  };
}

export function fakeReader(overrides: Partial<ChainReader> = {}): ChainReader {
  return {
    getChainId: async () => CHAIN_ID,
    getReceipt: async () => validReceipt(),
    readFactory: async () => ({
      testAsset: ASSET,
      referenceVault: REFERENCE,
      referenceCodehash: CODE_HASH,
    }),
    readVault: async () => ({
      isVault: true,
      matchesCode: true,
      asset: ASSET,
      codeHash: CODE_HASH,
    }),
    readAssetMetadata: async () => ({ symbol: "vUSD", decimals: 18 }),
    ...overrides,
  };
}

export async function checksFor(db: AppDatabase, txHash: string) {
  return db.select().from(deploymentChecks).where(eq(deploymentChecks.txHash, txHash.toLowerCase()));
}
