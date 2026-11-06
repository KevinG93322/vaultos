"use client";

import { useEffect, useState } from "react";

import type { VaultRecord } from "@/lib/vaultos/types";

import { fetchVault, fetchVaults, RegistryError } from "./api";

export type RegistryListState =
  | { status: "loading" }
  | { status: "ready"; vaults: VaultRecord[] }
  | { status: "error"; code: string };

export type RegistryVaultState =
  | { status: "loading" }
  | { status: "ready"; vault: VaultRecord }
  | { status: "error"; code: string };

export function useVaultList() {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<RegistryListState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchVaults()
      .then((vaults) => {
        if (active) setState({ status: "ready", vaults });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", code: codeFrom(error) });
      });
    return () => {
      active = false;
    };
  }, [request]);

  function reload() {
    setState({ status: "loading" });
    setRequest((value) => value + 1);
  }

  return { state, reload };
}

export function useVault(address: string) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<RegistryVaultState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchVault(address).then(
      (vault) => {
        if (active) setState({ status: "ready", vault });
      },
      (error: unknown) => {
        if (active) setState({ status: "error", code: codeFrom(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [address, request]);

  function reload() {
    setState({ status: "loading" });
    setRequest((value) => value + 1);
  }

  return { state, reload };
}

function codeFrom(error: unknown): string {
  return error instanceof RegistryError ? error.code : "network";
}
