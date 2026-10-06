import { NextResponse } from "next/server";
import { parseScenario } from "@/lib/scenario";
import { tripFor } from "@/lib/mock";
export function GET(req: Request) {
  const u = new URL(req.url); const s = parseScenario(u.searchParams.get("scenario"));
  if (s === "error" && u.searchParams.get("attempt") === "0")
    return NextResponse.json({ error: { code: "ITINERARY_LOAD_FAILED", message: "We couldn't load this journey." } }, { status: 503 });
  return NextResponse.json(tripFor(s));
}
