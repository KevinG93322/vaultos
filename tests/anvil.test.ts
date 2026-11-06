import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { factoryAbi } from "@/lib/vaultos/abi";
import { registerVault } from "@/lib/vaultos/register";
import { createViemReader } from "@/lib/vaultos/viemReader";

import { createTestDatabase, seedNetwork } from "./helpers";

const PORT = 18545;
const RPC = `http://127.0.0.1:${PORT}`;
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const testAssetAbi = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
] as const;

const factoryDeployAbi = [
  {
    type: "constructor",
    inputs: [{ name: "testAsset_", type: "address" }],
    stateMutability: "nonpayable",
  },
  ...factoryAbi,
] as const;

let anvil: ChildProcess | undefined;
let asset: Address;
let factory: Address;
let otherFactory: Address;
let referenceVault: Address;
let creationTx: Hex;
let revertedTx: Hex;
let eventlessTx: Hex;
let otherFactoryTx: Hex;

const account = privateKeyToAccount(ANVIL_KEY);
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC) });

describe("anvil deployment verification", () => {
  beforeAll(async () => {
    anvil = spawn(anvilPath(), ["--host", "127.0.0.1", "--port", String(PORT), "--chain-id", "31337"], {
      stdio: "ignore",
    });
    await waitForPort(PORT);
    const assetBytecode = await artifactBytecode("TestAsset.sol/TestAsset.json");
    const factoryBytecode = await artifactBytecode("VaultFactory.sol/VaultFactory.json");

    asset = await deploy(testAssetAbi, assetBytecode);
    factory = await deploy(factoryDeployAbi, factoryBytecode, [asset]);
    otherFactory = await deploy(factoryDeployAbi, factoryBytecode, [asset]);
    referenceVault = await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "referenceVault",
    });

    creationTx = await wallet.writeContract({
      address: factory,
      abi: factoryAbi,
      functionName: "createVault",
      args: ["Customer One", "C1"],
    });
    await publicClient.waitForTransactionReceipt({ hash: creationTx });

    const fees = await publicClient.estimateFeesPerGas();
    const signedRevert = await account.signTransaction({
      chainId: foundry.id,
      to: factory,
      data: encodeFunctionData({ abi: factoryAbi, functionName: "createVault", args: ["", "X"] }),
      gas: BigInt(1000000),
      nonce: await publicClient.getTransactionCount({ address: account.address }),
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    revertedTx = await publicClient.sendRawTransaction({ serializedTransaction: signedRevert });
    await publicClient.waitForTransactionReceipt({ hash: revertedTx });

    eventlessTx = await wallet.sendTransaction({
      to: factory,
      data: encodeFunctionData({ abi: factoryAbi, functionName: "testAsset" }),
    });
    await publicClient.waitForTransactionReceipt({ hash: eventlessTx });

    otherFactoryTx = await wallet.writeContract({
      address: otherFactory,
      abi: factoryAbi,
      functionName: "createVault",
      args: ["Other", "OTH"],
    });
    await publicClient.waitForTransactionReceipt({ hash: otherFactoryTx });
  }, 120000);

  afterAll(() => {
    anvil?.kill();
  });

  it("confirms the reference vault is not a customer vault", async () => {
    const registered = await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "isVault",
      args: [referenceVault],
    });
    expect(registered).toBe(false);
  });

  it("registers a factory-created vault and rejects the same transaction again", async () => {
    const { store } = await createTestDatabase();
    await seedNetwork(store, factory);
    const reader = createViemReader(RPC);
    const created = await registerVault(store, reader, { chainId: 31337, txHash: creationTx });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.duplicate).toBe(false);
    expect(created.vault.assetAddress).toBe(asset.toLowerCase());
    expect(created.vault.factoryAddress).toBe(factory.toLowerCase());
    expect(created.vault.vaultAddress).not.toBe(referenceVault.toLowerCase());

    const duplicate = await registerVault(store, reader, { chainId: 31337, txHash: creationTx });
    expect(duplicate.ok && duplicate.duplicate).toBe(true);
    expect(await store.listVaults(31337)).toHaveLength(1);
  });

  it("rejects a reverted factory transaction", async () => {
    const { store } = await createTestDatabase();
    await seedNetwork(store, factory);
    const result = await registerVault(store, createViemReader(RPC), {
      chainId: 31337,
      txHash: revertedTx,
    });
    expect(result).toMatchObject({ ok: false, reason: "transaction_failed" });
    expect(await store.listVaults(31337)).toHaveLength(0);
  });

  it("rejects the RPC chain id when the request names another chain", async () => {
    const { store } = await createTestDatabase();
    await seedNetwork(store, factory, 1);
    const result = await registerVault(store, createViemReader(RPC), { chainId: 1, txHash: creationTx });
    expect(result).toMatchObject({ ok: false, reason: "chain_mismatch" });
  });

  it("rejects a vault created by a different factory", async () => {
    const { store } = await createTestDatabase();
    await seedNetwork(store, factory);
    const result = await registerVault(store, createViemReader(RPC), {
      chainId: 31337,
      txHash: otherFactoryTx,
    });
    expect(result).toMatchObject({ ok: false, reason: "unauthorized_factory" });
  });

  it("rejects a successful factory transaction that did not emit VaultCreated", async () => {
    const { store } = await createTestDatabase();
    await seedNetwork(store, factory);
    const result = await registerVault(store, createViemReader(RPC), {
      chainId: 31337,
      txHash: eventlessTx,
    });
    expect(result).toMatchObject({ ok: false, reason: "event_missing" });
  });
});

async function deploy(abi: readonly unknown[], bytecode: Hex, args: readonly Address[] = []): Promise<Address> {
  const hash = await wallet.deployContract({
    abi: abi as never,
    bytecode,
    args: args as never,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("deployment receipt has no contract address");
  return receipt.contractAddress;
}

async function artifactBytecode(artifact: string): Promise<Hex> {
  const file = await readFile(path.resolve("contracts/out", artifact), "utf8");
  const parsed = JSON.parse(file) as { bytecode: { object: Hex } };
  return parsed.bytecode.object;
}

function anvilPath(): string {
  return path.join(process.env.USERPROFILE ?? "", ".foundry", "bin", "anvil.exe");
}

function waitForPort(port: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > 20000) reject(new Error(`anvil did not listen on ${port}`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}
