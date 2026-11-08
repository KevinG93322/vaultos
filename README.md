# VaultOS

Technical demonstration of an ERC-4626 vault registry on Ethereum Sepolia. It is not a production financial product.

## Network

| | |
| --- | --- |
| Network | Ethereum Sepolia |
| Chain ID | `11155111` |
| Gas currency | Sepolia ETH |
| Explorer | https://sepolia.etherscan.io/ |
| TestAsset (vUSD) | `0xf08328fE711EE112A06345383C7D5e00009641Ab` |
| VaultFactory | `0x41AF576177D3955fdCb1A9e074A864E6F14A9D4B` |

These contracts are already deployed. Do not broadcast `contracts/script/Deploy.s.sol` again.

The backend accepts chain `11155111` only for this factory. A leftover Base Sepolia chain id (`84532`) or `sepolia.base.org` RPC is ignored at runtime and is not written back to the environment file. Copy `.env.example` when you create a local `.env`. Do not commit secrets, and do not put an API key in `NEXT_PUBLIC_VAULTOS_RPC_URL`.

## Console

Connect an external wallet and switch it to Ethereum Sepolia. The wallet signs every transaction. VaultOS does not receive the private key.

1. Mint demonstration vUSD from TestAsset.
2. Create a vault through VaultFactory.
3. The console sends the creation hash to the registry, which reads the factory event from the configured RPC.
4. Open the vault to read balances, deposit vUSD, withdraw assets, or redeem shares.

An existing creation hash can still be registered without creating another vault.

## Checks

```bash
npm test
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.tests.json
npm run lint
npm run build
```

Contract tests, from `contracts/`:

```bash
forge test
```
