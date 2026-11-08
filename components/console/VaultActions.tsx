"use client";

import { getAddress, isAddress, type Address, type Hash, type WalletClient } from "viem";
import { useEffect, useId, useState, type FormEvent } from "react";

import type { VaultRecord } from "@/lib/vaultos/types";
import { describeWalletError, formatTokenAmount, parseTokenAmount, TEST_ASSET_ADDRESS } from "@/lib/vaultos/network";
import {
  confirmSepoliaTransaction,
  previewDeposit,
  readAllowance,
  writeApprove,
  writeDeposit,
  writeRedeem,
  writeWithdraw,
} from "@/lib/vaultos/sepolia";

import styles from "./console.module.css";
import { TxNotice } from "./TxNotice";
import { useVaultPosition } from "./useChainReads";
import { useTrackedTx } from "./useTrackedTx";
import { useWallet } from "./wallet";

export function VaultActions({ vault }: { vault: VaultRecord }) {
  const vaultAddress = isAddress(vault.vaultAddress) ? getAddress(vault.vaultAddress) : null;
  const position = useVaultPosition(vaultAddress);
  const wallet = useWallet();

  return (
    <section className={styles.panel} aria-labelledby="position-heading">
      <h2 id="position-heading">On-chain position</h2>
      <p className={styles.muted}>
        Balances are read from Ethereum Sepolia. Deposit, withdraw, and redeem transactions are signed in your wallet.
      </p>
      {!vaultAddress ? <p role="alert">The registry vault address cannot be read as an Ethereum address.</p> : null}
      {wallet.status !== "connected" ? <p>Connect a wallet to see your balances and to move funds.</p> : null}
      {wallet.status === "connected" && !wallet.onSepolia ? (
        <p>Switch this wallet to Ethereum Sepolia before reading your balances or submitting a transaction.</p>
      ) : null}
      {position.state.status === "loading" ? <p role="status">Reading balances from Ethereum Sepolia.</p> : null}
      {position.state.status === "error" ? (
        <div className={styles.notice} role="alert">
          <h2>Balances unavailable</h2>
          <p>The vault balances could not be read from Ethereum Sepolia.</p>
          <button type="button" className={styles.secondaryButton} onClick={position.reload}>
            Try again
          </button>
        </div>
      ) : null}
      {position.state.status === "ready" && vaultAddress ? (
        <PositionBody vaultAddress={vaultAddress} position={position.state.value} reload={position.reload} />
      ) : null}
    </section>
  );
}

function PositionBody({
  vaultAddress,
  position,
  reload,
}: {
  vaultAddress: Address;
  position: {
    asset: Address;
    assetDecimals: number;
    shareDecimals: number;
    totalAssets: bigint;
    assetBalance: bigint | null;
    shareBalance: bigint | null;
    allowance: bigint | null;
    maxWithdraw: bigint | null;
    maxRedeem: bigint | null;
  };
  reload: () => void;
}) {
  const assetMatches = position.asset.toLowerCase() === TEST_ASSET_ADDRESS.toLowerCase();
  const rows = [
    { label: "Vault total assets", value: formatTokenAmount(position.totalAssets, position.assetDecimals) },
    {
      label: "Your vUSD",
      value: position.assetBalance === null ? "Connect a wallet on Ethereum Sepolia" : formatTokenAmount(position.assetBalance, position.assetDecimals),
    },
    {
      label: "Your vault shares",
      value: position.shareBalance === null ? "Connect a wallet on Ethereum Sepolia" : formatTokenAmount(position.shareBalance, position.shareDecimals),
    },
    {
      label: "vUSD allowance for this vault",
      value: position.allowance === null ? "Connect a wallet on Ethereum Sepolia" : formatTokenAmount(position.allowance, position.assetDecimals),
    },
  ];

  return (
    <>
      <dl className={styles.fields}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {assetMatches ? (
        <>
          <DepositForm vaultAddress={vaultAddress} decimals={position.assetDecimals} onDone={reload} />
          <WithdrawForm
            vaultAddress={vaultAddress}
            decimals={position.assetDecimals}
            available={position.maxWithdraw}
            onDone={reload}
          />
          <RedeemForm
            vaultAddress={vaultAddress}
            decimals={position.shareDecimals}
            available={position.maxRedeem}
            onDone={reload}
          />
        </>
      ) : (
        <p role="alert">This vault&apos;s asset does not match the deployed vUSD contract. Transfers are unavailable.</p>
      )}
    </>
  );
}

function DepositForm({
  vaultAddress,
  decimals,
  onDone,
}: {
  vaultAddress: Address;
  decimals: number;
  onDone: () => void;
}) {
  const amountId = useId();
  const wallet = useWallet();
  const tx = useTrackedTx();
  const [amount, setAmount] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<{ key: string; shares: bigint | null } | null>(null);
  const parsed = parseTokenAmount(amount, decimals);
  const previewKey = parsed === null ? "" : `${vaultAddress}:${parsed.toString()}`;
  const previewShares = preview?.key === previewKey ? preview.shares : null;

  useEffect(() => {
    if (parsed === null) return;
    let active = true;
    previewDeposit(vaultAddress, parsed).then(
      (shares) => {
        if (active) setPreview({ key: previewKey, shares });
      },
      () => {
        if (active) setPreview({ key: previewKey, shares: null });
      },
    );
    return () => {
      active = false;
    };
  }, [parsed, previewKey, vaultAddress]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    if (!wallet.onSepolia || !wallet.walletClient || !wallet.address) {
      setClientError("Connect a wallet on Ethereum Sepolia before depositing.");
      return;
    }
    if (parsed === null) {
      setClientError("Enter a vUSD amount greater than zero.");
      return;
    }
    const account = wallet.address;
    const walletClient = wallet.walletClient;
    let approved = false;
    tx.setState({ kind: "idle" });
    setChecking(true);
    try {
      const shares = await previewDeposit(vaultAddress, parsed);
      if (shares === BigInt(0)) {
        tx.setState({ kind: "error", message: "This deposit would mint zero shares." });
        return;
      }
      const allowance = await readAllowance(account, vaultAddress);
      if (allowance < parsed) {
        tx.setState({ kind: "signing", label: "Approve vUSD for this vault" });
        const approveHash = await writeApprove(walletClient, account, vaultAddress, parsed);
        tx.setState({ kind: "confirming", label: "Approve vUSD for this vault", hash: approveHash });
        await confirmSepoliaTransaction(approveHash);
        approved = true;
      }
      tx.setState({ kind: "signing", label: "Deposit vUSD" });
      const hash = await writeDeposit(walletClient, account, vaultAddress, parsed);
      tx.setState({ kind: "confirming", label: "Deposit vUSD", hash });
      await confirmSepoliaTransaction(hash);
      tx.setState({ kind: "success", label: "Deposit vUSD", hash });
      wallet.refreshReads();
      onDone();
    } catch (error) {
      const detail = describeWalletError(error);
      tx.setState({
        kind: "error",
        message: approved ? `The vUSD approval was confirmed. ${detail}` : detail,
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={amountId}>Deposit vUSD</label>
        <input
          id={amountId}
          className={styles.input}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
        />
        <p className={styles.help}>
          {parsed !== null && previewShares !== null
            ? `At the current rate this deposit would mint ${formatTokenAmount(previewShares, decimals)} shares.`
            : "The vault must be approved to spend the vUSD before the deposit."}
        </p>
        {clientError ? (
          <p className={styles.formError} role="alert">
            {clientError}
          </p>
        ) : null}
      </div>
      <button type="submit" className={styles.primaryButton} disabled={tx.busy || checking || !wallet.onSepolia}>
        {tx.busy || checking ? "Deposit in progress" : "Deposit"}
      </button>
      {checking && tx.state.kind === "idle" ? (
        <p className={styles.help} role="status">
          Checking the deposit against Ethereum Sepolia.
        </p>
      ) : null}
      <TxNotice state={tx.state} />
    </form>
  );
}

function WithdrawForm({
  vaultAddress,
  decimals,
  available,
  onDone,
}: {
  vaultAddress: Address;
  decimals: number;
  available: bigint | null;
  onDone: () => void;
}) {
  return (
    <AmountAction
      label="Withdraw assets"
      help="Burns the shares required to return this much vUSD to your wallet."
      decimals={decimals}
      available={available}
      availableLabel="Use withdrawable balance"
      onSubmit={(walletClient, account, amount) => writeWithdraw(walletClient, account, vaultAddress, amount)}
      onDone={onDone}
    />
  );
}

function RedeemForm({
  vaultAddress,
  decimals,
  available,
  onDone,
}: {
  vaultAddress: Address;
  decimals: number;
  available: bigint | null;
  onDone: () => void;
}) {
  return (
    <AmountAction
      label="Redeem shares"
      help="Burns this many shares and returns the corresponding vUSD to your wallet."
      decimals={decimals}
      available={available}
      availableLabel="Use redeemable shares"
      onSubmit={(walletClient, account, amount) => writeRedeem(walletClient, account, vaultAddress, amount)}
      onDone={onDone}
    />
  );
}

function AmountAction({
  label,
  help,
  decimals,
  available,
  availableLabel,
  onSubmit,
  onDone,
}: {
  label: string;
  help: string;
  decimals: number;
  available: bigint | null;
  availableLabel: string;
  onSubmit: (walletClient: WalletClient, account: Address, amount: bigint) => Promise<Hash>;
  onDone: () => void;
}) {
  const inputId = useId();
  const wallet = useWallet();
  const tx = useTrackedTx();
  const [amount, setAmount] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  async function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    const parsed = parseTokenAmount(amount, decimals);
    if (parsed === null) {
      setClientError("Enter an amount greater than zero.");
      return;
    }
    if (available !== null && parsed > available) {
      setClientError("That amount is above the balance this wallet can submit.");
      return;
    }
    const hash = await tx.track(label, (walletClient, account) => onSubmit(walletClient, account, parsed));
    if (hash) onDone();
  }

  return (
    <form className={styles.form} onSubmit={onFormSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          className={styles.input}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
        />
        <p className={styles.help}>{help}</p>
        {clientError ? (
          <p className={styles.formError} role="alert">
            {clientError}
          </p>
        ) : null}
      </div>
      <div className={styles.buttonRow}>
        <button type="submit" className={styles.primaryButton} disabled={tx.busy || !wallet.onSepolia}>
          {tx.busy ? "Transaction in progress" : label}
        </button>
        {available !== null && available > BigInt(0) ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setAmount(formatTokenAmount(available, decimals))}
          >
            {availableLabel}
          </button>
        ) : null}
      </div>
      <TxNotice state={tx.state} />
    </form>
  );
}
