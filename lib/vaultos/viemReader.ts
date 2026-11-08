import { createPublicClient, decodeEventLog, http, keccak256, toEventSelector, type PublicClient } from "viem";

import { erc20MetadataAbi, factoryAbi, vaultAbi } from "@/lib/vaultos/abi";
import type { Address, ChainReader, CreatedEvent, Hash, ReceiptView } from "@/lib/vaultos/types";

const vaultCreatedTopic = toEventSelector("VaultCreated(address,address,address,string,string)");

export function createViemReader(rpcUrl: string): ChainReader {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return new ViemReader(client);
}

class ViemReader implements ChainReader {
  constructor(private readonly client: PublicClient) {}

  async getChainId(): Promise<number> {
    return this.client.getChainId();
  }

  async getReceipt(hash: Hash, factory: Address): Promise<ReceiptView | null> {
    const receipt = await this.client.getTransactionReceipt({ hash }).catch((error: unknown) => {
      if (isMissingReceipt(error)) return null;
      throw error;
    });
    if (!receipt) return null;

    const factoryAddress = factory.toLowerCase();
    const events: CreatedEvent[] = [];
    let eventInvalid = false;
    for (const log of receipt.logs) {
      if (log.topics[0] !== vaultCreatedTopic) continue;
      if (log.address.toLowerCase() !== factoryAddress) continue;
      try {
        const decoded = decodeEventLog({
          abi: factoryAbi,
          data: log.data,
          topics: log.topics,
          eventName: "VaultCreated",
        });
        events.push({
          vault: decoded.args.vault,
          asset: decoded.args.asset,
          deployer: decoded.args.deployer,
          name: decoded.args.name,
          symbol: decoded.args.symbol,
        });
      } catch {
        eventInvalid = true;
      }
    }

    return {
      status: receipt.status === "success" ? "success" : "reverted",
      to: receipt.to,
      events,
      eventInvalid,
    };
  }

  async readFactory(factory: Address) {
    const [testAsset, referenceVault, referenceCodehash] = await Promise.all([
      this.client.readContract({ address: factory, abi: factoryAbi, functionName: "testAsset" }),
      this.client.readContract({ address: factory, abi: factoryAbi, functionName: "referenceVault" }),
      this.client.readContract({ address: factory, abi: factoryAbi, functionName: "referenceCodehash" }),
    ]);
    return { testAsset, referenceVault, referenceCodehash };
  }

  async readVault(factory: Address, vault: Address) {
    const [isVault, matchesCode, asset, bytecode] = await Promise.all([
      this.client.readContract({ address: factory, abi: factoryAbi, functionName: "isVault", args: [vault] }),
      this.client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "matchesApprovedVaultCode",
        args: [vault],
      }),
      this.client.readContract({ address: vault, abi: vaultAbi, functionName: "asset" }),
      this.client.getCode({ address: vault }),
    ]);
    return {
      isVault,
      matchesCode,
      asset,
      codeHash: bytecode && bytecode !== "0x" ? keccak256(bytecode) : null,
    };
  }

  async readAssetMetadata(asset: Address) {
    const [symbol, decimals] = await Promise.all([
      this.client.readContract({ address: asset, abi: erc20MetadataAbi, functionName: "symbol" }),
      this.client.readContract({ address: asset, abi: erc20MetadataAbi, functionName: "decimals" }),
    ]);
    return { symbol, decimals };
  }
}

function isMissingReceipt(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("could not be found") || message.toLowerCase().includes("not found");
}
