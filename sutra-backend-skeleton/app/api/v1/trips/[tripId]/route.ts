import { NextResponse } from "next/server";
import { handleGetTrip } from "@/lib/api/http";
import { defaultDeps } from "@/lib/application/container";

export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  const { status, body } = await handleGetTrip(tripId, defaultDeps().trips);
  return NextResponse.json(body, { status });
}
