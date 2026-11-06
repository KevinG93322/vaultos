import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const networks = pgTable("networks", {
    id: uuid("id").primaryKey().defaultRandom(),
    chainId: integer("chain_id").notNull().unique(),
    name: text("name").notNull(),
    factoryAddress: text("factory_address").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
});

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    symbol: text("symbol").notNull(),
    decimals: integer("decimals").notNull(),
    kind: text("kind").notNull(),
    verificationStatus: text("verification_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("assets_chain_token_unique").on(table.chainId, table.tokenAddress),
  ],
);

// There is no proxy. implementation_address stores the vault address because
// the approved runtime code lives on that contract.
export const vaults = pgTable(
  "vaults",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    chainId: integer("chain_id").notNull(),
    vaultAddress: text("vault_address").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    implementationAddress: text("implementation_address").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    deployer: text("deployer").notNull(),
    factoryAddress: text("factory_address").notNull(),
    creationTxHash: text("creation_tx_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("vaults_chain_address_unique").on(table.chainId, table.vaultAddress),
    unique("vaults_chain_tx_unique").on(table.chainId, table.creationTxHash),
  ],
);

export const deploymentChecks = pgTable("deployment_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  txHash: text("tx_hash").notNull(),
  chainId: integer("chain_id").notNull(),
  factoryAddress: text("factory_address"),
  vaultAddress: text("vault_address"),
  status: text("status").notNull(),
  codeHash: text("code_hash"),
  eventFound: boolean("event_found").notNull().default(false),
  failureReason: text("failure_reason"),
  checkedAt: timestamp("checked_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`),
});
