import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { assets, deploymentChecks, networks, organizations, vaults } from "@/db/schema";
import { DEMO_ASSET_KIND, DEMO_ORGANIZATION_NAME, UNVERIFIED_ASSET_STATUS, type FailureReason, type VaultRecord } from "@/lib/vaultos/types";

export type AppDatabase = PostgresJsDatabase<typeof import("@/db/schema")>;

export type CheckInput = {
  txHash: string;
  chainId: number;
  factoryAddress: string | null;
  vaultAddress: string | null;
  status: "failed" | "succeeded" | "duplicate";
  codeHash: string | null;
  eventFound: boolean;
  failureReason: FailureReason | null;
};

export type NewVault = {
  chainId: number;
  vaultAddress: string;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  name: string;
  symbol: string;
  deployer: string;
  factoryAddress: string;
  creationTxHash: string;
  codeHash: string;
};

export class UniqueViolation extends Error {
  constructor() {
    super("unique violation");
    this.name = "UniqueViolation";
  }
}

export type NetworkRecord = {
  chainId: number;
  name: string;
  factoryAddress: string;
  status: string;
};

export function createVaultStore(db: AppDatabase) {
  return {
    async findNetwork(chainId: number): Promise<NetworkRecord | null> {
      const rows = await db.select().from(networks).where(eq(networks.chainId, chainId)).limit(1);
      const row = rows[0];
      return row
        ? {
            chainId: row.chainId,
            name: row.name,
            factoryAddress: row.factoryAddress,
            status: row.status,
          }
        : null;
    },

    async saveNetwork(input: NetworkRecord): Promise<void> {
      await db
        .insert(networks)
        .values({
          chainId: input.chainId,
          name: input.name,
          factoryAddress: input.factoryAddress.toLowerCase(),
          status: input.status,
        })
        .onConflictDoUpdate({
          target: networks.chainId,
          set: {
            name: input.name,
            factoryAddress: input.factoryAddress.toLowerCase(),
            status: input.status,
          },
        });
    },

    async findVaultByTx(chainId: number, txHash: string): Promise<VaultRecord | null> {
      return findBy(db, eq(vaults.creationTxHash, txHash.toLowerCase()), chainId);
    },

    async findVaultByAddress(chainId: number, vaultAddress: string): Promise<VaultRecord | null> {
      return findBy(db, eq(vaults.vaultAddress, vaultAddress.toLowerCase()), chainId);
    },

    async listVaults(chainId: number): Promise<VaultRecord[]> {
      const rows = await db
        .select(vaultSelection())
        .from(vaults)
        .innerJoin(assets, eq(vaults.assetId, assets.id))
        .where(eq(vaults.chainId, chainId))
        .orderBy(vaults.createdAt);
      return rows;
    },

    async recordCheck(input: CheckInput): Promise<void> {
      await db.insert(deploymentChecks).values({
        txHash: input.txHash.toLowerCase(),
        chainId: input.chainId,
        factoryAddress: input.factoryAddress,
        vaultAddress: input.vaultAddress,
        status: input.status,
        codeHash: input.codeHash,
        eventFound: input.eventFound,
        failureReason: input.failureReason,
      });
    },

    async saveRegistration(input: NewVault): Promise<VaultRecord> {
      try {
        return await db.transaction(async (tx) => {
          const [organization] = await tx
            .insert(organizations)
            .values({ name: DEMO_ORGANIZATION_NAME })
            .onConflictDoUpdate({
              target: organizations.name,
              set: { name: DEMO_ORGANIZATION_NAME },
            })
            .returning();

          const [asset] = await tx
            .insert(assets)
            .values({
              organizationId: organization.id,
              chainId: input.chainId,
              tokenAddress: input.assetAddress.toLowerCase(),
              symbol: input.assetSymbol,
              decimals: input.assetDecimals,
              kind: DEMO_ASSET_KIND,
              verificationStatus: UNVERIFIED_ASSET_STATUS,
            })
            .onConflictDoUpdate({
              target: [assets.chainId, assets.tokenAddress],
              set: { symbol: input.assetSymbol, decimals: input.assetDecimals },
            })
            .returning();

          const [vault] = await tx
            .insert(vaults)
            .values({
              organizationId: organization.id,
              chainId: input.chainId,
              vaultAddress: input.vaultAddress.toLowerCase(),
              assetId: asset.id,
              implementationAddress: input.vaultAddress.toLowerCase(),
              name: input.name,
              symbol: input.symbol,
              deployer: input.deployer.toLowerCase(),
              factoryAddress: input.factoryAddress.toLowerCase(),
              creationTxHash: input.creationTxHash.toLowerCase(),
              codeHash: input.codeHash.toLowerCase(),
            })
            .returning();

          await tx.insert(deploymentChecks).values({
            txHash: input.creationTxHash.toLowerCase(),
            chainId: input.chainId,
            factoryAddress: input.factoryAddress.toLowerCase(),
            vaultAddress: input.vaultAddress.toLowerCase(),
            status: "succeeded",
            codeHash: input.codeHash.toLowerCase(),
            eventFound: true,
            failureReason: null,
          });

          return toRecord(vault, input.assetAddress, input.assetSymbol, input.assetDecimals);
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new UniqueViolation();
        throw error;
      }
    },
  };
}

export type VaultStore = ReturnType<typeof createVaultStore>;

function vaultSelection() {
  return {
    id: vaults.id,
    chainId: vaults.chainId,
    vaultAddress: vaults.vaultAddress,
    assetAddress: assets.tokenAddress,
    assetSymbol: assets.symbol,
    assetDecimals: assets.decimals,
    name: vaults.name,
    symbol: vaults.symbol,
    deployer: vaults.deployer,
    factoryAddress: vaults.factoryAddress,
    creationTxHash: vaults.creationTxHash,
    codeHash: vaults.codeHash,
    implementationAddress: vaults.implementationAddress,
    kind: assets.kind,
    verificationStatus: assets.verificationStatus,
  };
}

async function findBy(
  db: AppDatabase,
  match: ReturnType<typeof eq>,
  chainId: number,
): Promise<VaultRecord | null> {
  const rows = await db
    .select(vaultSelection())
    .from(vaults)
    .innerJoin(assets, eq(vaults.assetId, assets.id))
    .where(and(eq(vaults.chainId, chainId), match))
    .limit(1);
  return rows[0] ?? null;
}

function toRecord(
  vault: typeof vaults.$inferSelect,
  assetAddress: string,
  assetSymbol: string,
  assetDecimals: number,
): VaultRecord {
  return {
    id: vault.id,
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress,
    assetAddress: assetAddress.toLowerCase(),
    assetSymbol,
    assetDecimals,
    name: vault.name,
    symbol: vault.symbol,
    deployer: vault.deployer,
    factoryAddress: vault.factoryAddress,
    creationTxHash: vault.creationTxHash,
    codeHash: vault.codeHash,
    implementationAddress: vault.implementationAddress,
    kind: DEMO_ASSET_KIND,
    verificationStatus: UNVERIFIED_ASSET_STATUS,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && (current as { code?: unknown }).code === "23505") return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}
