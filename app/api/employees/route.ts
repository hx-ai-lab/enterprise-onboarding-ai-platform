import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/data/reference-data";

export async function GET() {
  const employees = await getEmployees();
  return NextResponse.json({ employees });
}
