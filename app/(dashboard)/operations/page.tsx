import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/operations")!;

export default function OperationsPage() {
  return <ComingSoonPage item={item} />;
}
