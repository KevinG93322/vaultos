"use client";

import Link from "next/link";

import type { VaultRecord } from "@/lib/vaultos/types";

import { assetKindLabel, chainLabel, verificationLabel } from "./demonstration";
import { ErrorState, LoadingState, PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";
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
    { label: "Share name", value: vault.name, mono: false },
    { label: "Share symbol", value: vault.symbol, mono: false },
    { label: "Vault address", value: vault.vaultAddress, mono: true },
    { label: "Chain", value: `${chainLabel(vault.chainId)} (${vault.chainId})`, mono: false },
    { label: "Underlying asset", value: vault.assetSymbol, mono: false },
    { label: "Asset address", value: vault.assetAddress, mono: true },
    { label: "Asset decimals", value: String(vault.assetDecimals), mono: false },
    { label: "Asset kind", value: assetKindLabel(vault.kind), mono: false },
    { label: "Asset verification", value: verificationLabel(vault.verificationStatus), mono: false },
    { label: "Deployer", value: vault.deployer, mono: true },
    { label: "Factory", value: vault.factoryAddress, mono: true },
    { label: "Creation transaction", value: vault.creationTxHash, mono: true },
    { label: "Implementation address", value: vault.implementationAddress, mono: true },
    { label: "Code hash", value: vault.codeHash, mono: true },
  ];

  return (
    <>
      <PageHeader
        title={vault.name}
        lede="Metadata stored after deployment verification. Balances and share positions are not read in this demonstration."
      />
      <dl className={styles.fields}>
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.mono ? <code>{field.value}</code> : field.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
