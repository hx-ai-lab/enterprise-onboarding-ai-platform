import { NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api-utils";
import { createAgent, getAgents, type CreateAgentInput } from "@/lib/data/agents";
import { getSkills } from "@/lib/data/skills";
import { getTools } from "@/lib/data/tools";

export async function GET() {
  const agents = await getAgents();
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const body = await parseJsonBody<Partial<CreateAgentInput>>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  const { name, description, system_prompt, model_id, bound_skill_ids, bound_tool_ids, enabled } = body;
  if (!name?.trim()) return jsonError(400, "名称不能为空");
  if (!description?.trim()) return jsonError(400, "描述不能为空");
  if (!system_prompt?.trim()) return jsonError(400, "System Prompt 不能为空");
  if (!model_id?.trim()) return jsonError(400, "模型 ID 不能为空");
  if (!Array.isArray(bound_skill_ids)) return jsonError(400, "bound_skill_ids 必须为数组");
  if (!Array.isArray(bound_tool_ids)) return jsonError(400, "bound_tool_ids 必须为数组");

  const [skills, tools] = await Promise.all([getSkills(), getTools()]);
  const skillIds = new Set(skills.map((s) => s.id));
  const toolIds = new Set(tools.map((t) => t.id));
  const unknownSkill = bound_skill_ids.find((id) => !skillIds.has(id));
  if (unknownSkill) return jsonError(400, `未知的 Skill:${unknownSkill}`);
  const unknownTool = bound_tool_ids.find((id) => !toolIds.has(id));
  if (unknownTool) return jsonError(400, `未知的 Tool:${unknownTool}`);

  const agent = await createAgent({
    name,
    description,
    system_prompt,
    model_id,
    bound_skill_ids,
    bound_tool_ids,
    enabled,
  });
  return NextResponse.json({ agent }, { status: 201 });
}
