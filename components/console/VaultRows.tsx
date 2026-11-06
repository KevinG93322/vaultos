import Link from "next/link";

import type { VaultRecord } from "@/lib/vaultos/types";

import { chainLabel, shortenHex } from "./demonstration";
import styles from "./console.module.css";

export function VaultRows({ vaults }: { vaults: VaultRecord[] }) {
  return (
    <ul className={styles.recordList}>
      <li className={styles.recordHead} aria-hidden="true">
        <span>Vault</span>
        <span>Asset</span>
        <span>Address</span>
        <span>Chain</span>
      </li>
      {vaults.map((vault) => (
        <li key={vault.id}>
          <article className={styles.record}>
            <div>
              <h3>
                <Link href={`/vaults/${vault.vaultAddress}`}>{vault.name}</Link>
              </h3>
              <p className={styles.muted}>{vault.symbol}</p>
            </div>
            <p>
              <span className={styles.fieldLabel}>Asset</span>
              {vault.assetSymbol}
            </p>
            <p>
              <span className={styles.fieldLabel}>Vault</span>
              <code title={vault.vaultAddress}>{shortenHex(vault.vaultAddress)}</code>
            </p>
            <p>
              <span className={styles.fieldLabel}>Chain</span>
              {chainLabel(vault.chainId)}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
