import { readRuntimeConfig } from "@/lib/vaultos/config";
import { networkName } from "@/lib/vaultos/network";
import { getVaultStore } from "@/db/client";

const config = readRuntimeConfig();
if (!config) {
  console.error("Set DATABASE_URL, VAULTOS_RPC_URL, VAULTOS_CHAIN_ID, and VAULTOS_FACTORY_ADDRESS before seeding.");
  process.exit(1);
}

const store = await getVaultStore();
await store.saveNetwork({
  chainId: config.chainId,
  name: networkName(config.chainId),
  factoryAddress: config.factoryAddress,
  status: "demo",
});

console.log(`Seeded network ${config.chainId} with factory ${config.factoryAddress}.`);
