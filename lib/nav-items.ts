import {
  Activity,
  Bot,
  Cpu,
  Database,
  MessageSquare,
  Sparkles,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const navItems: NavItem[] = [
  {
    href: "/chat",
    label: "聊天 Demo",
    icon: MessageSquare,
    description: "与助手对话的调试与演示入口",
  },
  {
    href: "/agents",
    label: "Agent 控制台",
    icon: Bot,
    description: "管理与监控 Agent 的运行状态",
  },
  {
    href: "/skills",
    label: "Skills",
    icon: Sparkles,
    description: "维护 Agent 可调用的技能库",
  },
  {
    href: "/tools",
    label: "Tools",
    icon: Wrench,
    description: "维护 Agent 可调用的工具库",
  },
  {
    href: "/planner",
    label: "Planner",
    icon: Workflow,
    description: "编排任务流程与执行计划",
  },
  {
    href: "/models",
    label: "模型管理",
    icon: Cpu,
    description: "管理接入的模型与调用配置",
  },
  {
    href: "/operations",
    label: "运营中心",
    icon: Activity,
    description: "查看运营指标与日常运营操作",
  },
  {
    href: "/data-center",
    label: "数据中心",
    icon: Database,
    description: "查看与管理平台数据资产",
  },
];
