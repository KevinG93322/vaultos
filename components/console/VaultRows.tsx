import Link from "next/link";

import { ETHEREUM_SEPOLIA_CHAIN_ID } from "@/lib/vaultos/network";
import type { VaultRecord } from "@/lib/vaultos/types";

import { ChainLink } from "./ChainLink";
import { chainLabel, shortenHex } from "./demonstration";
import styles from "./console.module.css";

export function VaultRows({ vaults }: { vaults: VaultRecord[] }) {
  return (
    <ul className={styles.recordList} aria-label="Registered vaults">
      <li className={styles.recordHead} aria-hidden="true">
        <span>Vault</span>
        <span>Asset</span>
        <span>Contract</span>
        <span>Network</span>
        <span>Creation</span>
      </li>
      {vaults.map((vault) => (
        <li key={vault.id}>
          <article className={styles.record}>
            <div>
              <h3>
                <Link href={`/vaults/${vault.vaultAddress}`}>{vault.name || shortenHex(vault.vaultAddress)}</Link>
              </h3>
              {vault.symbol ? <p className={styles.muted}>{vault.symbol}</p> : null}
            </div>
            <p>
              <span className={styles.fieldLabel}>Asset</span>
              {vault.assetSymbol || "—"}
            </p>
            <p>
              <span className={styles.fieldLabel}>Contract</span>
              <ChainValue chainId={vault.chainId} kind="address" value={vault.vaultAddress} />
            </p>
            <p>
              <span className={styles.fieldLabel}>Network</span>
              {chainLabel(vault.chainId)}
            </p>
            <div>
              <span className={styles.fieldLabel}>Creation</span>
              {vault.creationTxHash ? (
                <ChainValue chainId={vault.chainId} kind="tx" value={vault.creationTxHash} />
              ) : (
                <span className={styles.muted}>Not recorded</span>
              )}
              {vault.deployer ? (
                <p className={styles.creationMeta}>
                  Deployer <ChainValue chainId={vault.chainId} kind="address" value={vault.deployer} />
                </p>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function ChainValue({
  chainId,
  kind,
  value,
}: {
  chainId: number;
  kind: "address" | "tx";
  value: string;
}) {
  const label = <code title={value}>{shortenHex(value)}</code>;
  if (chainId !== ETHEREUM_SEPOLIA_CHAIN_ID) return label;
  return (
    <ChainLink kind={kind} value={value}>
      {label}
    </ChainLink>
  );
}
