import type { ReactNode } from "react";

import { explorerUrl } from "@/lib/vaultos/network";

import styles from "./console.module.css";

export function ChainLink({
  kind,
  value,
  children,
}: {
  kind: "address" | "tx";
  value: string;
  children?: ReactNode;
}) {
  return (
    <a href={explorerUrl(kind, value)} target="_blank" rel="noreferrer">
      {children ?? <code>{value}</code>}
      <span className={styles.srOnly}> (opens the Ethereum Sepolia explorer)</span>
    </a>
  );
}
