import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans } from "next/font/google";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { WalletProvider } from "@/components/console/wallet";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-sans",
});

export const metadata: Metadata = {
  title: "VaultOS Console",
  description:
    "VaultOS console for demonstration vaults on Ethereum Sepolia. Transactions are signed in an external wallet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body>
        <WalletProvider>
          <ConsoleShell>{children}</ConsoleShell>
        </WalletProvider>
      </body>
    </html>
  );
}
