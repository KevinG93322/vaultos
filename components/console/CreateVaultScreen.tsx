"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import type { VaultRecord } from "@/lib/vaultos/types";

import { registerDeployment, RegistryError } from "./api";
import { DEMONSTRATION_CHAIN_ID, DEMONSTRATION_NETWORK, isTransactionHash } from "./demonstration";
import { registryMessage } from "./messages";
import { PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";

type Result = { vault: VaultRecord; duplicate: boolean };

export function CreateVaultScreen() {
  const hashId = useId();
  const helpId = useId();
  const [txHash, setTxHash] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setServerError(null);
    const hash = txHash.trim();
    if (!isTransactionHash(hash)) {
      setClientError("Enter the 32-byte transaction hash, including the 0x prefix.");
      return;
    }
    setClientError(null);
    setPending(true);
    try {
      const registration = await registerDeployment(hash, DEMONSTRATION_CHAIN_ID);
      setResult(registration);
    } catch (error) {
      const code = error instanceof RegistryError ? error.code : "network";
      setServerError(registryMessage(code));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create Vault"
        lede="Wallet signing is not available in this demonstration. A vault is created from the operator wallet, and this screen records the creation transaction after the server verifies it."
      />
      <section className={styles.panel} aria-labelledby="registration-heading">
        <h2 id="registration-heading">Register a creation transaction</h2>
        <p className={styles.muted}>
          The console does not choose the vault address, does not hold a key, and does not submit a blockchain
          transaction. The registry reads the factory event from the hash below.
        </p>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Network</span>
            <p>
              {DEMONSTRATION_NETWORK} · chain id {DEMONSTRATION_CHAIN_ID}
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor={hashId}>Creation transaction hash</label>
            <input
              id={hashId}
              name="txHash"
              className={styles.input}
              value={txHash}
              onChange={(event) => setTxHash(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={clientError ? true : undefined}
              aria-describedby={helpId}
              placeholder="0x"
            />
            <p id={helpId} className={styles.help}>
              Paste the hash of the factory transaction that created the vault.
            </p>
            {clientError ? (
              <p className={styles.formError} role="alert">
                {clientError}
              </p>
            ) : null}
          </div>
          <button type="submit" className={styles.primaryButton} disabled={pending}>
            {pending ? "Checking transaction" : "Register transaction"}
          </button>
        </form>
        {serverError ? (
          <p className={styles.formError} role="alert">
            {serverError}
          </p>
        ) : null}
        {result ? (
          <div className={styles.result} role="status">
            <h3>{result.duplicate ? "Already registered" : "Vault registered"}</h3>
            <p>
              {result.duplicate
                ? "This transaction was already in the registry."
                : "The server verified the deployment and stored the vault metadata."}
            </p>
            <p>
              <Link href={`/vaults/${result.vault.vaultAddress}`}>{result.vault.name}</Link>
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}
