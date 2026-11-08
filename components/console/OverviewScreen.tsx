"use client";

import Link from "next/link";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "./RegistryStatus";
import { VaultRows } from "./VaultRows";
import styles from "./console.module.css";
import { useVaultList } from "./useVaultRegistry";

export function OverviewScreen() {
  const { state, reload } = useVaultList();
  const vaults = state.status === "ready" ? state.vaults : [];
  const assets = new Set(vaults.map((vault) => vault.assetAddress)).size;

  return (
    <>
      <PageHeader
        title="Overview"
        lede="Registry metadata for vaults verified on Ethereum Sepolia. Open a vault to read balances, deposit vUSD, and redeem shares."
      />
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? <ErrorState code={state.code} onRetry={reload} /> : null}
      {state.status === "ready" ? (
        <>
          <p className={styles.caption}>
            These figures count registry records. They are not balances, volume, or performance figures.
          </p>
          <dl className={styles.metrics}>
            <div>
              <dt>Registered vaults</dt>
              <dd>{vaults.length}</dd>
            </div>
            <div>
              <dt>Underlying assets</dt>
              <dd>{assets}</dd>
            </div>
          </dl>
          <section className={styles.section} aria-labelledby="recent-vaults">
            <div className={styles.sectionHead}>
              <h2 id="recent-vaults">Latest registry entries</h2>
              <Link href="/vaults">My Vaults</Link>
            </div>
            {vaults.length === 0 ? (
              <EmptyState title="No vaults registered">
                The registry returned an empty list. A vault appears here after its creation transaction has been
                verified and recorded.
              </EmptyState>
            ) : (
              <VaultRows vaults={[...vaults].reverse().slice(0, 5)} />
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
