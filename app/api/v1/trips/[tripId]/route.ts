import { NextResponse } from "next/server";
import { tripOutcome } from "@/lib/recovery/http";

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const outcome = await tripOutcome(tripId);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
