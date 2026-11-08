import { getAddress, isAddress, type Address } from "viem";

import {
  DEFAULT_SEPOLIA_RPC_URL,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  isLegacyBaseConfig,
  VAULT_FACTORY_ADDRESS,
} from "@/lib/vaultos/network";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

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
  if (!databaseUrl) return null;

  // A leftover Base Sepolia env is not written back to disk. The running process uses the deployed
  // Ethereum Sepolia factory instead of that old public RPC and chain id.
  const legacy = isLegacyBaseConfig(env);
  const rpcUrl = legacy ? DEFAULT_SEPOLIA_RPC_URL : env.VAULTOS_RPC_URL?.trim() || DEFAULT_SEPOLIA_RPC_URL;
  const chainId = legacy ? ETHEREUM_SEPOLIA_CHAIN_ID : readChainId(env.VAULTOS_CHAIN_ID);
  if (chainId === null) return null;

  const factoryAddress = readFactory(env.VAULTOS_FACTORY_ADDRESS, chainId, legacy);
  if (!factoryAddress) return null;
  return { databaseUrl, rpcUrl, chainId, factoryAddress };
}

function readChainId(value: string | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return ETHEREUM_SEPOLIA_CHAIN_ID;
  const chainId = Number(raw);
  if (!Number.isInteger(chainId) || chainId <= 0) return null;
  return chainId;
}

function readFactory(value: string | undefined, chainId: number, legacy: boolean): Address | null {
  const raw = value?.trim();
  if (legacy || (chainId === ETHEREUM_SEPOLIA_CHAIN_ID && !raw)) return VAULT_FACTORY_ADDRESS;
  if (!raw || !isAddress(raw) || raw.toLowerCase() === ZERO) return null;
  const factory = getAddress(raw);
  if (chainId === ETHEREUM_SEPOLIA_CHAIN_ID && factory !== VAULT_FACTORY_ADDRESS) return null;
  return factory;
}

export function isTxHash(value: string): value is `0x${string}` {
  return TX_HASH.test(value);
}
