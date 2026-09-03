import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getAgentById } from "@/lib/data/agents";
import { getLogsByAgent } from "@/lib/data/logs";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) return jsonError(404, `未找到 Agent:${agentId}`);

  const logs = await getLogsByAgent(agentId);
  return NextResponse.json({ logs });
}
