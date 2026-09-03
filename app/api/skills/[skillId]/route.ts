import { NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api-utils";
import {
  deleteSkill,
  getSkillById,
  updateSkill,
  type UpdateSkillInput,
} from "@/lib/data/skills";

type RouteContext = { params: Promise<{ skillId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { skillId } = await params;
  const skill = await getSkillById(skillId);
  if (!skill) return jsonError(404, `未找到 Skill:${skillId}`);
  return NextResponse.json({ skill });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const { skillId } = await params;
  const existing = await getSkillById(skillId);
  if (!existing) return jsonError(404, `未找到 Skill:${skillId}`);

  const body = await parseJsonBody<UpdateSkillInput>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  if (body.name !== undefined && !body.name.trim()) return jsonError(400, "名称不能为空");
  if (body.description !== undefined && !body.description.trim()) return jsonError(400, "描述不能为空");
  if (body.prompt !== undefined && !body.prompt.trim()) return jsonError(400, "Prompt 不能为空");
  if (
    body.model_params !== undefined &&
    (typeof body.model_params.model !== "string" ||
      !body.model_params.model.trim() ||
      typeof body.model_params.temperature !== "number" ||
      typeof body.model_params.max_tokens !== "number")
  ) {
    return jsonError(400, "模型参数不完整,需包含 model / temperature / max_tokens");
  }

  const skill = await updateSkill(skillId, body);
  return NextResponse.json({ skill });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { skillId } = await params;
  const existed = await deleteSkill(skillId);
  if (!existed) return jsonError(404, `未找到 Skill:${skillId}`);
  return NextResponse.json({ ok: true });
}
