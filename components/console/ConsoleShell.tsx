"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

import styles from "./console.module.css";

const links = [
  { href: "/", label: "Overview" },
  { href: "/vaults", label: "My Vaults" },
  { href: "/create", label: "Create Vault" },
  { href: "/activity", label: "Transaction History" },
  { href: "/settings", label: "Settings" },
] as const;

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
        <p className={styles.badge}>Base Sepolia Testnet · Technical demonstration</p>
      </header>
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
            VaultOS is a technical demonstration on Base Sepolia. It is not a production financial platform.
          </footer>
        </div>
      </div>
    </div>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
