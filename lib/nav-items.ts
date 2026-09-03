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

export type NavGroup = "调试" | "构建" | "观测";

export type NavItem = {
  href: string;
  label: string;
  code: string;
  group: NavGroup;
  icon: LucideIcon;
  description: string;
  /** false once the module has real functionality wired up (vs. the V1 placeholder page). */
  wip?: boolean;
};

export const navGroups: NavGroup[] = ["调试", "构建", "观测"];

export const navItems: NavItem[] = [
  {
    href: "/chat",
    label: "聊天 Demo",
    code: "MODULE / CHAT-DEMO",
    group: "调试",
    icon: MessageSquare,
    description: "与助手对话的调试与演示入口",
  },
  {
    href: "/agents",
    label: "Agent 控制台",
    code: "MODULE / AGENT-CONSOLE",
    group: "调试",
    icon: Bot,
    description: "管理与监控 Agent 的运行状态",
    wip: false,
  },
  {
    href: "/skills",
    label: "Skills",
    code: "MODULE / SKILLS",
    group: "构建",
    icon: Sparkles,
    description: "维护 Agent 可调用的技能库",
    wip: false,
  },
  {
    href: "/tools",
    label: "Tools",
    code: "MODULE / TOOLS",
    group: "构建",
    icon: Wrench,
    description: "维护 Agent 可调用的工具库",
    wip: false,
  },
  {
    href: "/planner",
    label: "Planner",
    code: "MODULE / PLANNER",
    group: "构建",
    icon: Workflow,
    description: "编排任务流程与执行计划",
  },
  {
    href: "/models",
    label: "模型管理",
    code: "MODULE / MODELS",
    group: "构建",
    icon: Cpu,
    description: "管理接入的模型与调用配置",
  },
  {
    href: "/operations",
    label: "运营中心",
    code: "MODULE / OPS",
    group: "观测",
    icon: Activity,
    description: "查看运营指标与日常运营操作",
  },
  {
    href: "/data-center",
    label: "数据中心",
    code: "MODULE / DATA",
    group: "观测",
    icon: Database,
    description: "查看与管理平台数据资产",
  },
];
