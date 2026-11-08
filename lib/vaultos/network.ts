import { formatUnits, getAddress, isAddress, parseUnits, type Address } from "viem";

/** Ethereum Sepolia. This is the only public network this MVP submits to. */
export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
export const ETHEREUM_SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const ETHEREUM_SEPOLIA_NAME = "Ethereum Sepolia";
export const ETHEREUM_SEPOLIA_NETWORK = "Ethereum Sepolia Testnet";
export const ETHEREUM_SEPOLIA_CURRENCY = "Sepolia ETH";
export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

/** Public read endpoint. It contains no API key. A secret RPC stays in VAULTOS_RPC_URL. */
export const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const LEGACY_BASE_SEPOLIA_CHAIN_ID = "84532";
const LEGACY_BASE_SEPOLIA_HOST = "sepolia.base.org";

export const TEST_ASSET_ADDRESS: Address = getAddress("0xf08328fE711EE112A06345383C7D5e00009641Ab");
export const VAULT_FACTORY_ADDRESS: Address = getAddress("0x41AF576177D3955fdCb1A9e074A864E6F14A9D4B");
export const DEPLOYER_ADDRESS: Address = getAddress("0x8ab4eA1C5843ec40Eb9d2ad3e0504aaf0b3039F5");

export const MAX_VAULT_NAME_BYTES = 64;
export const MAX_VAULT_SYMBOL_BYTES = 16;

export function networkName(chainId: number): string {
  return chainId === ETHEREUM_SEPOLIA_CHAIN_ID ? ETHEREUM_SEPOLIA_NAME : `Chain ${chainId}`;
}

export function browserRpcUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_VAULTOS_RPC_URL?.trim();
  return configured || DEFAULT_SEPOLIA_RPC_URL;
}

export function isLegacyBaseConfig(env: NodeJS.ProcessEnv): boolean {
  if (env.VAULTOS_CHAIN_ID?.trim() === LEGACY_BASE_SEPOLIA_CHAIN_ID) return true;
  const rpc = env.VAULTOS_RPC_URL?.trim();
  if (!rpc) return false;
  try {
    return new URL(rpc).hostname === LEGACY_BASE_SEPOLIA_HOST;
  } catch {
    return false;
  }
}

export function explorerUrl(kind: "address" | "tx", value: string): string {
  return `${SEPOLIA_EXPLORER_URL}/${kind}/${value}`;
}

export function chainIdFromWallet(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "bigint" && value > BigInt(0) && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) {
    const parsed = Number.parseInt(value, 16);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function firstAddress(value: unknown): Address | null {
  if (!Array.isArray(value) || typeof value[0] !== "string" || !isAddress(value[0])) return null;
  return getAddress(value[0]);
}

export function parseTokenAmount(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const fraction = trimmed.split(".")[1] ?? "";
  if (fraction.length > decimals) return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

export function formatTokenAmount(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals);
  if (!formatted.includes(".")) return formatted;
  return formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function validateVaultLabels(name: string, symbol: string): string | null {
  if (name.length === 0) return "Enter a vault name.";
  if (symbol.length === 0) return "Enter a share symbol.";
  if (byteLength(name) > MAX_VAULT_NAME_BYTES) return "The vault name must be 64 bytes or fewer.";
  if (byteLength(symbol) > MAX_VAULT_SYMBOL_BYTES) return "The share symbol must be 16 bytes or fewer.";
  return null;
}

export function describeWalletError(error: unknown): string {
  const code = errorCode(error);
  if (code === 4001 || code === "ACTION_REJECTED") return "The wallet rejected the request.";
  const text = errorText(error);
  if (/user rejected|user denied|rejected the request/i.test(text)) return "The wallet rejected the request.";
  if (/insufficient funds/i.test(text)) return "The wallet does not have enough Sepolia ETH to pay for gas.";
  if (code === 4902) return "Ethereum Sepolia is not available in this wallet yet.";
  if (/not ethereum sepolia/i.test(text)) return "The reading endpoint is not Ethereum Sepolia.";
  if (/included on ethereum sepolia and it reverted/i.test(text)) {
    return "The transaction was included on Ethereum Sepolia and it reverted.";
  }
  const short = shortMessage(error);
  if (short) return short;
  return "The wallet request could not be completed.";
}

export function sepoliaChainParams(rpcUrl: string) {
  return {
    chainId: ETHEREUM_SEPOLIA_CHAIN_HEX,
    chainName: ETHEREUM_SEPOLIA_NAME,
    nativeCurrency: { name: ETHEREUM_SEPOLIA_CURRENCY, symbol: "ETH", decimals: 18 },
    rpcUrls: [rpcUrl],
    blockExplorerUrls: [SEPOLIA_EXPLORER_URL],
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function errorCode(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error) return error.code;
  return undefined;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

function shortMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("shortMessage" in error)) return null;
  const message = error.shortMessage;
  return typeof message === "string" && message.trim() ? message : null;
}
