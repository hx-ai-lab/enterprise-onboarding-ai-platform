import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/agents")!;

export default function AgentsPage() {
  return <ComingSoonPage item={item} />;
}
