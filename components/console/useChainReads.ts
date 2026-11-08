"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";

import { readAssetSnapshot, readVaultPosition, type AssetSnapshot, type VaultPosition } from "@/lib/vaultos/sepolia";

import { useWallet } from "./wallet";

type Load<T> = { key: string; status: "ready"; value: T } | { key: string; status: "error" };

export function useAssetSnapshot() {
  const { address, onSepolia, revision } = useWallet();
  const [request, setRequest] = useState(0);
  const enabled = Boolean(address && onSepolia);
  const key = enabled ? `${address}:${revision}:${request}` : "";
  const [load, setLoad] = useState<Load<AssetSnapshot> | null>(null);

  useEffect(() => {
    if (!enabled || !address) return;
    let active = true;
    readAssetSnapshot(address).then(
      (value) => {
        if (active) setLoad({ key, status: "ready", value });
      },
      () => {
        if (active) setLoad({ key, status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [address, enabled, key]);

  const state = !enabled
    ? ({ status: "idle" } as const)
    : load?.key === key
      ? load.status === "ready"
        ? ({ status: "ready", value: load.value } as const)
        : ({ status: "error" } as const)
      : ({ status: "loading" } as const);

  return { state, reload: () => setRequest((value) => value + 1) };
}

export function useVaultPosition(vault: Address | null) {
  const { address, onSepolia, revision } = useWallet();
  const account = onSepolia ? address : null;
  const [request, setRequest] = useState(0);
  const key = vault ? `${vault}:${account ?? ""}:${revision}:${request}` : "";
  const [load, setLoad] = useState<Load<VaultPosition> | null>(null);

  useEffect(() => {
    if (!vault) return;
    let active = true;
    readVaultPosition(vault, account).then(
      (value) => {
        if (active) setLoad({ key, status: "ready", value });
      },
      () => {
        if (active) setLoad({ key, status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [account, key, vault]);

  const state = !vault
    ? ({ status: "idle" } as const)
    : load?.key === key
      ? load.status === "ready"
        ? ({ status: "ready", value: load.value } as const)
        : ({ status: "error" } as const)
      : ({ status: "loading" } as const);

  return { state, reload: () => setRequest((value) => value + 1) };
}
