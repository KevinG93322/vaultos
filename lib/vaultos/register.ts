import { getAddress, isAddress } from "viem";

import { isTxHash } from "@/lib/vaultos/config";
import { UniqueViolation, type VaultStore } from "@/lib/vaultos/store";
import type {
  Address,
  ChainReader,
  FailureReason,
  Hash,
  RegisterInput,
  RegisterResult,
  VaultRecord,
} from "@/lib/vaultos/types";

const ZERO = "0x0000000000000000000000000000000000000000";

export async function registerVault(
  store: VaultStore,
  reader: ChainReader,
  input: RegisterInput,
): Promise<RegisterResult> {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0 || !isTxHash(input.txHash)) {
    return { ok: false, status: 400, reason: "invalid_input" };
  }

  const txHash = input.txHash.toLowerCase() as Hash;
  let eventFound = false;
  let vaultAddress: string | null = null;
  let codeHash: string | null = null;
  let factory: string | null = null;

  const fail = async (status: number, reason: FailureReason): Promise<RegisterResult> => {
    try {
      await store.recordCheck({
        txHash,
        chainId: input.chainId,
        factoryAddress: factory,
        vaultAddress,
        status: "failed",
        codeHash,
        eventFound,
        failureReason: reason,
      });
    } catch {
      return { ok: false, status: 500, reason: "database_error" };
    }
    return { ok: false, status, reason };
  };

  let network;
  try {
    network = await store.findNetwork(input.chainId);
  } catch {
    return { ok: false, status: 500, reason: "database_error" };
  }
  if (!network || !isAddress(network.factoryAddress)) return fail(422, "unknown_chain");
  factory = getAddress(network.factoryAddress).toLowerCase();

  let existing;
  try {
    existing = await store.findVaultByTx(input.chainId, txHash);
  } catch {
    return { ok: false, status: 500, reason: "database_error" };
  }
  if (existing) return duplicate(store, input.chainId, txHash, existing);

  let rpcChainId: number;
  try {
    rpcChainId = await reader.getChainId();
  } catch {
    return fail(503, "rpc_unavailable");
  }
  if (rpcChainId !== input.chainId) return fail(422, "chain_mismatch");

  let receipt;
  try {
    receipt = await reader.getReceipt(txHash, factory as Address);
  } catch {
    return fail(503, "rpc_unavailable");
  }
  if (!receipt) return fail(422, "receipt_not_found");
  if (receipt.status !== "success") return fail(422, "transaction_failed");
  if (receipt.eventInvalid || receipt.events.length > 1) return fail(422, "event_invalid");
  if (receipt.events.length === 0) {
    if (!receipt.to || receipt.to.toLowerCase() !== factory) return fail(422, "unauthorized_factory");
    return fail(422, "event_missing");
  }

  const created = receipt.events[0];
  eventFound = true;
  if (
    !isAddress(created.vault) ||
    !isAddress(created.asset) ||
    !isAddress(created.deployer) ||
    created.vault.toLowerCase() === ZERO ||
    created.name.length === 0 ||
    created.symbol.length === 0
  ) {
    return fail(422, "event_invalid");
  }
  vaultAddress = created.vault.toLowerCase();

  let factoryState;
  try {
    factoryState = await reader.readFactory(factory as Address);
  } catch {
    return fail(503, "chain_read_failed");
  }
  if (created.vault.toLowerCase() === factoryState.referenceVault.toLowerCase()) {
    return fail(422, "reference_vault");
  }

  let vaultState;
  try {
    vaultState = await reader.readVault(factory as Address, created.vault);
  } catch {
    return fail(503, "chain_read_failed");
  }
  codeHash = vaultState.codeHash?.toLowerCase() ?? null;
  if (!vaultState.isVault) return fail(422, "not_registered");

  const approved = factoryState.testAsset.toLowerCase();
  if (
    created.asset.toLowerCase() !== approved ||
    vaultState.asset.toLowerCase() !== approved
  ) {
    return fail(422, "asset_mismatch");
  }
  if (
    !vaultState.codeHash ||
    vaultState.codeHash.toLowerCase() !== factoryState.referenceCodehash.toLowerCase() ||
    !vaultState.matchesCode
  ) {
    return fail(422, "code_mismatch");
  }

  let metadata;
  try {
    metadata = await reader.readAssetMetadata(factoryState.testAsset);
  } catch {
    return fail(503, "chain_read_failed");
  }

  try {
    const vault = await store.saveRegistration({
      chainId: input.chainId,
      vaultAddress: created.vault,
      assetAddress: factoryState.testAsset,
      assetSymbol: metadata.symbol,
      assetDecimals: metadata.decimals,
      name: created.name,
      symbol: created.symbol,
      deployer: created.deployer,
      factoryAddress: factory,
      creationTxHash: txHash,
      codeHash: vaultState.codeHash,
    });
    return { ok: true, duplicate: false, vault };
  } catch (error) {
    if (error instanceof UniqueViolation) {
      try {
        const raced =
          (await store.findVaultByTx(input.chainId, txHash)) ??
          (await store.findVaultByAddress(input.chainId, created.vault));
        if (raced) return duplicate(store, input.chainId, txHash, raced);
      } catch {
        return { ok: false, status: 500, reason: "database_error" };
      }
    }
    return fail(500, "database_error");
  }
}

async function duplicate(
  store: VaultStore,
  chainId: number,
  txHash: Hash,
  vault: VaultRecord,
): Promise<RegisterResult> {
  try {
    await store.recordCheck({
      txHash,
      chainId,
      factoryAddress: vault.factoryAddress,
      vaultAddress: vault.vaultAddress,
      status: "duplicate",
      codeHash: vault.codeHash,
      eventFound: true,
      failureReason: null,
    });
  } catch {
    return { ok: false, status: 500, reason: "database_error" };
  }
  return { ok: true, duplicate: true, vault };
}
