"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { sepolia } from "viem/chains";

import {
  browserRpcUrl,
  chainIdFromWallet,
  describeWalletError,
  ETHEREUM_SEPOLIA_CHAIN_HEX,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  firstAddress,
  sepoliaChainParams,
} from "@/lib/vaultos/network";

export type Eip1193Provider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: unknown;
};

type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

type WalletContextValue = {
  status: WalletStatus;
  address: Address | null;
  chainId: number | null;
  message: string | null;
  revision: number;
  onSepolia: boolean;
  walletClient: WalletClient | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToSepolia: () => Promise<void>;
  refreshReads: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const readGeneration = useRef(0);

  const applySession = useCallback((nextAddress: Address | null, nextChainId: number | null) => {
    if (!nextAddress || nextChainId === null) {
      setStatus("disconnected");
      setAddress(null);
      setChainId(null);
      return;
    }
    setStatus("connected");
    setAddress(nextAddress);
    setChainId(nextChainId);
    setMessage(null);
  }, []);

  const readSession = useCallback(
    async (current: Eip1193Provider, requestPermission: boolean) => {
      const generation = ++readGeneration.current;
      const accounts = await current.request({
        method: requestPermission ? "eth_requestAccounts" : "eth_accounts",
      });
      if (generation !== readGeneration.current) return;
      const nextAddress = firstAddress(accounts);
      if (!nextAddress) {
        applySession(null, null);
        return;
      }
      const nextChainId = chainIdFromWallet(await current.request({ method: "eth_chainId" }));
      if (generation !== readGeneration.current) return;
      if (nextChainId === null) throw new Error("The wallet did not report a chain id.");
      setProvider(current);
      applySession(nextAddress, nextChainId);
    },
    [applySession],
  );

  useEffect(() => {
    const injected = readInjectedProvider();
    if (!injected) return;
    const generation = ++readGeneration.current;
    let active = true;
    injected
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (!active || generation !== readGeneration.current) return null;
        const nextAddress = firstAddress(accounts);
        if (!nextAddress) return null;
        return injected.request({ method: "eth_chainId" }).then((chainValue) => {
          if (!active || generation !== readGeneration.current) return;
          const nextChainId = chainIdFromWallet(chainValue);
          if (nextChainId === null) return;
          setProvider(injected);
          applySession(nextAddress, nextChainId);
        });
      })
      .catch(() => {
        if (active && generation === readGeneration.current) setStatus("disconnected");
      });
    return () => {
      active = false;
      readGeneration.current += 1;
    };
  }, [applySession]);

  useEffect(() => {
    if (!provider?.on || status !== "connected") return;
    const onAccounts = (accounts: unknown) => {
      const next = firstAddress(accounts);
      if (!next) {
        applySession(null, null);
        return;
      }
      setAddress(next);
      setStatus("connected");
      setMessage(null);
      setRevision((value) => value + 1);
    };
    const onChain = (value: unknown) => {
      const next = chainIdFromWallet(value);
      if (next === null) return;
      setChainId(next);
      setRevision((value) => value + 1);
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, status, applySession]);

  const walletClient = useMemo(() => {
    if (status !== "connected" || !address || !provider) return null;
    return createWalletClient({
      account: address,
      chain: sepolia,
      transport: custom(provider),
    });
  }, [status, address, provider]);

  const connect = useCallback(async () => {
    const injected = readInjectedProvider();
    if (!injected) {
      setStatus("error");
      setAddress(null);
      setChainId(null);
      setMessage("No injected wallet was found. Install a wallet that supports Ethereum Sepolia, then try again.");
      return;
    }
    setProvider(injected);
    setStatus("connecting");
    setMessage(null);
    try {
      await readSession(injected, true);
    } catch (error) {
      setStatus("error");
      setAddress(null);
      setChainId(null);
      setMessage(describeWalletError(error));
    }
  }, [readSession]);

  const disconnect = useCallback(() => {
    readGeneration.current += 1;
    setStatus("disconnected");
    setAddress(null);
    setChainId(null);
    setMessage(null);
  }, []);

  const switchToSepolia = useCallback(async () => {
    const current = provider ?? readInjectedProvider();
    if (!current) {
      setMessage("No injected wallet was found.");
      return;
    }
    setProvider(current);
    setMessage(null);
    try {
      await current.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ETHEREUM_SEPOLIA_CHAIN_HEX }],
      });
    } catch (error) {
      if (errorCode(error) !== 4902) {
        setMessage(describeWalletError(error));
        return;
      }
      try {
        await current.request({
          method: "wallet_addEthereumChain",
          params: [sepoliaChainParams(browserRpcUrl())],
        });
        await current.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ETHEREUM_SEPOLIA_CHAIN_HEX }],
        });
      } catch (addError) {
        setMessage(describeWalletError(addError));
        return;
      }
    }
    const nextChainId = chainIdFromWallet(await current.request({ method: "eth_chainId" }));
    if (nextChainId !== null) {
      setChainId(nextChainId);
      setRevision((value) => value + 1);
    }
  }, [provider]);

  const refreshReads = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      message,
      revision,
      onSepolia: status === "connected" && chainId === ETHEREUM_SEPOLIA_CHAIN_ID,
      walletClient,
      connect,
      disconnect,
      switchToSepolia,
      refreshReads,
    }),
    [
      status,
      address,
      chainId,
      message,
      revision,
      walletClient,
      connect,
      disconnect,
      switchToSepolia,
      refreshReads,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("WalletProvider is missing.");
  return value;
}

export function readInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!isProvider(candidate)) return null;
  if (!Array.isArray(candidate.providers)) return candidate;
  const available = candidate.providers.filter(isProvider);
  return available.find((provider) => provider.isMetaMask) ?? available[0] ?? candidate;
}

function isProvider(value: unknown): value is Eip1193Provider {
  return typeof value === "object" && value !== null && "request" in value && typeof value.request === "function";
}

function errorCode(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error) return error.code;
  return undefined;
}
