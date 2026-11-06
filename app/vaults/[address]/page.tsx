import { VaultDetailScreen } from "@/components/console/VaultDetailScreen";

export default async function VaultDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <VaultDetailScreen key={address} address={address} />;
}
