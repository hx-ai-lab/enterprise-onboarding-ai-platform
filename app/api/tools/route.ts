import { NextResponse } from "next/server";
import { jsonError, parseJsonBody, storageErrorResponse } from "@/lib/api-utils";
import { createTool, getTools, type CreateToolInput } from "@/lib/data/tools";

export async function GET() {
  const tools = await getTools();
  return NextResponse.json({ tools });
}

export async function POST(req: Request) {
  const body = await parseJsonBody<Partial<CreateToolInput>>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  const { name, description, data_source, enabled } = body;
  if (!name?.trim()) return jsonError(400, "名称不能为空");
  if (!description?.trim()) return jsonError(400, "描述不能为空");
  if (!data_source?.trim()) return jsonError(400, "数据源文件名不能为空");

  try {
    const tool = await createTool({ name, description, data_source, enabled });
    return NextResponse.json({ tool }, { status: 201 });
  } catch (err) {
    return storageErrorResponse(err);
  }
}
