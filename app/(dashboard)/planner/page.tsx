import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/planner")!;

export default function PlannerPage() {
  return <ComingSoonPage item={item} />;
}
