"use client";

import { useState } from "react";
import type { Address, Hash, WalletClient } from "viem";

import { describeWalletError } from "@/lib/vaultos/network";
import { confirmSepoliaTransaction } from "@/lib/vaultos/sepolia";

import type { TxState } from "./TxNotice";
import { useWallet } from "./wallet";

export function useTrackedTx() {
  const wallet = useWallet();
  const [state, setState] = useState<TxState>({ kind: "idle" });
  const busy = state.kind === "signing" || state.kind === "confirming";

  async function track(
    label: string,
    submit: (walletClient: WalletClient, account: Address) => Promise<Hash>,
  ): Promise<Hash | null> {
    if (!wallet.onSepolia || !wallet.walletClient || !wallet.address) {
      setState({
        kind: "error",
        message: "Connect a wallet on Ethereum Sepolia before submitting a transaction.",
      });
      return null;
    }
    setState({ kind: "signing", label });
    try {
      const hash = await submit(wallet.walletClient, wallet.address);
      setState({ kind: "confirming", label, hash });
      await confirmSepoliaTransaction(hash);
      setState({ kind: "success", label, hash });
      wallet.refreshReads();
      return hash;
    } catch (error) {
      setState({ kind: "error", message: describeWalletError(error) });
      return null;
    }
  }

  return { state, setState, track, busy };
}
