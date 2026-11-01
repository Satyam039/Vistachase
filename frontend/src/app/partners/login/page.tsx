import { redirect } from "next/navigation";

export default function LegacyPartnerLoginRedirect() {
  redirect("/affiliate/login");
}
