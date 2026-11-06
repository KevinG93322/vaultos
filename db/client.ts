import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { schemaSql } from "@/db/schema.sql";
import { readDatabaseUrl } from "@/lib/vaultos/config";
import { createVaultStore, type VaultStore } from "@/lib/vaultos/store";

type Database = PostgresJsDatabase<typeof schema>;

let storePromise: Promise<VaultStore> | null = null;

export function getVaultStore(): Promise<VaultStore> {
  const databaseUrl = readDatabaseUrl();
  if (!databaseUrl) {
    return Promise.reject(new Error("DATABASE_URL is not configured"));
  }
  storePromise ??= openStore(databaseUrl).catch((error: unknown) => {
    storePromise = null;
    throw error;
  });
  return storePromise;
}

async function openStore(databaseUrl: string): Promise<VaultStore> {
  const client = postgres(databaseUrl, { max: 5 });
  await client.unsafe(schemaSql);
  const db: Database = drizzle(client, { schema });
  return createVaultStore(db);
}
