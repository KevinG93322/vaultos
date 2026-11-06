CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL UNIQUE,
  name text NOT NULL,
  factory_address text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  symbol text NOT NULL,
  decimals integer NOT NULL,
  kind text NOT NULL,
  verification_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, token_address)
);

CREATE TABLE IF NOT EXISTS vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  chain_id integer NOT NULL,
  vault_address text NOT NULL,
  asset_id uuid NOT NULL REFERENCES assets (id),
  implementation_address text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  deployer text NOT NULL,
  factory_address text NOT NULL,
  creation_tx_hash text NOT NULL,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, vault_address),
  UNIQUE (chain_id, creation_tx_hash)
);

CREATE TABLE IF NOT EXISTS deployment_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash text NOT NULL,
  chain_id integer NOT NULL,
  factory_address text,
  vault_address text,
  status text NOT NULL,
  code_hash text,
  event_found boolean NOT NULL DEFAULT false,
  failure_reason text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deployment_checks_tx_idx
  ON deployment_checks (chain_id, tx_hash);
