import { PartnerOverview } from "@/components/admin/partners/PartnerOverview";

export default async function AdminPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartnerOverview id={id} />;
}
