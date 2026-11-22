import { redirect } from "next/navigation";

// Coupons live in Admin → Partners → Coupons (owner, 2026-11-22).
export default function AdminCouponsPage() {
  redirect("/admin/partners?section=coupons");
}
