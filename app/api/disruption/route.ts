import { NextResponse } from "next/server";
import { parseScenario } from "@/lib/scenario";
import { analysisFor } from "@/lib/mock";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(analysisFor(parseScenario(body.scenario)));
}
