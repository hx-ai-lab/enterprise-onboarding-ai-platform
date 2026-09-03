import { NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api-utils";
import {
  deleteAgent,
  getAgentById,
  updateAgent,
  type UpdateAgentInput,
} from "@/lib/data/agents";
import { getSkills } from "@/lib/data/skills";
import { getTools } from "@/lib/data/tools";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) return jsonError(404, `未找到 Agent:${agentId}`);

  const [skills, tools] = await Promise.all([getSkills(), getTools()]);
  const boundSkills = skills.filter((s) => agent.bound_skill_ids.includes(s.id));
  const boundTools = tools.filter((t) => agent.bound_tool_ids.includes(t.id));

  return NextResponse.json({ agent, bound_skills: boundSkills, bound_tools: boundTools });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const { agentId } = await params;
  const existing = await getAgentById(agentId);
  if (!existing) return jsonError(404, `未找到 Agent:${agentId}`);

  const body = await parseJsonBody<UpdateAgentInput>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  if (body.name !== undefined && !body.name.trim()) return jsonError(400, "名称不能为空");
  if (body.description !== undefined && !body.description.trim()) return jsonError(400, "描述不能为空");
  if (body.system_prompt !== undefined && !body.system_prompt.trim()) {
    return jsonError(400, "System Prompt 不能为空");
  }

  if (body.bound_skill_ids !== undefined) {
    if (!Array.isArray(body.bound_skill_ids)) return jsonError(400, "bound_skill_ids 必须为数组");
    const skills = await getSkills();
    const skillIds = new Set(skills.map((s) => s.id));
    // Silently drop references to Skills deleted since this Agent was last
    // loaded, rather than rejecting the whole save — the UI has no way to
    // un-check a binding for a Skill that no longer exists to render.
    body.bound_skill_ids = body.bound_skill_ids.filter((id) => skillIds.has(id));
  }
  if (body.bound_tool_ids !== undefined) {
    if (!Array.isArray(body.bound_tool_ids)) return jsonError(400, "bound_tool_ids 必须为数组");
    const tools = await getTools();
    const toolIds = new Set(tools.map((t) => t.id));
    body.bound_tool_ids = body.bound_tool_ids.filter((id) => toolIds.has(id));
  }

  const agent = await updateAgent(agentId, body);
  return NextResponse.json({ agent });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { agentId } = await params;
  const existed = await deleteAgent(agentId);
  if (!existed) return jsonError(404, `未找到 Agent:${agentId}`);
  return NextResponse.json({ ok: true });
}
