import { ComingSoonPage } from "@/components/coming-soon-page";
import { navItems } from "@/lib/nav-items";

const item = navItems.find((i) => i.href === "/chat")!;

export default function ChatPage() {
  return <ComingSoonPage item={item} />;
}
