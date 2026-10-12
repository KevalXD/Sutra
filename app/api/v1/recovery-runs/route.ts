import { NextResponse } from "next/server";
import { recoveryRunOutcome } from "@/lib/recovery/http";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const outcome = await recoveryRunOutcome(body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
