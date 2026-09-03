import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/data-center")!;

export default function DataCenterPage() {
  return <ComingSoonPage title={item.label} icon={item.icon} />;
}
