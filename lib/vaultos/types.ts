export const DEMO_ORGANIZATION_NAME = "VaultOS Demonstration";
export const DEMO_ASSET_KIND = "demo_erc20";
export const UNVERIFIED_ASSET_STATUS = "unverified";

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

export type FailureReason =
  | "invalid_input"
  | "unknown_chain"
  | "rpc_unavailable"
  | "receipt_not_found"
  | "transaction_failed"
  | "chain_mismatch"
  | "unauthorized_factory"
  | "event_missing"
  | "event_invalid"
  | "reference_vault"
  | "not_registered"
  | "asset_mismatch"
  | "code_mismatch"
  | "chain_read_failed"
  | "database_error";

export type VaultRecord = {
  id: string;
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
  implementationAddress: string;
  kind: string;
  verificationStatus: string;
};

export type CreatedEvent = {
  vault: Address;
  asset: Address;
  deployer: Address;
  name: string;
  symbol: string;
};

export type ReceiptView = {
  status: "success" | "reverted";
  to: Address | null;
  events: CreatedEvent[];
  eventInvalid: boolean;
};

export type FactoryView = {
  testAsset: Address;
  referenceVault: Address;
  referenceCodehash: Hash;
};

export type VaultChainView = {
  isVault: boolean;
  matchesCode: boolean;
  asset: Address;
  codeHash: Hash | null;
};

export interface ChainReader {
  getChainId(): Promise<number>;
  getReceipt(hash: Hash, factory: Address): Promise<ReceiptView | null>;
  readFactory(factory: Address): Promise<FactoryView>;
  readVault(factory: Address, vault: Address): Promise<VaultChainView>;
  readAssetMetadata(asset: Address): Promise<{ symbol: string; decimals: number }>;
}

export type RegisterInput = {
  chainId: number;
  txHash: string;
};

export type RegisterResult =
  | { ok: true; duplicate: boolean; vault: VaultRecord }
  | { ok: false; status: number; reason: FailureReason };
