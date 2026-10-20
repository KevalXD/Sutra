import { NextResponse } from "next/server";
import { executeRecoveryRun } from "@/lib/recovery/route-runner";

export const maxDuration = 40;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const outcome = await executeRecoveryRun(body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
