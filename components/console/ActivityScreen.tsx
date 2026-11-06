"use client";

import Link from "next/link";

import { shortenHex } from "./demonstration";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";
import { useVaultList } from "./useVaultRegistry";

export function ActivityScreen() {
  const { state, reload } = useVaultList();

  return (
    <>
      <PageHeader
        title="Transaction History"
        lede="Creation transactions stored by the registry. Deposit and withdrawal transactions are not available in this demonstration."
      />
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? <ErrorState code={state.code} onRetry={reload} /> : null}
      {state.status === "ready" && state.vaults.length === 0 ? (
        <EmptyState title="No creation records">
          The registry has no vault creation transactions to show.
        </EmptyState>
      ) : null}
      {state.status === "ready" && state.vaults.length > 0 ? (
        <ul className={styles.recordList}>
          <li className={styles.recordHead} aria-hidden="true">
            <span>Record</span>
            <span>Vault</span>
            <span>Transaction</span>
            <span>Deployer</span>
          </li>
          {[...state.vaults].reverse().map((vault) => (
            <li key={vault.id}>
              <article className={styles.record}>
                <div>
                  <h3>Vault creation</h3>
                  <p className={styles.muted}>Registered</p>
                </div>
                <p>
                  <span className={styles.fieldLabel}>Vault</span>
                  <Link href={`/vaults/${vault.vaultAddress}`}>{vault.name}</Link>
                </p>
                <p>
                  <span className={styles.fieldLabel}>Transaction</span>
                  <code title={vault.creationTxHash}>{shortenHex(vault.creationTxHash, 8, 6)}</code>
                </p>
                <p>
                  <span className={styles.fieldLabel}>Deployer</span>
                  <code title={vault.deployer}>{shortenHex(vault.deployer)}</code>
                </p>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
