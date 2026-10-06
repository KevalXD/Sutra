import { NextResponse } from "next/server";
import { parseScenario } from "@/lib/scenario";
import { candidatesFor } from "@/lib/mock";
export function GET(req: Request) {
  const s = parseScenario(new URL(req.url).searchParams.get("scenario"));
  return NextResponse.json({ alternatives: candidatesFor(s) });
}
