import {
  createPublicClient,
  decodeEventLog,
  http,
  toEventSelector,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";

import { factoryAbi, testAssetActionsAbi, vaultActionsAbi } from "@/lib/vaultos/abi";
import {
  browserRpcUrl,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  TEST_ASSET_ADDRESS,
  VAULT_FACTORY_ADDRESS,
} from "@/lib/vaultos/network";

export type AssetSnapshot = {
  symbol: string;
  decimals: number;
  balance: bigint;
};

export type VaultPosition = {
  asset: Address;
  assetDecimals: number;
  shareDecimals: number;
  totalAssets: bigint;
  assetBalance: bigint | null;
  shareBalance: bigint | null;
  allowance: bigint | null;
  maxWithdraw: bigint | null;
  maxRedeem: bigint | null;
};

const vaultCreatedTopic = toEventSelector("VaultCreated(address,address,address,string,string)");

export class ChainTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainTransactionError";
  }
}

type ReceiptLog = {
  address: Address;
  data: Hex;
  topics: readonly Hex[];
};

let client: PublicClient | null = null;
let chainCheck: Promise<void> | null = null;

export function sepoliaPublicClient(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: sepolia,
      transport: http(browserRpcUrl()),
    });
  }
  return client;
}

export async function assertSepoliaRpc(): Promise<void> {
  if (!chainCheck) {
    chainCheck = sepoliaPublicClient()
      .getChainId()
      .then((chainId) => {
        if (chainId !== ETHEREUM_SEPOLIA_CHAIN_ID) {
          throw new Error("The reading endpoint is not Ethereum Sepolia.");
        }
      })
      .catch((error: unknown) => {
        chainCheck = null;
        throw error;
      });
  }
  await chainCheck;
}

export async function readAssetSnapshot(account: Address): Promise<AssetSnapshot> {
  await assertSepoliaRpc();
  const publicClient = sepoliaPublicClient();
  const [symbol, decimals, balance] = await Promise.all([
    publicClient.readContract({ address: TEST_ASSET_ADDRESS, abi: testAssetActionsAbi, functionName: "symbol" }),
    publicClient.readContract({ address: TEST_ASSET_ADDRESS, abi: testAssetActionsAbi, functionName: "decimals" }),
    publicClient.readContract({
      address: TEST_ASSET_ADDRESS,
      abi: testAssetActionsAbi,
      functionName: "balanceOf",
      args: [account],
    }),
  ]);
  return { symbol, decimals, balance };
}

export async function readVaultPosition(vault: Address, account: Address | null): Promise<VaultPosition> {
  await assertSepoliaRpc();
  const publicClient = sepoliaPublicClient();
  const [asset, assetDecimals, shareDecimals, totalAssets, assetBalance, shareBalance, allowance, maxWithdraw, maxRedeem] =
    await Promise.all([
      publicClient.readContract({ address: vault, abi: vaultActionsAbi, functionName: "asset" }),
      publicClient.readContract({ address: TEST_ASSET_ADDRESS, abi: testAssetActionsAbi, functionName: "decimals" }),
      publicClient.readContract({ address: vault, abi: vaultActionsAbi, functionName: "decimals" }),
      publicClient.readContract({ address: vault, abi: vaultActionsAbi, functionName: "totalAssets" }),
      account
        ? publicClient.readContract({
            address: TEST_ASSET_ADDRESS,
            abi: testAssetActionsAbi,
            functionName: "balanceOf",
            args: [account],
          })
        : Promise.resolve(null),
      account
        ? publicClient.readContract({ address: vault, abi: vaultActionsAbi, functionName: "balanceOf", args: [account] })
        : Promise.resolve(null),
      account
        ? publicClient.readContract({
            address: TEST_ASSET_ADDRESS,
            abi: testAssetActionsAbi,
            functionName: "allowance",
            args: [account, vault],
          })
        : Promise.resolve(null),
      account
        ? publicClient.readContract({ address: vault, abi: vaultActionsAbi, functionName: "maxWithdraw", args: [account] })
        : Promise.resolve(null),
      account
        ? publicClient.readContract({ address: vault, abi: vaultActionsAbi, functionName: "maxRedeem", args: [account] })
        : Promise.resolve(null),
    ]);
  return {
    asset,
    assetDecimals,
    shareDecimals,
    totalAssets,
    assetBalance,
    shareBalance,
    allowance,
    maxWithdraw,
    maxRedeem,
  };
}

export async function readAllowance(account: Address, vault: Address): Promise<bigint> {
  await assertSepoliaRpc();
  return sepoliaPublicClient().readContract({
    address: TEST_ASSET_ADDRESS,
    abi: testAssetActionsAbi,
    functionName: "allowance",
    args: [account, vault],
  });
}

export async function previewDeposit(vault: Address, assets: bigint): Promise<bigint> {
  await assertSepoliaRpc();
  return sepoliaPublicClient().readContract({
    address: vault,
    abi: vaultActionsAbi,
    functionName: "previewDeposit",
    args: [assets],
  });
}

export function createdVaultFromLogs(logs: readonly ReceiptLog[], account: Address): Address {
  const created: Address[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== VAULT_FACTORY_ADDRESS.toLowerCase()) continue;
    if (log.topics[0] !== vaultCreatedTopic) continue;
    const topics = [log.topics[0], ...log.topics.slice(1)] as [Hex, ...Hex[]];
    let decoded;
    try {
      decoded = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics,
        eventName: "VaultCreated",
      });
    } catch {
      throw new ChainTransactionError("The factory event could not be read.");
    }
    if (decoded.args.asset.toLowerCase() !== TEST_ASSET_ADDRESS.toLowerCase()) {
      throw new ChainTransactionError("The created vault does not use the approved TestAsset.");
    }
    if (decoded.args.deployer.toLowerCase() !== account.toLowerCase()) {
      throw new ChainTransactionError("The vault deployer does not match the connected wallet.");
    }
    created.push(decoded.args.vault);
  }
  if (created.length !== 1) {
    throw new ChainTransactionError("The transaction did not create a vault at the approved factory.");
  }
  return created[0];
}

export async function readCreatedVault(hash: Hash, account: Address): Promise<Address> {
  await assertSepoliaRpc();
  const receipt = await sepoliaPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new ChainTransactionError("The transaction was included on Ethereum Sepolia and it reverted.");
  }
  return createdVaultFromLogs(receipt.logs, account);
}

export async function confirmSepoliaTransaction(hash: Hash): Promise<void> {
  await assertSepoliaRpc();
  const receipt = await sepoliaPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("The transaction was included on Ethereum Sepolia and it reverted.");
  }
}

export function writeMint(wallet: WalletClient, account: Address, amount: bigint): Promise<Hash> {
  return wallet.writeContract({
    address: TEST_ASSET_ADDRESS,
    abi: testAssetActionsAbi,
    functionName: "mint",
    args: [account, amount],
    account,
    chain: sepolia,
  });
}

export function writeApprove(wallet: WalletClient, account: Address, vault: Address, amount: bigint): Promise<Hash> {
  return wallet.writeContract({
    address: TEST_ASSET_ADDRESS,
    abi: testAssetActionsAbi,
    functionName: "approve",
    args: [vault, amount],
    account,
    chain: sepolia,
  });
}

export function writeCreateVault(wallet: WalletClient, account: Address, name: string, symbol: string): Promise<Hash> {
  return wallet.writeContract({
    address: VAULT_FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "createVault",
    args: [name, symbol],
    account,
    chain: sepolia,
  });
}

export function writeDeposit(wallet: WalletClient, account: Address, vault: Address, assets: bigint): Promise<Hash> {
  return wallet.writeContract({
    address: vault,
    abi: vaultActionsAbi,
    functionName: "deposit",
    args: [assets, account],
    account,
    chain: sepolia,
  });
}

export function writeWithdraw(wallet: WalletClient, account: Address, vault: Address, assets: bigint): Promise<Hash> {
  return wallet.writeContract({
    address: vault,
    abi: vaultActionsAbi,
    functionName: "withdraw",
    args: [assets, account, account],
    account,
    chain: sepolia,
  });
}

export function writeRedeem(wallet: WalletClient, account: Address, vault: Address, shares: bigint): Promise<Hash> {
  return wallet.writeContract({
    address: vault,
    abi: vaultActionsAbi,
    functionName: "redeem",
    args: [shares, account, account],
    account,
    chain: sepolia,
  });
}
