"use client";

import {
  DEPLOYER_ADDRESS,
  ETHEREUM_SEPOLIA_CURRENCY,
  SEPOLIA_EXPLORER_URL,
  TEST_ASSET_ADDRESS,
  VAULT_FACTORY_ADDRESS,
} from "@/lib/vaultos/network";

import { ChainLink } from "./ChainLink";
import { DEMONSTRATION_CHAIN_ID, DEMONSTRATION_LABEL, DEMONSTRATION_NETWORK } from "./demonstration";
import { registryMessage } from "./messages";
import { PageHeader } from "./RegistryStatus";
import styles from "./console.module.css";
import { useVaultList } from "./useVaultRegistry";
import { useWallet } from "./wallet";

const unavailable = [
  "Deployment of new contracts from this console",
  "Ethereum Mainnet",
  "Storage of wallet keys or wallet passwords",
];

export function SettingsScreen() {
  const { state, reload } = useVaultList();
  const wallet = useWallet();
  const factory =
    state.status === "ready" && state.vaults.length > 0 ? state.vaults[0].factoryAddress : null;

  return (
    <>
      <PageHeader
        title="Settings"
        lede="Identity of this technical demonstration. The console does not store keys and does not change deployment settings."
      />
      <section className={styles.panel} aria-labelledby="identity-heading">
        <h2 id="identity-heading">Demonstration</h2>
        <dl className={styles.fields}>
          <div>
            <dt>Product</dt>
            <dd>VaultOS</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{DEMONSTRATION_LABEL}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>
              {DEMONSTRATION_NETWORK} · chain id {DEMONSTRATION_CHAIN_ID}
            </dd>
          </div>
          <div>
            <dt>Gas currency</dt>
            <dd>{ETHEREUM_SEPOLIA_CURRENCY}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd>
              {wallet.status === "connected" && wallet.address ? (
                <>
                  <ChainLink kind="address" value={wallet.address}>
                    <code>{wallet.address}</code>
                  </ChainLink>
                  {wallet.onSepolia ? " · Ethereum Sepolia" : ` · chain ${wallet.chainId}`}
                </>
              ) : (
                "No wallet is connected in this console."
              )}
            </dd>
          </div>
          <div>
            <dt>TestAsset (vUSD)</dt>
            <dd>
              <ChainLink kind="address" value={TEST_ASSET_ADDRESS}>
                <code>{TEST_ASSET_ADDRESS}</code>
              </ChainLink>
            </dd>
          </div>
          <div>
            <dt>VaultFactory</dt>
            <dd>
              <ChainLink kind="address" value={VAULT_FACTORY_ADDRESS}>
                <code>{VAULT_FACTORY_ADDRESS}</code>
              </ChainLink>
            </dd>
          </div>
          <div>
            <dt>Deployer</dt>
            <dd>
              <ChainLink kind="address" value={DEPLOYER_ADDRESS}>
                <code>{DEPLOYER_ADDRESS}</code>
              </ChainLink>
            </dd>
          </div>
          <div>
            <dt>Explorer</dt>
            <dd>
              <a href={SEPOLIA_EXPLORER_URL} target="_blank" rel="noreferrer">
                {SEPOLIA_EXPLORER_URL}
                <span className={styles.srOnly}> (opens in a new tab)</span>
              </a>
            </dd>
          </div>
          <div>
            <dt>Registry</dt>
            <dd>
              {state.status === "loading" ? "Loading registry records." : null}
              {state.status === "error" ? registryMessage(state.code) : null}
              {state.status === "ready"
                ? `${state.vaults.length} registered vault${state.vaults.length === 1 ? "" : "s"}.`
                : null}
            </dd>
          </div>
          <div>
            <dt>Factory on recorded vaults</dt>
            <dd>{factory ? <code>{factory}</code> : "No factory address is available until a vault is registered."}</dd>
          </div>
        </dl>
        {state.status === "error" ? (
          <button type="button" className={styles.secondaryButton} onClick={reload}>
            Try again
          </button>
        ) : null}
      </section>
      <section className={styles.panel} aria-labelledby="scope-heading">
        <h2 id="scope-heading">Not included in this demonstration</h2>
        <ul className={styles.plainList}>
          {unavailable.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
