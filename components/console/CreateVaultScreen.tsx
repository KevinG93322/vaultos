"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import type { Address, Hash } from "viem";

import type { VaultRecord } from "@/lib/vaultos/types";
import {
  describeWalletError,
  TEST_ASSET_ADDRESS,
  VAULT_FACTORY_ADDRESS,
  validateVaultLabels,
} from "@/lib/vaultos/network";
import { ChainTransactionError, readCreatedVault, writeCreateVault } from "@/lib/vaultos/sepolia";

import { registerDeployment, RegistryError } from "./api";
import { ChainLink } from "./ChainLink";
import { DemoAssetPanel } from "./DemoAssetPanel";
import { DEMONSTRATION_CHAIN_ID, DEMONSTRATION_NETWORK } from "./demonstration";
import { registryMessage } from "./messages";
import { PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";
import { TxNotice, type TxState } from "./TxNotice";
import { useWallet } from "./wallet";

type CreatedVault = { hash: Hash; vault: Address };
type Registration =
  | { status: "registered"; vault: VaultRecord; duplicate: boolean }
  | { status: "error"; message: string };

export function CreateVaultScreen() {
  return (
    <>
      <PageHeader
        title="Create Vault"
        lede="Create a vault from your wallet on Ethereum Sepolia. After the transaction confirms, the registry verifies it and stores the vault. VaultOS does not hold the wallet key."
      />
      <DemoAssetPanel />
      <CreateForm />
    </>
  );
}

function CreateForm() {
  const nameId = useId();
  const symbolId = useId();
  const wallet = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [created, setCreated] = useState<CreatedVault | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const pending = useRef(false);
  const busy = tx.kind === "signing" || tx.kind === "confirming" || registering;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setCreated(null);
    setRegistration(null);
    setClientError(null);
    const nextName = name.trim();
    const nextSymbol = symbol.trim();
    const labelError = validateVaultLabels(nextName, nextSymbol);
    if (labelError) {
      setClientError(labelError);
      return;
    }
    if (!wallet.onSepolia || !wallet.walletClient || !wallet.address) {
      setClientError("Connect a wallet on Ethereum Sepolia before creating a vault.");
      return;
    }
    const account = wallet.address;
    pending.current = true;
    setTx({ kind: "signing", label: "Create vault" });
    try {
      const hash = await writeCreateVault(wallet.walletClient, account, nextName, nextSymbol);
      setTx({ kind: "confirming", label: "Create vault", hash });
      const vault = await readCreatedVault(hash, account);
      setTx({ kind: "success", label: "Create vault", hash });
      setCreated({ hash, vault });
      setRegistering(true);
      try {
        const result = await registerDeployment(hash, DEMONSTRATION_CHAIN_ID);
        setRegistration({ status: "registered", vault: result.vault, duplicate: result.duplicate });
      } catch (error) {
        const code = error instanceof RegistryError ? error.code : "network";
        setRegistration({
          status: "error",
          message: `The vault transaction was confirmed, and the registry did not store it. ${registryMessage(code)}`,
        });
      } finally {
        setRegistering(false);
      }
    } catch (error) {
      setTx({ kind: "error", message: creationError(error) });
    } finally {
      pending.current = false;
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="create-heading">
      <h2 id="create-heading">Create from your wallet</h2>
      <p className={styles.muted}>
        {DEMONSTRATION_NETWORK} · chain id {DEMONSTRATION_CHAIN_ID}. The wallet calls createVault. The factory chooses
        the vault address.
      </p>
      <dl className={styles.fields}>
        <div>
          <dt>Factory</dt>
          <dd>
            <ChainLink kind="address" value={VAULT_FACTORY_ADDRESS}>
              <code>{VAULT_FACTORY_ADDRESS}</code>
            </ChainLink>
          </dd>
        </div>
        <div>
          <dt>Underlying asset</dt>
          <dd>
            <ChainLink kind="address" value={TEST_ASSET_ADDRESS}>
              <code>{TEST_ASSET_ADDRESS}</code>
            </ChainLink>
          </dd>
        </div>
      </dl>
      <p className={styles.help}>This factory wraps the approved vUSD token only. The form cannot choose another asset.</p>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={nameId}>Vault name</label>
          <input
            id={nameId}
            className={`${styles.input} ${styles.textInput}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            aria-invalid={clientError ? true : undefined}
            disabled={!wallet.onSepolia || busy}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={symbolId}>Share symbol</label>
          <input
            id={symbolId}
            className={styles.input}
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={clientError ? true : undefined}
            disabled={!wallet.onSepolia || busy}
          />
          <p className={styles.help}>The name can be 64 bytes and the symbol 16 bytes.</p>
        </div>
        {wallet.onSepolia ? null : (
          <p className={styles.help}>Connect a wallet on Ethereum Sepolia to create a vault.</p>
        )}
        {clientError ? (
          <p className={styles.formError} role="alert">
            {clientError}
          </p>
        ) : null}
        <button type="submit" className={styles.primaryButton} disabled={busy || !wallet.onSepolia}>
          {registering ? "Registering vault" : busy ? "Creating vault" : "Create vault"}
        </button>
        <TxNotice state={tx} />
      </form>
      {registering ? (
        <p className={styles.help} role="status">
          The creation transaction is confirmed. The registry is verifying it.
        </p>
      ) : null}
      {registration?.status === "error" ? (
        <p className={styles.formError} role="alert">
          {registration.message}
        </p>
      ) : null}
      {registration?.status === "registered" ? (
        <div className={styles.result} role="status">
          <h3>{registration.duplicate ? "Already registered" : "Vault registered"}</h3>
          <p>
            {registration.duplicate
              ? "This transaction was already in the registry. No second record was saved."
              : "The registry verified the factory event and stored the vault."}
          </p>
          <dl className={styles.fields}>
            <div>
              <dt>Transaction</dt>
              <dd>
                <ChainLink kind="tx" value={registration.vault.creationTxHash}>
                  <code>{registration.vault.creationTxHash}</code>
                </ChainLink>
              </dd>
            </div>
            <div>
              <dt>Registered vault</dt>
              <dd>
                <Link href={`/vaults/${registration.vault.vaultAddress}`}>{registration.vault.name}</Link>
                <br />
                <ChainLink kind="address" value={registration.vault.vaultAddress}>
                  <code>{registration.vault.vaultAddress}</code>
                </ChainLink>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      {created ? (
        <div className={styles.result} role="status">
          <h3>Vault created</h3>
          <p>The factory emitted VaultCreated for this transaction.</p>
          <dl className={styles.fields}>
            <div>
              <dt>Transaction</dt>
              <dd>
                <ChainLink kind="tx" value={created.hash}>
                  <code>{created.hash}</code>
                </ChainLink>
              </dd>
            </div>
            <div>
              <dt>Vault in the transaction event</dt>
              <dd>
                <ChainLink kind="address" value={created.vault}>
                  <code>{created.vault}</code>
                </ChainLink>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function creationError(error: unknown): string {
  if (error instanceof ChainTransactionError) return error.message;
  return describeWalletError(error);
}
