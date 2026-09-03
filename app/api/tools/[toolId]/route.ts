import { NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api-utils";
import {
  deleteTool,
  getToolById,
  updateTool,
  type UpdateToolInput,
} from "@/lib/data/tools";

type RouteContext = { params: Promise<{ toolId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { toolId } = await params;
  const tool = await getToolById(toolId);
  if (!tool) return jsonError(404, `未找到 Tool:${toolId}`);
  return NextResponse.json({ tool });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const { toolId } = await params;
  const existing = await getToolById(toolId);
  if (!existing) return jsonError(404, `未找到 Tool:${toolId}`);

  const body = await parseJsonBody<UpdateToolInput>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  if (body.name !== undefined && !body.name.trim()) return jsonError(400, "名称不能为空");
  if (body.description !== undefined && !body.description.trim()) return jsonError(400, "描述不能为空");
  if (body.data_source !== undefined && !body.data_source.trim()) return jsonError(400, "数据源文件名不能为空");

  const tool = await updateTool(toolId, body);
  return NextResponse.json({ tool });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { toolId } = await params;
  const existed = await deleteTool(toolId);
  if (!existed) return jsonError(404, `未找到 Tool:${toolId}`);
  return NextResponse.json({ ok: true });
}
