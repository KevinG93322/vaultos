import { isAddress, type Address } from "viem";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export type RuntimeConfig = {
  databaseUrl: string;
  rpcUrl: string;
  chainId: number;
  factoryAddress: Address;
};

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.DATABASE_URL?.trim();
  return value ? value : null;
}

export function readRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig | null {
  const databaseUrl = readDatabaseUrl(env);
  const rpcUrl = env.VAULTOS_RPC_URL?.trim();
  const chainId = Number(env.VAULTOS_CHAIN_ID);
  const factoryAddress = env.VAULTOS_FACTORY_ADDRESS?.trim();
  if (!databaseUrl || !rpcUrl || !Number.isInteger(chainId) || chainId <= 0) return null;
  if (!factoryAddress || !isAddress(factoryAddress) || factoryAddress === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return {
    databaseUrl,
    rpcUrl,
    chainId,
    factoryAddress,
  };
}

export function isTxHash(value: string): value is `0x${string}` {
  return TX_HASH.test(value);
}
