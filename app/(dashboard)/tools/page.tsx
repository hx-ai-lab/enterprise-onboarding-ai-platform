import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/tools")!;

export default function ToolsPage() {
  return <ComingSoonPage title={item.label} icon={item.icon} />;
}
