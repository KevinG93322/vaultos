const REGISTRY_MESSAGES: Record<string, string> = {
  service_unconfigured:
    "The registry is not configured on this server. Vault records cannot be loaded until the database, RPC, chain, and factory settings are present.",
  database_error: "The registry could not complete the request. No new record was confirmed.",
  chain_mismatch: "The registry only accepts chain 11155111 for this request.",
  not_found: "This address is not in the vault registry.",
  invalid_input: "The submitted value is not valid.",
  request_failed: "The registry request failed.",
  invalid_response: "The registry returned a response the console could not read.",
  network: "The console could not reach the registry.",
  receipt_not_found: "No transaction receipt was found for that hash.",
  transaction_failed: "That transaction did not succeed on the chain.",
  unauthorized_factory: "That transaction was not sent to the authorized factory.",
  event_missing: "That transaction did not emit a vault creation event from the factory.",
  event_invalid: "The vault creation event could not be verified.",
  reference_vault: "The factory reference vault cannot be registered as a customer vault.",
  not_registered: "The factory has not registered the vault from that transaction.",
  asset_mismatch: "The vault asset does not match the factory’s approved asset.",
  code_mismatch: "The deployed vault code does not match the factory’s approved code.",
  rpc_unavailable: "The registry could not reach the configured chain.",
  chain_read_failed: "The registry could not read the vault from the configured chain.",
  unknown_chain: "That chain is not present in the registry.",
};

export function registryMessage(code: string): string {
  return REGISTRY_MESSAGES[code] ?? "The registry returned an unexpected result.";
}
