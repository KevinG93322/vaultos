"use client";

import { useId, useState, type FormEvent } from "react";

import { formatTokenAmount, parseTokenAmount } from "@/lib/vaultos/network";
import { writeMint } from "@/lib/vaultos/sepolia";

import styles from "./console.module.css";
import { TxNotice } from "./TxNotice";
import { useAssetSnapshot } from "./useChainReads";
import { useTrackedTx } from "./useTrackedTx";
import { useWallet } from "./wallet";

export function DemoAssetPanel() {
  const amountId = useId();
  const wallet = useWallet();
  const snapshot = useAssetSnapshot();
  const tx = useTrackedTx();
  const [amount, setAmount] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    if (!wallet.onSepolia || !wallet.address) {
      setClientError("Connect a wallet on Ethereum Sepolia before minting vUSD.");
      return;
    }
    if (snapshot.state.status !== "ready") {
      setClientError("The vUSD balance is still being read from Ethereum Sepolia.");
      return;
    }
    const parsed = parseTokenAmount(amount, snapshot.state.value.decimals);
    if (parsed === null) {
      setClientError("Enter a vUSD amount greater than zero.");
      return;
    }
    const hash = await tx.track("Mint vUSD", (walletClient, account) => writeMint(walletClient, account, parsed));
    if (hash) setAmount("");
  }

  const ready = snapshot.state.status === "ready" ? snapshot.state.value : null;
  const canMint = wallet.onSepolia && ready !== null && !tx.busy;

  return (
    <section className={styles.panel} aria-labelledby="vusd-heading">
      <h2 id="vusd-heading">Demonstration vUSD</h2>
      <p className={styles.muted}>
        TestAsset is a public faucet on Ethereum Sepolia. Minted tokens are demonstration assets, and the transaction
        is signed in your wallet.
      </p>
      {wallet.status !== "connected" ? <p>Connect a wallet to read your vUSD balance and to mint.</p> : null}
      {wallet.status === "connected" && !wallet.onSepolia ? (
        <p>Switch this wallet to Ethereum Sepolia before reading or minting vUSD.</p>
      ) : null}
      {snapshot.state.status === "loading" ? <p role="status">Reading vUSD from Ethereum Sepolia.</p> : null}
      {snapshot.state.status === "error" ? (
        <div className={styles.notice} role="alert">
          <h2>Balance unavailable</h2>
          <p>The vUSD balance could not be read from Ethereum Sepolia.</p>
          <button type="button" className={styles.secondaryButton} onClick={snapshot.reload}>
            Try again
          </button>
        </div>
      ) : null}
      {ready ? (
        <dl className={styles.fields}>
          <div>
            <dt>Your {ready.symbol}</dt>
            <dd>{formatTokenAmount(ready.balance, ready.decimals)}</dd>
          </div>
        </dl>
      ) : null}
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={amountId}>Amount to mint</label>
          <input
            id={amountId}
            className={styles.input}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="0.0"
            aria-invalid={clientError ? true : undefined}
            disabled={!wallet.onSepolia}
          />
          {clientError ? (
            <p className={styles.formError} role="alert">
              {clientError}
            </p>
          ) : null}
        </div>
        <button type="submit" className={styles.primaryButton} disabled={!canMint}>
          {tx.busy ? "Mint in progress" : "Mint vUSD"}
        </button>
        <TxNotice state={tx.state} />
      </form>
    </section>
  );
}
