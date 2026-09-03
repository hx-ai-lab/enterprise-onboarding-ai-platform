import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/skills")!;

export default function SkillsPage() {
  return <ComingSoonPage title={item.label} icon={item.icon} />;
}
