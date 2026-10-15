import type { Metadata } from "next";
import { TasksView } from "@/components/seo-portal/WorkViews";

export const metadata: Metadata = { title: "SEO tasks" };

export default function Page() {
  return <TasksView />;
}
