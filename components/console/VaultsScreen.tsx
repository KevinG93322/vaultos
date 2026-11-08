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
        lede="Registered vaults returned by the registry for this network. Open a vault to read the metadata the backend verified and stored."
      />
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "error" ? <ErrorState code={state.code} onRetry={reload} /> : null}
      {state.status === "ready" && state.vaults.length === 0 ? (
        <EmptyState title="No vaults registered">
          The registry returned no vaults. A vault appears here after its creation transaction is verified.{" "}
          <Link href="/create">Create a vault</Link>.
        </EmptyState>
      ) : null}
      {state.status === "ready" && state.vaults.length > 0 ? <VaultRows vaults={state.vaults} /> : null}
    </>
  );
}
