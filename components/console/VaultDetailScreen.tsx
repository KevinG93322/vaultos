"use client";

import Link from "next/link";

import type { VaultRecord } from "@/lib/vaultos/types";
import { ETHEREUM_SEPOLIA_CHAIN_ID } from "@/lib/vaultos/network";

import { ChainLink } from "./ChainLink";
import { assetKindLabel, chainLabel, verificationLabel } from "./demonstration";
import { ErrorState, LoadingState, PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";
import { VaultActions } from "./VaultActions";
import { useVault } from "./useVaultRegistry";

export function VaultDetailScreen({ address }: { address: string }) {
  const { state, reload } = useVault(address);

  return (
    <>
      <p className={styles.back}>
        <Link href="/vaults">My Vaults</Link>
      </p>
      {state.status === "loading" ? (
        <>
          <PageHeader title="Vault details" lede="Loading the registry record for this address." />
          <LoadingState />
        </>
      ) : null}
      {state.status === "error" ? (
        <>
          <PageHeader title="Vault details" lede="The registry record for this address could not be shown." />
          <ErrorState code={state.code} onRetry={reload} />
        </>
      ) : null}
      {state.status === "ready" ? <Detail vault={state.vault} /> : null}
    </>
  );
}

function Detail({ vault }: { vault: VaultRecord }) {
  const fields = [
    { label: "Share name", value: vault.name, kind: "text" as const },
    { label: "Share symbol", value: vault.symbol, kind: "text" as const },
    { label: "Vault address", value: vault.vaultAddress, kind: "address" as const },
    { label: "Chain", value: `${chainLabel(vault.chainId)} (${vault.chainId})`, kind: "text" as const },
    { label: "Underlying asset", value: vault.assetSymbol, kind: "text" as const },
    { label: "Asset address", value: vault.assetAddress, kind: "address" as const },
    { label: "Asset decimals", value: String(vault.assetDecimals), kind: "text" as const },
    { label: "Asset kind", value: assetKindLabel(vault.kind), kind: "text" as const },
    { label: "Asset verification", value: verificationLabel(vault.verificationStatus), kind: "text" as const },
    { label: "Deployer", value: vault.deployer, kind: "address" as const },
    { label: "Factory", value: vault.factoryAddress, kind: "address" as const },
    { label: "Creation transaction", value: vault.creationTxHash, kind: "tx" as const },
    { label: "Implementation address", value: vault.implementationAddress, kind: "address" as const },
    { label: "Code hash", value: vault.codeHash, kind: "code" as const },
  ];

  return (
    <>
      <PageHeader
        title={vault.name}
        lede="Registry metadata from deployment verification, followed by balances read from Ethereum Sepolia."
      />
      <dl className={styles.fields}>
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>
              <FieldValue chainId={vault.chainId} kind={field.kind} value={field.value} />
            </dd>
          </div>
        ))}
      </dl>
      {vault.chainId === ETHEREUM_SEPOLIA_CHAIN_ID ? <VaultActions vault={vault} /> : null}
    </>
  );
}

function FieldValue({
  chainId,
  kind,
  value,
}: {
  chainId: number;
  kind: "text" | "address" | "tx" | "code";
  value: string;
}) {
  if (kind === "text") return value;
  if (chainId !== ETHEREUM_SEPOLIA_CHAIN_ID || kind === "code") return <code>{value}</code>;
  return (
    <ChainLink kind={kind} value={value}>
      <code>{value}</code>
    </ChainLink>
  );
}
