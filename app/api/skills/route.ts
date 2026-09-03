import { NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api-utils";
import { createSkill, getSkills, type CreateSkillInput } from "@/lib/data/skills";

export async function GET() {
  const skills = await getSkills();
  return NextResponse.json({ skills });
}

export async function POST(req: Request) {
  const body = await parseJsonBody<Partial<CreateSkillInput>>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  const { name, description, prompt, model_params, enabled } = body;
  if (!name?.trim()) return jsonError(400, "名称不能为空");
  if (!description?.trim()) return jsonError(400, "描述不能为空");
  if (!prompt?.trim()) return jsonError(400, "Prompt 不能为空");
  if (
    !model_params ||
    typeof model_params.model !== "string" ||
    !model_params.model.trim() ||
    typeof model_params.temperature !== "number" ||
    typeof model_params.max_tokens !== "number"
  ) {
    return jsonError(400, "模型参数不完整,需包含 model / temperature / max_tokens");
  }

  const skill = await createSkill({ name, description, prompt, model_params, enabled });
  return NextResponse.json({ skill }, { status: 201 });
}
