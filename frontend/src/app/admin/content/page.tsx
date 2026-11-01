import { redirect } from "next/navigation";

export default function AdminContentRedirect() {
  redirect("/admin/messages");
}
