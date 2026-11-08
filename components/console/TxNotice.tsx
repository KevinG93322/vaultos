import type { Hash } from "viem";

import { ChainLink } from "./ChainLink";
import styles from "./console.module.css";

export type TxState =
  | { kind: "idle" }
  | { kind: "signing"; label: string }
  | { kind: "confirming"; label: string; hash: Hash }
  | { kind: "success"; label: string; hash: Hash }
  | { kind: "error"; message: string };

export function TxNotice({ state }: { state: TxState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "error") {
    return (
      <p className={styles.formError} role="alert">
        {state.message}
      </p>
    );
  }
  if (state.kind === "signing") {
    return (
      <p className={styles.help} role="status">
        Waiting for the wallet to sign: {state.label}
      </p>
    );
  }
  return (
    <p className={styles.help} role="status">
      {state.kind === "success" ? "Confirmed on Ethereum Sepolia." : "Waiting for the Ethereum Sepolia receipt."}{" "}
      {state.label}{" "}
      <ChainLink kind="tx" value={state.hash}>
        <code>{state.hash}</code>
      </ChainLink>
    </p>
  );
}
