"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

import { ETHEREUM_SEPOLIA_CHAIN_ID, ETHEREUM_SEPOLIA_NAME } from "@/lib/vaultos/network";

import styles from "./console.module.css";
import { shortenHex } from "./demonstration";
import { useWallet } from "./wallet";

const links = [
  { href: "/", label: "Overview" },
  { href: "/vaults", label: "My Vaults" },
  { href: "/create", label: "Create Vault" },
  { href: "/activity", label: "Transaction History" },
  { href: "/settings", label: "Settings" },
] as const;

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wallet = useWallet();
  const menuId = useId();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPath(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#console-main">
        Skip to content
      </a>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandName}>VaultOS</span>
          <span className={styles.brandBy}>PineryZ</span>
        </Link>
        <div className={styles.topbarTools}>
          <p className={styles.badge}>Ethereum Sepolia Testnet · Technical demonstration</p>
          <WalletControl />
        </div>
      </header>
      {wallet.message ? (
        <div className={styles.networkBanner} role="alert">
          <p>{wallet.message}</p>
        </div>
      ) : null}
      {wallet.status === "connected" && !wallet.onSepolia ? (
        <div className={styles.networkBanner} role="alert">
          <p>
            This wallet is on chain {wallet.chainId}. VaultOS submits transactions only on Ethereum Sepolia (
            {ETHEREUM_SEPOLIA_CHAIN_ID}).
          </p>
          <button type="button" className={styles.secondaryButton} onClick={() => void wallet.switchToSepolia()}>
            Switch to Ethereum Sepolia
          </button>
        </div>
      ) : null}
      <div className={styles.frame}>
        <nav id={menuId} className={open ? styles.navOpen : styles.nav} aria-label="VaultOS console">
          <ul className={styles.navList}>
            {links.map((link) => {
              const current = isCurrent(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={styles.navLink}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpenPath(null)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <a href="https://pineryz.com" className={styles.siteLink} onClick={() => setOpenPath(null)}>
            PineryZ homepage
          </a>
        </nav>
        <div className={styles.content}>
          <main id="console-main" className={styles.main}>
            {children}
          </main>
          <footer className={styles.footer}>
            VaultOS is a technical demonstration on Ethereum Sepolia. It is not a production financial platform.
            Transactions are signed in your wallet.
          </footer>
        </div>
      </div>
    </div>
  );
}

function WalletControl() {
  const wallet = useWallet();
  if (wallet.status === "connecting") {
    return (
      <button type="button" className={styles.walletButton} disabled>
        Connecting
      </button>
    );
  }
  if (wallet.status === "connected" && wallet.address) {
    const network = wallet.onSepolia ? ETHEREUM_SEPOLIA_NAME : `Chain ${wallet.chainId}`;
    return (
      <div className={styles.walletSession}>
        <p className={styles.walletAddress} title={wallet.address}>
          <span className={styles.srOnly}>
            Connected wallet {wallet.address}. Network {network}.
          </span>
          <span aria-hidden="true">{shortenHex(wallet.address)}</span>
          <span className={styles.walletNetwork} aria-hidden="true">
            {network}
          </span>
        </p>
        <button type="button" className={styles.walletButton} onClick={wallet.disconnect}>
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <button type="button" className={styles.walletButton} onClick={() => void wallet.connect()}>
      Connect wallet
    </button>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
