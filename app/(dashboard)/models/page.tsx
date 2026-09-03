import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/models")!;

export default function ModelsPage() {
  return <ComingSoonPage item={item} />;
}
