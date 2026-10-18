import { NextResponse } from "next/server";
import { tripsOutcome } from "@/lib/recovery/http";

export async function GET() {
  const outcome = await tripsOutcome();
  return NextResponse.json(outcome.body, { status: outcome.status });
}
