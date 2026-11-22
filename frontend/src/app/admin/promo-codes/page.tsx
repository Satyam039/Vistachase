import { redirect } from "next/navigation";

// Admin → Promo codes is now Admin → Partners → Coupons (same codes, same API).
export default function AdminPromoCodesPage() {
  redirect("/admin/partners?section=coupons");
}
