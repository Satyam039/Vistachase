import { redirect } from "next/navigation";

export default function LegacyPartnerDashboardRedirect() {
  redirect("/affiliate/dashboard");
}
