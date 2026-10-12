import { NextResponse } from "next/server";
import { handleStartRecovery } from "@/lib/api/http";
import { defaultDeps } from "@/lib/application/container";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => undefined);
  const { status, body: payload } = await handleStartRecovery(body, defaultDeps());
  return NextResponse.json(payload, { status });
}
