export const DEMONSTRATION_CHAIN_ID = 84532;
export const DEMONSTRATION_NETWORK = "Base Sepolia Testnet";
export const DEMONSTRATION_LABEL = "Technical demonstration";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export function isTransactionHash(value: string): boolean {
  return TX_HASH.test(value.trim());
}

export function chainLabel(chainId: number): string {
  return chainId === DEMONSTRATION_CHAIN_ID ? "Base Sepolia" : `Chain ${chainId}`;
}

export function shortenHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead + 2)}…${value.slice(-tail)}`;
}

export function assetKindLabel(kind: string): string {
  return kind === "demo_erc20" ? "Demonstration ERC-20" : kind;
}

export function verificationLabel(status: string): string {
  return status === "unverified" ? "Unverified" : status;
}
