import { redirect } from "next/navigation";

export default function AdminToursRedirect() {
  redirect("/admin/departures");
}
