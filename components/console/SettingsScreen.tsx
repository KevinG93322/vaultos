"use client";

import { DEMONSTRATION_CHAIN_ID, DEMONSTRATION_LABEL, DEMONSTRATION_NETWORK } from "./demonstration";
import { registryMessage } from "./messages";
import { PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";
import { useVaultList } from "./useVaultRegistry";

const unavailable = [
  "Wallet connection and transaction signing",
  "Vault creation from this browser",
  "Deposits and withdrawals",
  "Asset balances and share balances",
  "Base Sepolia contract deployment from this console",
];

export function SettingsScreen() {
  const { state, reload } = useVaultList();
  const factory =
    state.status === "ready" && state.vaults.length > 0 ? state.vaults[0].factoryAddress : null;

  return (
    <>
      <PageHeader
        title="Settings"
        lede="Identity of this technical demonstration. The console does not store keys and does not change deployment settings."
      />
      <section className={styles.panel} aria-labelledby="identity-heading">
        <h2 id="identity-heading">Demonstration</h2>
        <dl className={styles.fields}>
          <div>
            <dt>Product</dt>
            <dd>VaultOS</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{DEMONSTRATION_LABEL}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>
              {DEMONSTRATION_NETWORK} · chain id {DEMONSTRATION_CHAIN_ID}
            </dd>
          </div>
          <div>
            <dt>Registry</dt>
            <dd>
              {state.status === "loading" ? "Loading registry records." : null}
              {state.status === "error" ? registryMessage(state.code) : null}
              {state.status === "ready"
                ? `${state.vaults.length} registered vault${state.vaults.length === 1 ? "" : "s"}.`
                : null}
            </dd>
          </div>
          <div>
            <dt>Factory on recorded vaults</dt>
            <dd>{factory ? <code>{factory}</code> : "No factory address is available until a vault is registered."}</dd>
          </div>
        </dl>
        {state.status === "error" ? (
          <button type="button" className={styles.secondaryButton} onClick={reload}>
            Try again
          </button>
        ) : null}
      </section>
      <section className={styles.panel} aria-labelledby="scope-heading">
        <h2 id="scope-heading">Not included in this demonstration</h2>
        <ul className={styles.plainList}>
          {unavailable.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
