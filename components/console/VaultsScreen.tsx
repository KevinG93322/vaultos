"use client";

import Link from "next/link";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "./RegistryStatus";
import { VaultRows } from "./VaultRows";
import { useVaultList } from "./useVaultRegistry";

export function VaultsScreen() {
  const { state, reload } = useVaultList();

  return (
    <>
      <PageHeader
        title="My Vaults"
        lede="Vaults recorded by the registry after an independent deployment check. This list does not include balances."
      />
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? <ErrorState code={state.code} onRetry={reload} /> : null}
      {state.status === "ready" && state.vaults.length === 0 ? (
        <EmptyState title="No vaults registered">
          No vault records were returned.{" "}
          <Link href="/create">Register a creation transaction</Link> after it has been submitted from a wallet.
        </EmptyState>
      ) : null}
      {state.status === "ready" && state.vaults.length > 0 ? <VaultRows vaults={state.vaults} /> : null}
    </>
  );
}
